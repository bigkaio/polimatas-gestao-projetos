import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";
import { evaluateGroup, renderTemplate, type EvalContext } from "./conditions";
import { conditionGroupSchema, type ComplianceScope } from "./rules";
import { ComplianceError } from "./errors";

export type GuardResult = {
  warnings: { ruleId: string; ruleName: string; message: string }[];
};

/**
 * ComplianceGuard (seção 5.4): avaliado ANTES de qualquer persistência.
 * Regras `block` violadas lançam ComplianceError (422) e nada é gravado;
 * regras `warn` são registradas e devolvidas como aviso.
 * Todo bloqueio/aviso vira uma linha em compliance_violations.
 */
export async function assertCompliance(
  scope: ComplianceScope,
  ctx: EvalContext,
  meta: { cardId?: string | null; actorId?: string | null; action: Prisma.InputJsonValue }
): Promise<GuardResult> {
  const rules = await prisma.complianceRule.findMany({ where: { enabled: true } });
  const applicable = rules.filter((r) =>
    r.scope.split(",").map((s) => s.trim()).includes(scope)
  );

  const blocked: { ruleId: string; ruleName: string; message: string }[] = [];
  const warnings: { ruleId: string; ruleName: string; message: string }[] = [];

  for (const rule of applicable) {
    const condition = conditionGroupSchema.safeParse(rule.condition);
    if (!condition.success) continue; // regra malformada nunca bloqueia por acidente
    if (!evaluateGroup(condition.data, ctx)) continue;

    const violation = {
      ruleId: rule.id,
      ruleName: rule.name,
      message: renderTemplate(rule.message, ctx),
    };
    await prisma.complianceViolation.create({
      data: {
        ruleId: rule.id,
        cardId: meta.cardId ?? null,
        actorId: meta.actorId ?? null,
        attemptedAction: meta.action,
      },
    });
    if (rule.severity === "block") blocked.push(violation);
    else warnings.push(violation);
  }

  if (blocked.length > 0) throw new ComplianceError(blocked);
  return { warnings };
}
