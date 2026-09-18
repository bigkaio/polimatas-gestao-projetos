import type { Card, List, Task } from "@prisma/client";
import type { EvalContext } from "./conditions";
import { brl, dateBR } from "@/lib/format";

type CardWithRelations = Card & {
  list?: List | null;
  tasks?: Pick<Task, "done">[];
  assignee?: { name: string } | null;
};

function dateStr(d: Date | null | undefined): string | null {
  return d ? d.toISOString().slice(0, 10) : null;
}

/** Data para mensagens: 07/11/2026. Nas condições vale a forma ISO, comparável. */
function dateStrBR(d: Date | null | undefined): string | null {
  return d ? dateBR(d) : null;
}

/**
 * Achata o card num contexto de avaliação — os campos disponíveis nos
 * seletores do construtor de regras (seções 5.3 e 5.4).
 */
export function cardContext(
  card: CardWithRelations,
  extra: {
    fromList?: List | null;
    toList?: List | null;
    task?:
      | (Pick<Task, "title" | "dueDate" | "assigneeId"> & { assignee?: { name: string } | null })
      | null;
    openTasks?: number;
  } = {},
): EvalContext {
  const openTasks =
    extra.openTasks ?? (card.tasks ? card.tasks.filter((t) => !t.done).length : undefined);
  return {
    "card.type": card.type,
    "card.list": extra.toList?.stageKey ?? card.list?.stageKey ?? null,
    "card.title": card.title,
    // `assignee` é o id (as condições comparam pessoas por id); para mensagens
    // existe o `_name`, que é o que alguém espera ler num WhatsApp.
    "card.assignee": card.assigneeId,
    "card.assignee_name": card.assignee?.name ?? null,
    "card.due_date": dateStr(card.dueDate),
    "card.due_date_br": dateStrBR(card.dueDate),
    "card.amount": card.amount === null || card.amount === undefined ? null : Number(card.amount),
    // Valor já formatado para mensagens ("R$ 88.000,00"); vazio quando não há valor.
    "card.amount_brl":
      card.amount === null || card.amount === undefined ? null : brl(String(card.amount)),
    "card.client_name": card.clientName,
    "card.lead_source": card.leadSource,
    "card.loss_reason": card.lossReason,
    "card.open_tasks": openTasks ?? 0,
    open_tasks: openTasks ?? 0,
    from_list: extra.fromList?.stageKey ?? null,
    to_list: extra.toList?.stageKey ?? null,
    "to_list.semantics": extra.toList?.semantics ?? null,
    "task.title": extra.task?.title ?? null,
    "task.due_date": dateStr(extra.task?.dueDate ?? null),
    "task.due_date_br": dateStrBR(extra.task?.dueDate ?? null),
    "task.assignee": extra.task?.assigneeId ?? null,
    "task.assignee_name": extra.task?.assignee?.name ?? null,
    client_name: card.clientName,
  };
}
