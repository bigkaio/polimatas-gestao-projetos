"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/auth";
import { canManageCompliance } from "@/core/permissions";
import { complianceRuleSchema } from "@/core/rules";
import { toResult, type ActionResult } from "./result";

async function requireAdmin() {
  const session = await requireSession();
  return canManageCompliance(session.role) ? session : null;
}

export async function saveComplianceRuleAction(input: unknown): Promise<ActionResult<{ id: string }>> {
  const session = await requireAdmin();
  if (!session)
    return { ok: false, error: "Apenas admins gerenciam regras de compliance.", status: 403 };

  const parsed = z
    .object({ id: z.string().uuid().nullable(), rule: complianceRuleSchema })
    .safeParse(input);
  if (!parsed.success)
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Regra inválida.", status: 400 };

  const { id, rule } = parsed.data;
  try {
    if (id) {
      const existing = await prisma.complianceRule.findUnique({ where: { id } });
      if (!existing) return { ok: false, error: "Regra não encontrada.", status: 404 };
      if (existing.isSystem)
        return {
          ok: false,
          error: "As regras nativas do briefing são imutáveis — nem o admin as altera (seção 3.1).",
          status: 403,
        };
      await prisma.complianceRule.update({
        where: { id },
        data: {
          name: rule.name,
          scope: rule.scope,
          condition: rule.condition,
          message: rule.message,
          severity: rule.severity,
          enabled: rule.enabled,
        },
      });
      revalidatePath("/compliance");
      return { ok: true, data: { id } };
    }
    const created = await prisma.complianceRule.create({
      data: {
        key: `custom-${Date.now()}`,
        name: rule.name,
        scope: rule.scope,
        condition: rule.condition,
        message: rule.message,
        severity: rule.severity,
        enabled: rule.enabled,
      },
    });
    revalidatePath("/compliance");
    return { ok: true, data: { id: created.id } };
  } catch (err) {
    return toResult(err);
  }
}

export async function toggleComplianceRuleAction(input: unknown): Promise<ActionResult> {
  const session = await requireAdmin();
  if (!session)
    return { ok: false, error: "Apenas admins gerenciam regras de compliance.", status: 403 };
  const parsed = z.object({ id: z.string().uuid(), enabled: z.boolean() }).safeParse(input);
  if (!parsed.success) return { ok: false, error: "Dados inválidos.", status: 400 };
  const rule = await prisma.complianceRule.findUnique({ where: { id: parsed.data.id } });
  if (!rule) return { ok: false, error: "Regra não encontrada.", status: 404 };
  if (rule.isSystem && !parsed.data.enabled)
    return {
      ok: false,
      error: "Esta regra é obrigatória (briefing do desafio) e não pode ser desligada.",
      status: 403,
    };
  await prisma.complianceRule.update({
    where: { id: parsed.data.id },
    data: { enabled: parsed.data.enabled },
  });
  revalidatePath("/compliance");
  return { ok: true };
}
