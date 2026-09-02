import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import type { Card, CardType } from "@prisma/client";
import { assertCompliance } from "./compliance";
import { cardContext } from "./context";
import { dispatch } from "./engine";
import { NotFoundError, PermissionError } from "./errors";
import type { Actor, AutomationContext } from "./events";
import { canEditCard, canMutateBoard } from "./permissions";

/**
 * CAMADA DE DOMÍNIO — única porta de escrita (seção 5.1 do backlog).
 * Toda mutação segue a mesma sequência:
 *   1. ComplianceGuard.assert  ← BLOQUEIA antes de persistir
 *   2. Persistência (Prisma)
 *   3. ActivityLog
 *   4. Evento de domínio → AutomationEngine
 * Rotas e Server Actions nunca chamam o Prisma diretamente para escrever.
 */

const CARD_INCLUDE = {
  list: true,
  tasks: true,
  board: { select: { key: true } },
} satisfies Prisma.CardInclude;

async function requireCard(cardId: string) {
  const card = await prisma.card.findUnique({ where: { id: cardId }, include: CARD_INCLUDE });
  if (!card) throw new NotFoundError("Card não encontrado.");
  return card;
}

function actorLabel(auto?: AutomationContext) {
  return auto ? { automation: auto.automationName } : {};
}

async function log(
  cardId: string,
  actorId: string | null,
  action: string,
  before: Prisma.InputJsonValue | null,
  after: Prisma.InputJsonValue | null,
  auto?: AutomationContext
) {
  await prisma.activityLog.create({
    data: {
      cardId,
      actorId,
      action,
      before: before ?? undefined,
      after: after ? { ...(after as object), ...actorLabel(auto) } : actorLabel(auto),
    },
  });
}

// ---------------------------------------------------------------- cards

export type CreateCardData = {
  boardId: string;
  listId: string;
  type: CardType;
  title: string;
  description?: string | null;
  assigneeId?: string | null;
  dueDate?: Date | null;
  clientName?: string | null;
  clientEmail?: string | null;
  clientPhone?: string | null;
  amount?: string | null;
  sourceCardId?: string | null;
  createdBy: string;
};

export async function createCard(
  data: CreateCardData,
  actor: Actor | null,
  auto?: AutomationContext,
  opts: { creationNote?: string } = {}
): Promise<Card> {
  const list = await prisma.list.findUnique({
    where: { id: data.listId },
    include: { board: true },
  });
  if (!list || list.boardId !== data.boardId) throw new NotFoundError("Lista não encontrada.");
  if (actor && !canMutateBoard(actor.role, list.board.type)) {
    throw new PermissionError(
      list.board.type === "opportunity"
        ? "Apenas vendas, gestores e admins criam oportunidades."
        : "Apenas gestores e admins criam cards de projeto."
    );
  }

  const proposed = {
    ...data,
    id: "",
    position: 0,
    lossReason: null,
    archivedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    description: data.description ?? null,
    assigneeId: data.assigneeId ?? null,
    dueDate: data.dueDate ?? null,
    clientName: data.clientName ?? null,
    clientEmail: data.clientEmail ?? null,
    clientPhone: data.clientPhone ?? null,
    amount: data.amount ? new Prisma.Decimal(data.amount) : null,
    sourceCardId: data.sourceCardId ?? null,
  } satisfies Card;

  await assertCompliance(
    "card.create",
    cardContext(proposed, { toList: list, openTasks: 0 }),
    { actorId: actor?.id ?? null, action: { kind: "card.create", title: data.title } }
  );

  const last = await prisma.card.findFirst({
    where: { listId: list.id },
    orderBy: { position: "desc" },
    select: { position: true },
  });

  const card = await prisma.card.create({
    data: {
      boardId: data.boardId,
      listId: data.listId,
      type: data.type,
      title: data.title,
      description: data.description ?? null,
      position: (last?.position ?? 0) + 1024,
      assigneeId: data.assigneeId ?? null,
      dueDate: data.dueDate ?? null,
      clientName: data.clientName ?? null,
      clientEmail: data.clientEmail ?? null,
      clientPhone: data.clientPhone ?? null,
      amount: data.amount ?? null,
      sourceCardId: data.sourceCardId ?? null,
      createdBy: data.createdBy,
    },
  });

  await log(
    card.id,
    actor?.id ?? null,
    "card.created",
    null,
    { title: card.title, list: list.name, note: opts.creationNote ?? null },
    auto
  );

  await dispatch(
    {
      type: "card.created",
      boardKey: list.board.key,
      cardId: card.id,
      actorId: actor?.id ?? null,
      toListId: list.id,
    },
    auto?.depth ?? 0
  );

  return card;
}

