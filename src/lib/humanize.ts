import type { AutomationAction, ConditionGroup, Trigger } from "@/core/rules";

/** Tradução das regras para linguagem natural (US-24/US-25). */

export type ListRef = { stageKey: string; name: string; boardKey: string };

const FIELD_LABELS: Record<string, string> = {
  "card.type": "o tipo do card",
  "card.list": "a lista do card",
  "card.title": "o título",
  "card.assignee": "o responsável",
  "card.due_date": "o prazo",
  "card.amount": "o valor",
  "card.client_name": "o cliente",
  "card.loss_reason": "o motivo de perda",
  "card.open_tasks": "a quantidade de tarefas abertas",
  from_list: "a lista de origem",
  to_list: "a lista de destino",
  "to_list.semantics": "o tipo da lista de destino",
  "task.title": "o título da tarefa",
  "task.due_date": "o prazo da tarefa",
  "task.assignee": "o responsável da tarefa",
};

const OPERATOR_LABELS: Record<string, string> = {
  is: "for",
  is_not: "não for",
  contains: "contiver",
  greater_than: "for maior que",
  less_than: "for menor que",
  is_empty: "estiver vazio",
  is_filled: "estiver preenchido",
};

export function fieldLabel(field: string): string {
  return FIELD_LABELS[field] ?? field;
}

export function operatorLabel(op: string): string {
  return OPERATOR_LABELS[op] ?? op;
}

function listName(stageKey: string | undefined, lists: ListRef[]): string {
  if (!stageKey) return "";
  return lists.find((l) => l.stageKey === stageKey)?.name ?? stageKey;
}

function boardName(key?: string): string {
  if (key === "sales") return "no Pipeline de Vendas";
  if (key === "projects") return "no Pipeline de Projetos";
  return "";
}

export function humanizeTrigger(trigger: Trigger, lists: ListRef[]): string {
  const board = boardName(trigger.board);
  switch (trigger.type) {
    case "card.created":
      return `Quando um card for criado ${board}`.trim();
    case "card.moved":
      return trigger.to_list
        ? `Quando um card entrar em ${listName(trigger.to_list, lists)} ${board}`.trim()
        : `Quando um card mudar de lista ${board}`.trim();
    case "card.field_changed":
      return `Quando ${fieldLabel(trigger.field ?? "um campo")} do card mudar ${board}`.trim();
    case "task.created":
      return `Quando uma tarefa for adicionada ao checklist ${board}`.trim();
    case "task.completed":
      return `Quando uma tarefa for concluída ${board}`.trim();
    case "card.due_soon":
      return `Quando faltarem ${trigger.days ?? 2} dia(s) para o prazo do card ${board}`.trim();
    case "card.overdue":
      return `Quando o prazo do card passar ${board}`.trim();
    case "task.overdue":
      return `Quando o prazo de uma tarefa passar ${board}`.trim();
  }
}

export function humanizeConditions(
  conditions: ConditionGroup,
  lists: ListRef[],
  users: { id: string; name: string }[]
): string {
  if (conditions.rules.length === 0) return "";
  const parts = conditions.rules.map((r) => {
    let value = r.value === undefined ? "" : String(r.value);
    if ((r.field === "to_list" || r.field === "from_list" || r.field === "card.list") && value)
      value = listName(value, lists);
    if ((r.field === "card.assignee" || r.field === "task.assignee") && value)
      value = users.find((u) => u.id === value)?.name ?? value;
    const op = operatorLabel(r.operator);
    return r.operator === "is_empty" || r.operator === "is_filled"
      ? `${fieldLabel(r.field)} ${op}`
      : `${fieldLabel(r.field)} ${op} "${value}"`;
  });
  return `se ${parts.join(conditions.op === "AND" ? " e " : " ou ")}`;
}

export function humanizeAction(
  action: AutomationAction,
  lists: ListRef[],
  users: { id: string; name: string }[]
): string {
  switch (action.type) {
    case "notify_user": {
      const target =
        action.target === "assignee"
          ? "o responsável"
          : action.target === "creator"
            ? "quem criou o card"
            : action.target === "all"
              ? "todos os usuários"
              : (users.find((u) => u.id === action.user_id)?.name ?? "um usuário");
      return `notificar ${target}`;
    }
    case "move_card":
      return `mover o card para ${listName(action.target_list, lists)}`;
    case "assign_user":
      return `definir ${users.find((u) => u.id === action.user_id)?.name ?? "um usuário"} como responsável`;
    case "set_due_date":
      return action.mode === "fixed"
        ? `definir o prazo para ${action.date ?? ""}`
        : `definir o prazo para hoje + ${action.days ?? 0} dia(s)`;
    case "add_task":
      return `adicionar a tarefa "${action.title}" ao checklist`;
    case "add_comment":
      return "registrar um comentário no card";
    case "create_project_card":
      return `criar um card no Pipeline de Projetos (${listName(action.target_list, lists)})`;
    case "set_field":
      return `alterar o campo ${action.field}`;
  }
}

export function humanizeRule(
  trigger: Trigger,
  conditions: ConditionGroup,
  actions: AutomationAction[],
  lists: ListRef[],
  users: { id: string; name: string }[]
): string {
  const t = humanizeTrigger(trigger, lists);
  const c = humanizeConditions(conditions, lists, users);
  const a = actions.map((x) => humanizeAction(x, lists, users)).join("; depois, ");
  return `${t}${c ? `, ${c}` : ""}, então ${a || "…"}.`;
}
