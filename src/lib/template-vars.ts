/**
 * Catálogo das variáveis `{{...}}` que valem nas mensagens das automações —
 * a mesma lista alimenta os botões do construtor, a pré-visualização e o aviso
 * de variável inexistente. As chaves têm de bater com `cardContext`
 * (`src/core/context.ts`): é de lá que vêm os valores na hora do envio.
 */

export type TemplateVar = {
  key: string;
  /** Rótulo curto do botão. */
  label: string;
  /** Valor de exemplo, usado quando o card de amostra não tem o campo. */
  sample: string;
  group: "card" | "cliente" | "tarefa";
};

export const TEMPLATE_VARS: TemplateVar[] = [
  { key: "card.title", label: "Título", sample: "E-commerce B2B", group: "card" },
  { key: "card.assignee_name", label: "Responsável", sample: "Valentina Vendas", group: "card" },
  { key: "card.due_date_br", label: "Prazo", sample: "07/11/2026", group: "card" },
  { key: "card.list", label: "Coluna", sample: "negociacao", group: "card" },
  { key: "card.open_tasks", label: "Tarefas abertas", sample: "2", group: "card" },
  {
    key: "card.loss_reason",
    label: "Motivo da perda",
    sample: "preço acima do orçamento",
    group: "card",
  },

  { key: "card.client_name", label: "Cliente", sample: "Distribuidora Norte", group: "cliente" },
  { key: "card.amount_brl", label: "Valor (R$)", sample: "R$ 65.000,00", group: "cliente" },
  { key: "card.lead_source", label: "Origem do lead", sample: "Indicação", group: "cliente" },

  { key: "task.title", label: "Tarefa", sample: "Enviar proposta", group: "tarefa" },
  { key: "task.due_date_br", label: "Prazo da tarefa", sample: "20/09/2026", group: "tarefa" },
  {
    key: "task.assignee_name",
    label: "Responsável da tarefa",
    sample: "Enzo Executor",
    group: "tarefa",
  },
];

/**
 * Chaves aceitas em silêncio, fora dos botões: formas antigas (regras já
 * gravadas) e variantes cruas que continuam funcionando.
 */
const EXTRA_KNOWN_KEYS = [
  "client_name",
  "open_tasks",
  "card.type",
  "card.assignee",
  "card.due_date",
  "card.amount",
  "from_list",
  "to_list",
  "to_list.semantics",
  "task.due_date",
  "task.assignee",
];

const KNOWN = new Set([...TEMPLATE_VARS.map((v) => v.key), ...EXTRA_KNOWN_KEYS]);

/** Mesma expressão do motor (`renderTemplate`). */
const VAR_PATTERN = /\{\{\s*([\w.]+)\s*\}\}/g;

/** Variáveis escritas no texto que não existem — viram vazio no envio. */
export function unknownVars(text: string): string[] {
  const found = [...text.matchAll(VAR_PATTERN)].map((m) => m[1]!);
  return [...new Set(found.filter((k) => !KNOWN.has(k)))];
}

export type SampleCard = {
  title: string;
  clientName: string | null;
  amountBRL: string | null;
  dueDateBR: string | null;
  leadSource: string | null;
  assigneeName: string | null;
  listName: string | null;
  openTasks: number;
};

/** Valores da pré-visualização: o card real quando há um, o exemplo quando não. */
export function previewValues(card: SampleCard | null): Record<string, string> {
  const fallback = Object.fromEntries(TEMPLATE_VARS.map((v) => [v.key, v.sample]));
  if (!card) return { ...fallback, client_name: fallback["card.client_name"]! };

  const filled: Record<string, string | null> = {
    "card.title": card.title,
    "card.client_name": card.clientName,
    "card.amount_brl": card.amountBRL,
    "card.due_date_br": card.dueDateBR,
    "card.lead_source": card.leadSource,
    "card.assignee_name": card.assigneeName,
    "card.list": card.listName,
    "card.open_tasks": String(card.openTasks),
  };
  const values = { ...fallback };
  for (const [key, value] of Object.entries(filled)) if (value) values[key] = value;
  values["client_name"] = values["card.client_name"]!;
  return values;
}

/** Como a mensagem sai, com as variáveis já trocadas. */
export function renderPreview(text: string, values: Record<string, string>): string {
  return text.replace(VAR_PATTERN, (_, key: string) => values[key] ?? "");
}
