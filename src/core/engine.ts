import { prisma } from "@/lib/prisma";
import type { Automation, Card, List, Prisma, Task } from "@prisma/client";
import { evaluateGroup, renderTemplate, type EvalContext } from "./conditions";
import { cardContext } from "./context";
import {
  actionSchema,
  conditionGroupSchema,
  triggerSchema,
  type AutomationAction,
  type Trigger,
} from "./rules";
import { ComplianceError } from "./errors";
import { MAX_AUTOMATION_DEPTH, type AutomationContext, type DomainEvent } from "./events";

/**
 * AutomationEngine (seção 5.3): Gatilho → Condições → Ações.
 * - Ações executam na ordem definida; falha em uma não impede as demais (US-26)
 * - Toda ação passa pelo ComplianceGuard; violação vira `blocked_by_compliance`
 * - Encadeamento limitado a MAX_AUTOMATION_DEPTH níveis
 * - Idempotência por (automation_id, card_id, event_key)
 */

type LoadedCard = Card & { list: List; tasks: Task[]; board: { key: "sales" | "projects" } };

async function loadCard(cardId: string): Promise<LoadedCard | null> {
  return prisma.card.findUnique({
    where: { id: cardId },
    include: { list: true, tasks: true, board: { select: { key: true } } },
  }) as Promise<LoadedCard | null>;
}

function triggerMatches(trigger: Trigger, event: DomainEvent, toList: List | null): boolean {
  if (trigger.type !== event.type) return false;
  if (trigger.board && trigger.board !== event.boardKey) return false;
  if (trigger.to_list && toList?.stageKey !== trigger.to_list) return false;
  if (trigger.field && event.field !== trigger.field) return false;
  return true;
}

export type ActionOutcome = {
  action: AutomationAction["type"];
  status: "success" | "blocked_by_compliance" | "error" | "skipped";
  detail?: string;
};

/** Despacha um evento de domínio para todas as automações ativas correspondentes. */
export async function dispatch(event: DomainEvent, depth = 0): Promise<void> {
  if (depth > MAX_AUTOMATION_DEPTH) return; // laço interrompido silenciosamente

  const automations = await prisma.automation.findMany({ where: { enabled: true } });
  if (automations.length === 0) return;

  const card = await loadCard(event.cardId);
  if (!card) return;
  const toList = event.toListId
    ? await prisma.list.findUnique({ where: { id: event.toListId } })
    : null;

  for (const automation of automations) {
    const trigger = triggerSchema.safeParse(automation.trigger);
    if (!trigger.success) continue;
    if (!triggerMatches(trigger.data, event, toList ?? card.list)) continue;
    await runAutomation(automation, card, event, depth);
  }
}

