import type { Card, List, Task } from "@prisma/client";
import type { EvalContext } from "./conditions";

type CardWithRelations = Card & {
  list?: List | null;
  tasks?: Pick<Task, "done">[];
};

function dateStr(d: Date | null | undefined): string | null {
  return d ? d.toISOString().slice(0, 10) : null;
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
    task?: Pick<Task, "title" | "dueDate" | "assigneeId"> | null;
    openTasks?: number;
  } = {}
): EvalContext {
  const openTasks =
    extra.openTasks ?? (card.tasks ? card.tasks.filter((t) => !t.done).length : undefined);
  return {
    "card.type": card.type,
    "card.list": extra.toList?.stageKey ?? card.list?.stageKey ?? null,
    "card.title": card.title,
    "card.assignee": card.assigneeId,
    "card.due_date": dateStr(card.dueDate),
    "card.amount": card.amount === null || card.amount === undefined ? null : Number(card.amount),
    "card.client_name": card.clientName,
    "card.loss_reason": card.lossReason,
    "card.open_tasks": openTasks ?? 0,
    open_tasks: openTasks ?? 0,
    from_list: extra.fromList?.stageKey ?? null,
    to_list: extra.toList?.stageKey ?? null,
    "to_list.semantics": extra.toList?.semantics ?? null,
    "task.title": extra.task?.title ?? null,
    "task.due_date": dateStr(extra.task?.dueDate ?? null),
    "task.assignee": extra.task?.assigneeId ?? null,
    client_name: card.clientName,
  };
}