export type CardPatch = Partial<{
  title: string;
  description: string | null;
  assigneeId: string | null;
  dueDate: Date | null;
  clientName: string | null;
  clientEmail: string | null;
  clientPhone: string | null;
  amount: string | null;
  lossReason: string | null;
}>;

export async function updateCard(
  cardId: string,
  patch: CardPatch,
  actor: Actor | null,
  auto?: AutomationContext
): Promise<Card> {
  const card = await requireCard(cardId);
  if (actor && !canEditCard(actor.role, card.board.key === "sales" ? "opportunity" : "project", card, actor.id)) {
    throw new PermissionError("Você só edita cards em que é responsável.");
  }

  const merged = {
    ...card,
    ...patch,
    amount:
      patch.amount !== undefined
        ? patch.amount === null
          ? null
          : new Prisma.Decimal(patch.amount)
        : card.amount,
  };

  await assertCompliance("card.update", cardContext(merged, { toList: card.list }), {
    cardId,
    actorId: actor?.id ?? null,
    action: { kind: "card.update", patch: JSON.parse(JSON.stringify(patch)) },
  });

  const changedFields = (Object.keys(patch) as (keyof CardPatch)[]).filter((k) => {
    const prev = k === "amount" ? (card.amount === null ? null : String(card.amount)) : card[k];
    const next = patch[k];
    const norm = (v: unknown) => (v instanceof Date ? v.toISOString().slice(0, 10) : (v ?? null));
    return norm(prev) !== norm(next);
  });
  if (changedFields.length === 0) return card;

  const updated = await prisma.card.update({ where: { id: cardId }, data: patch });

  await log(
    cardId,
    actor?.id ?? null,
    "card.updated",
    Object.fromEntries(
      changedFields.map((k) => [k, card[k] instanceof Date ? card[k].toISOString() : (card[k] as never)])
    ) as Prisma.InputJsonValue,
    Object.fromEntries(
      changedFields.map((k) => {
        const v = patch[k];
        return [k, v instanceof Date ? v.toISOString() : (v as never)];
      })
    ) as Prisma.InputJsonValue,
    auto
  );

  for (const field of changedFields) {
    await dispatch(
      {
        type: "card.field_changed",
        boardKey: card.board.key,
        cardId,
        actorId: actor?.id ?? null,
        field,
      },
      auto?.depth ?? 0
    );
  }
  return updated;
}

export async function moveCard(
  cardId: string,
  target: { toListId: string; index?: number },
  actor: Actor | null,
  auto?: AutomationContext
): Promise<Card> {
  const card = await requireCard(cardId);
  const toList = await prisma.list.findUnique({
    where: { id: target.toListId },
    include: { board: true },
  });
  if (!toList || toList.boardId !== card.boardId)
    throw new NotFoundError("Lista de destino não encontrada.");

  if (actor && !canMutateBoard(actor.role, toList.board.type)) {
    throw new PermissionError(
      toList.board.type === "opportunity"
        ? "Apenas vendas, gestores e admins movem oportunidades."
        : "Apenas gestores e admins movem cards de projeto."
    );
  }

  const openTasks = card.tasks.filter((t) => !t.done).length;
  const ctx = cardContext(card, { fromList: card.list, toList, openTasks });
  const meta = {
    cardId,
    actorId: actor?.id ?? null,
    action: { kind: "card.move", from: card.list.stageKey, to: toList.stageKey },
  };
  await assertCompliance("card.move", ctx, meta);
  if (toList.semantics === "won") await assertCompliance("opportunity.close", ctx, meta);

  // Posição fracionária entre vizinhos do índice pedido.
  const siblings = await prisma.card.findMany({
    where: { listId: toList.id, id: { not: cardId }, archivedAt: null },
    orderBy: { position: "asc" },
    select: { position: true },
  });
  const index = Math.max(0, Math.min(target.index ?? siblings.length, siblings.length));
  const before = index > 0 ? siblings[index - 1]?.position ?? 0 : 0;
  const after = siblings[index]?.position ?? before + 2048;
  const position = (before + after) / 2;

  const updated = await prisma.card.update({
    where: { id: cardId },
    data: { listId: toList.id, position },
  });

  if (card.listId !== toList.id) {
    await log(
      cardId,
      actor?.id ?? null,
      "card.moved",
      { list: card.list.name },
      { list: toList.name },
      auto
    );
    await dispatch(
      {
        type: "card.moved",
        boardKey: card.board.key,
        cardId,
        actorId: actor?.id ?? null,
        fromListId: card.listId,
        toListId: toList.id,
      },
      auto?.depth ?? 0
    );
  }
  return updated;
}