/** Executa (ou simula) UMA automação contra um card. Usada pelo dispatch, pelo cron e pelo "Testar" (US-29). */
export async function runAutomation(
  automation: Automation,
  cardInput: LoadedCard | string,
  event: DomainEvent,
  depth = 0,
  options: { simulate?: boolean } = {}
): Promise<{ status: string; outcomes: ActionOutcome[] }> {
  const card = typeof cardInput === "string" ? await loadCard(cardInput) : cardInput;
  if (!card) return { status: "error", outcomes: [] };

  if (depth > MAX_AUTOMATION_DEPTH) {
    await record(automation.id, card.id, "error", null, event, "Encadeamento máximo de automações atingido.");
    return { status: "error", outcomes: [] };
  }

  // Idempotência de gatilhos temporais: o mesmo atraso não dispara duas vezes (US-27).
  if (event.eventKey) {
    const existing = await prisma.automationRun.findFirst({
      where: { automationId: automation.id, cardId: card.id, eventKey: event.eventKey },
    });
    if (existing) return { status: "skipped", outcomes: [] };
  }

  const fromList = event.fromListId
    ? await prisma.list.findUnique({ where: { id: event.fromListId } })
    : null;
  const toList = event.toListId
    ? await prisma.list.findUnique({ where: { id: event.toListId } })
    : card.list;
  const task = event.taskId
    ? await prisma.task.findUnique({ where: { id: event.taskId } })
    : null;

  const ctx = cardContext(card, { fromList, toList, task });

  const conditions = conditionGroupSchema.safeParse(automation.conditions);
  if (!conditions.success || !evaluateGroup(conditions.data, ctx)) {
    return { status: "skipped", outcomes: [] };
  }

  const rawActions = Array.isArray(automation.actions) ? automation.actions : [];
  const automationCtx: AutomationContext = {
    automationId: automation.id,
    automationName: automation.name,
    depth: depth + 1,
  };

  const outcomes: ActionOutcome[] = [];
  for (const raw of rawActions) {
    const parsed = actionSchema.safeParse(raw);
    if (!parsed.success) {
      outcomes.push({ action: "set_field", status: "error", detail: "Ação malformada." });
      continue;
    }
    if (options.simulate) {
      outcomes.push({ action: parsed.data.type, status: "success", detail: describe(parsed.data, ctx) });
      continue;
    }
    try {
      const result = await executeAction(parsed.data, card, ctx, event, automationCtx);
      outcomes.push(result);
      // US-23: a integração venda→projeto detectou duplicata — o propósito da
      // regra já foi cumprido numa execução anterior; nada mais deve rodar e a
      // tentativa fica registrada como `skipped`.
      if (result.action === "create_project_card" && result.status === "skipped") break;
    } catch (err) {
      if (err instanceof ComplianceError) {
        outcomes.push({ action: parsed.data.type, status: "blocked_by_compliance", detail: err.message });
      } else {
        outcomes.push({
          action: parsed.data.type,
          status: "error",
          detail: err instanceof Error ? err.message : String(err),
        });
      }
    }
  }

  const hasError = outcomes.some((o) => o.status === "error");
  const hasBlocked = outcomes.some((o) => o.status === "blocked_by_compliance");
  const duplicateSkip = outcomes.some(
    (o) => o.action === "create_project_card" && o.status === "skipped"
  );
  const allSkipped = outcomes.length > 0 && outcomes.every((o) => o.status === "skipped");
  const status = options.simulate
    ? "success"
    : hasError
      ? "error"
      : hasBlocked
        ? "blocked_by_compliance"
        : duplicateSkip || allSkipped
          ? "skipped"
          : "success";

  if (!options.simulate) {
    await record(
      automation.id,
      card.id,
      status,
      event.eventKey ?? null,
      event,
      outcomes
        .filter((o) => o.status !== "success")
        .map((o) => `${o.action}: ${o.detail ?? o.status}`)
        .join(" | ") || null,
      outcomes
    );
  }
  return { status, outcomes };
}

async function record(
  automationId: string,
  cardId: string,
  status: string,
  eventKey: string | null,
  event: DomainEvent,
  error: string | null = null,
  outcomes: ActionOutcome[] = []
): Promise<void> {
  await prisma.automationRun.create({
    data: {
      automationId,
      cardId,
      status: status as never,
      eventKey,
      payload: { event: event.type, outcomes } as unknown as Prisma.InputJsonValue,
      error,
    },
  });
}

/** Descrição em português do que a ação FARIA (modo teste, US-29). */
function describe(action: AutomationAction, ctx: EvalContext): string {
  switch (action.type) {
    case "notify_user":
      return `Notificaria (${action.target}): "${renderTemplate(action.message, ctx)}"`;
    case "move_card":
      return `Moveria o card para "${action.target_list}"`;
    case "assign_user":
      return "Definiria o responsável do card";
    case "set_due_date":
      return action.mode === "fixed"
        ? `Definiria o prazo para ${action.date}`
        : `Definiria o prazo para hoje + ${action.days} dia(s)`;
    case "add_task":
      return `Adicionaria a tarefa "${action.title}" ao checklist`;
    case "add_comment":
      return `Comentaria: "${renderTemplate(action.text, ctx)}"`;
    case "create_project_card":
      return `Criaria um card no Pipeline de Projetos ("${action.target_list}")`;
    case "set_field":
      return `Alteraria o campo ${action.field} para "${action.value}"`;
  }
}

