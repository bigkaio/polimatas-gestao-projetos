import { describe, expect, it } from "vitest";
import { evaluateGroup, renderTemplate } from "@/core/conditions";

describe("avaliador de condições (compartilhado pelos dois motores)", () => {
  const ctx = {
    "card.type": "opportunity",
    "card.amount": 5000,
    "card.assignee": null,
    "card.title": "Portal do aluno",
    "card.open_tasks": 2,
  };

  it("operadores básicos", () => {
    expect(evaluateGroup({ op: "AND", rules: [{ field: "card.type", operator: "is", value: "opportunity" }] }, ctx)).toBe(true);
    expect(evaluateGroup({ op: "AND", rules: [{ field: "card.type", operator: "is_not", value: "project" }] }, ctx)).toBe(true);
    expect(evaluateGroup({ op: "AND", rules: [{ field: "card.title", operator: "contains", value: "aluno" }] }, ctx)).toBe(true);
    expect(evaluateGroup({ op: "AND", rules: [{ field: "card.amount", operator: "greater_than", value: 4999 }] }, ctx)).toBe(true);
    expect(evaluateGroup({ op: "AND", rules: [{ field: "card.amount", operator: "less_than", value: 4999 }] }, ctx)).toBe(false);
    expect(evaluateGroup({ op: "AND", rules: [{ field: "card.assignee", operator: "is_empty" }] }, ctx)).toBe(true);
    expect(evaluateGroup({ op: "AND", rules: [{ field: "card.assignee", operator: "is_filled" }] }, ctx)).toBe(false);
  });

  it("combinação E/OU", () => {
    const and = {
      op: "AND" as const,
      rules: [
        { field: "card.type" as const, operator: "is" as const, value: "opportunity" },
        { field: "card.assignee" as const, operator: "is_filled" as const },
      ],
    };
    const or = { ...and, op: "OR" as const };
    expect(evaluateGroup(and, ctx)).toBe(false);
    expect(evaluateGroup(or, ctx)).toBe(true);
  });

  it("grupo vazio sempre passa (regra sem condições)", () => {
    expect(evaluateGroup({ op: "AND", rules: [] }, ctx)).toBe(true);
  });

  it("templates {{campo}}", () => {
    expect(renderTemplate("Projeto de {{card.title}} tem {{card.open_tasks}} pendências", ctx)).toBe(
      "Projeto de Portal do aluno tem 2 pendências"
    );
  });
});