export async function addComment(
  cardId: string,
  text: string,
  actor: Actor | null,
  auto?: AutomationContext
): Promise<void> {
  await requireCard(cardId);
  await log(cardId, actor?.id ?? null, "comment", null, { text }, auto);
}

// ---------------------------------------------------------------- tasks

export async function createTask(
  cardId: string,
  data: { title: string; dueDate: Date | null; assigneeId?: string | null },
  actor: Actor | null,
  auto?: AutomationContext
) {
  const card = await requireCard(cardId);
  if (actor && !canEditCard(actor.role, card.board.key === "sales" ? "opportunity" : "project", card, actor.id)) {
    throw new PermissionError("Você só adiciona tarefas em cards que pode editar.");
  }

  await assertCompliance(
    "task.create",
    cardContext(card, {
      toList: card.list,
      task: { title: data.title, dueDate: data.dueDate as Date, assigneeId: data.assigneeId ?? null },
    }),
    { cardId, actorId: actor?.id ?? null, action: { kind: "task.create", title: data.title } }
  );
  if (!data.dueDate) {
    // Nunca deveria chegar aqui (a regra nativa bloqueia antes); NOT NULL é a rede final.
    throw new NotFoundError("Tarefa sem prazo não pode ser criada.");
  }

  const last = await prisma.task.findFirst({
    where: { cardId },
    orderBy: { position: "desc" },
    select: { position: true },
  });
  const task = await prisma.task.create({
    data: {
      cardId,
      title: data.title,
      dueDate: data.dueDate,
      assigneeId: data.assigneeId ?? null,
      position: (last?.position ?? 0) + 1024,
    },
  });

  await log(cardId, actor?.id ?? null, "task.created", null, { title: task.title }, auto);
  await dispatch(
    {
      type: "task.created",
      boardKey: card.board.key,
      cardId,
      actorId: actor?.id ?? null,
      taskId: task.id,
    },
    auto?.depth ?? 0
  );
  return task;
}

export async function updateTask(
  taskId: string,
  patch: Partial<{ title: string; dueDate: Date; assigneeId: string | null }>,
  actor: Actor | null,
  auto?: AutomationContext
) {
  const task = await prisma.task.findUnique({ where: { id: taskId } });
  if (!task) throw new NotFoundError("Tarefa não encontrada.");
  const card = await requireCard(task.cardId);

  await assertCompliance(
    "task.update",
    cardContext(card, {
      toList: card.list,
      task: {
        title: patch.title ?? task.title,
        dueDate: patch.dueDate === undefined ? task.dueDate : patch.dueDate,
        assigneeId: patch.assigneeId === undefined ? task.assigneeId : patch.assigneeId,
      },
    }),
    { cardId: card.id, actorId: actor?.id ?? null, action: { kind: "task.update", taskId } }
  );

  const updated = await prisma.task.update({ where: { id: taskId }, data: patch });
  await log(card.id, actor?.id ?? null, "task.updated", { title: task.title }, { title: updated.title }, auto);
  return updated;
}

export async function toggleTask(taskId: string, done: boolean, actor: Actor | null) {
  const task = await prisma.task.findUnique({ where: { id: taskId } });
  if (!task) throw new NotFoundError("Tarefa não encontrada.");
  const card = await requireCard(task.cardId);

  const updated = await prisma.task.update({
    where: { id: taskId },
    data: { done, completedAt: done ? new Date() : null },
  });
  await log(
    card.id,
    actor?.id ?? null,
    done ? "task.completed" : "task.reopened",
    null,
    { title: task.title }
  );
  if (done) {
    await dispatch({
      type: "task.completed",
      boardKey: card.board.key,
      cardId: card.id,
      actorId: actor?.id ?? null,
      taskId,
    });
  }
  return updated;
}

export async function deleteTask(taskId: string, actor: Actor | null) {
  const task = await prisma.task.findUnique({ where: { id: taskId } });
  if (!task) throw new NotFoundError("Tarefa não encontrada.");
  const card = await requireCard(task.cardId);
  if (actor && !canEditCard(actor.role, card.board.key === "sales" ? "opportunity" : "project", card, actor.id)) {
    throw new PermissionError("Você só remove tarefas de cards que pode editar.");
  }
  await prisma.task.delete({ where: { id: taskId } });
  await log(card.id, actor?.id ?? null, "task.deleted", { title: task.title }, null);
}

export async function reorderTasks(cardId: string, orderedIds: string[], actor: Actor | null) {
  await requireCard(cardId);
  await prisma.$transaction(
    orderedIds.map((id, i) =>
      prisma.task.update({ where: { id, cardId }, data: { position: (i + 1) * 1024 } })
    )
  );
  void actor;
}