async function executeAction(
  action: AutomationAction,
  card: LoadedCard,
  ctx: EvalContext,
  event: DomainEvent,
  auto: AutomationContext
): Promise<ActionOutcome> {
  // Import tardio para quebrar o ciclo domínio ⇄ motor.
  const domain = await import("./domain");

  switch (action.type) {
    case "notify_user": {
      const message = renderTemplate(action.message, ctx);
      const targets = new Set<string>();
      if (action.target === "assignee" && card.assigneeId) targets.add(card.assigneeId);
      if (action.target === "creator") targets.add(card.createdBy);
      if (action.target === "user" && action.user_id) targets.add(action.user_id);
      if (action.target === "all") {
        const all = await prisma.profile.findMany({ select: { id: true } });
        all.forEach((p) => targets.add(p.id));
      }
      if (targets.size === 0)
        return { action: action.type, status: "skipped", detail: "Sem destinatário (card sem responsável)." };
      await prisma.notification.createMany({
        data: Array.from(targets).map((userId) => ({ userId, cardId: card.id, message })),
      });
      return { action: action.type, status: "success" };
    }

    case "move_card": {
      const target = await prisma.list.findFirst({
        where: { boardId: card.boardId, stageKey: action.target_list },
      });
      if (!target) return { action: action.type, status: "error", detail: "Lista de destino não existe." };
      if (target.id === card.listId)
        return { action: action.type, status: "skipped", detail: "Card já está na lista." };
      await domain.moveCard(card.id, { toListId: target.id }, null, auto);
      return { action: action.type, status: "success" };
    }

    case "assign_user":
      await domain.updateCard(card.id, { assigneeId: action.user_id }, null, auto);
      return { action: action.type, status: "success" };

    case "set_due_date": {
      const due =
        action.mode === "fixed" && action.date
          ? new Date(`${action.date}T00:00:00Z`)
          : new Date(Date.now() + (action.days ?? 0) * 86_400_000);
      await domain.updateCard(card.id, { dueDate: due }, null, auto);
      return { action: action.type, status: "success" };
    }

    case "add_task": {
      const due = new Date(Date.now() + action.due_in_days * 86_400_000);
      await domain.createTask(
        card.id,
        {
          title: renderTemplate(action.title, ctx),
          dueDate: due,
          assigneeId: action.assignee === "card_assignee" ? card.assigneeId : null,
        },
        null,
        auto
      );
      return { action: action.type, status: "success" };
    }

    case "add_comment":
      await domain.addComment(card.id, renderTemplate(action.text, ctx), null, auto);
      return { action: action.type, status: "success" };

    case "set_field": {
      const patch: Record<string, unknown> = {};
      if (action.field === "amount") patch.amount = action.value;
      else patch[action.field] = renderTemplate(action.value, ctx);
      await domain.updateCard(card.id, patch as never, null, auto);
      return { action: action.type, status: "success" };
    }

    case "create_project_card": {
      // Idempotência da integração venda→projeto (US-23): a mesma venda
      // nunca gera dois projetos — verificado aqui e por UNIQUE no banco.
      const existing = await prisma.card.findUnique({ where: { sourceCardId: card.id } });
      if (existing)
        return {
          action: action.type,
          status: "skipped",
          detail: `Projeto já existe para esta venda (${existing.title}).`,
        };

      const board = await prisma.board.findUnique({ where: { key: "projects" } });
      const list = board
        ? await prisma.list.findFirst({
            where: { boardId: board.id, stageKey: action.target_list },
          })
        : null;
      if (!board || !list)
        return { action: action.type, status: "error", detail: "Quadro/lista de projetos não encontrado." };

      const inherit = new Set(action.inherit);
      const title = renderTemplate(action.title_template, {
        ...ctx,
        client_name: card.clientName ?? "Cliente",
        "card.title": card.title,
      });

      const project = await domain.createCard(
        {
          boardId: board.id,
          listId: list.id,
          type: "project",
          title,
          description: inherit.has("description") ? card.description : null,
          clientName: inherit.has("client_name") ? card.clientName : null,
          clientEmail: inherit.has("client_email") ? card.clientEmail : null,
          clientPhone: inherit.has("client_phone") ? card.clientPhone : null,
          amount: inherit.has("amount") && card.amount !== null ? String(card.amount) : null,
          assigneeId: inherit.has("assignee_id") ? card.assigneeId : null,
          sourceCardId: action.link_back ? card.id : null,
          createdBy: card.createdBy,
        },
        null,
        auto,
        { creationNote: `Criado automaticamente pela venda #${card.id.slice(0, 8)}` }
      );

      await domain.addComment(
        card.id,
        `Projeto gerado no Pipeline de Projetos: ${project.title}`,
        null,
        auto
      );
      return { action: action.type, status: "success" };
    }
  }
}
