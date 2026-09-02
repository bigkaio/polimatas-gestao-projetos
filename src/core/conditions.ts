import type { ConditionGroup, ConditionRule } from "./rules";

/**
 * Contexto de avaliação: um mapa achatado de campos → valores primitivos.
 * Compartilhado pelos motores de automação e de compliance — a mesma regra
 * montada no construtor funciona nos dois (decisão da seção 5.3/5.4).
 */
export type EvalContext = Record<string, string | number | null | undefined>;

function isEmpty(v: unknown): boolean {
  return v === null || v === undefined || v === "";
}

export function evaluateRule(rule: ConditionRule, ctx: EvalContext): boolean {
  const actual = ctx[rule.field];
  switch (rule.operator) {
    case "is_empty":
      return isEmpty(actual);
    case "is_filled":
      return !isEmpty(actual);
    case "is":
      return String(actual ?? "") === String(rule.value ?? "");
    case "is_not":
      return String(actual ?? "") !== String(rule.value ?? "");
    case "contains":
      return String(actual ?? "")
        .toLowerCase()
        .includes(String(rule.value ?? "").toLowerCase());
    case "greater_than":
      return actual !== null && actual !== undefined && Number(actual) > Number(rule.value);
    case "less_than":
      return actual !== null && actual !== undefined && Number(actual) < Number(rule.value);
  }
}

export function evaluateGroup(group: ConditionGroup, ctx: EvalContext): boolean {
  if (group.rules.length === 0) return true;
  return group.op === "AND"
    ? group.rules.every((r) => evaluateRule(r, ctx))
    : group.rules.some((r) => evaluateRule(r, ctx));
}

/** Substitui {{campo}} pelos valores do contexto (mensagens e títulos). */
export function renderTemplate(template: string, ctx: EvalContext): string {
  return template.replace(/\{\{\s*([\w.]+)\s*\}\}/g, (_, key: string) => {
    const v = ctx[key];
    return v === null || v === undefined ? "" : String(v);
  });
}
