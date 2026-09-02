"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/auth";
import { canManageAutomations } from "@/core/permissions";
import { automationSchema } from "@/core/rules";
import { runAutomation, type ActionOutcome } from "@/core/engine";
import { toResult, type ActionResult } from "./result";

async function requireManager() {
  const session = await requireSession();
  if (!canManageAutomations(session.role)) {
    return null;
  }
  return session;
}

export async function saveAutomationAction(input: unknown): Promise<ActionResult<{ id: string }>> {
  const session = await requireManager();
  if (!session)
    return { ok: false, error: "Apenas gestores e admins gerenciam automações.", status: 403 };

  const parsed = z
    .object({ id: z.string().uuid().nullable(), rule: automationSchema })
    .safeParse(input);
  if (!parsed.success)
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Regra inválida.", status: 400 };

  const { id, rule } = parsed.data;
  try {
    if (id) {
      const existing = await prisma.automation.findUnique({ where: { id } });
      if (!existing) return { ok: false, error: "Automação não encontrada.", status: 404 };
      // Regras nativas (is_system) são editáveis — destino, condições, ações —
      // mas o gatilho da integração venda→projeto permanece o documentado (US-21).
      await prisma.automation.update({
        where: { id },
        data: {
          name: rule.name,
          enabled: rule.enabled,
          trigger: existing.isSystem ? (existing.trigger as object) : rule.trigger,
          conditions: rule.conditions,
          actions: rule.actions,
        },
      });
      revalidatePath("/automations");
      return { ok: true, data: { id } };
    }
    const created = await prisma.automation.create({
      data: {
        name: rule.name,
        enabled: rule.enabled,
        trigger: rule.trigger,
        conditions: rule.conditions,
        actions: rule.actions,
        createdBy: session.userId,
      },
    });
    revalidatePath("/automations");
    return { ok: true, data: { id: created.id } };
  } catch (err) {
    return toResult(err);
  }
}

export async function toggleAutomationAction(input: unknown): Promise<ActionResult> {
  const session = await requireManager();
  if (!session)
    return { ok: false, error: "Apenas gestores e admins gerenciam automações.", status: 403 };
  const parsed = z.object({ id: z.string().uuid(), enabled: z.boolean() }).safeParse(input);
  if (!parsed.success) return { ok: false, error: "Dados inválidos.", status: 400 };
  await prisma.automation.update({
    where: { id: parsed.data.id },
    data: { enabled: parsed.data.enabled },
  });
  revalidatePath("/automations");
  return { ok: true };
}

export async function deleteAutomationAction(input: unknown): Promise<ActionResult> {
  const session = await requireManager();
  if (!session)
    return { ok: false, error: "Apenas gestores e admins gerenciam automações.", status: 403 };
  const parsed = z.object({ id: z.string().uuid() }).safeParse(input);
  if (!parsed.success) return { ok: false, error: "Dados inválidos.", status: 400 };
  const automation = await prisma.automation.findUnique({ where: { id: parsed.data.id } });
  if (!automation) return { ok: false, error: "Automação não encontrada.", status: 404 };
  if (automation.isSystem)
    return { ok: false, error: "Regras nativas do sistema não podem ser excluídas.", status: 403 };
  await prisma.automation.delete({ where: { id: parsed.data.id } });
  revalidatePath("/automations");
  return { ok: true };
}

export async function duplicateAutomationAction(input: unknown): Promise<ActionResult> {
  const session = await requireManager();
  if (!session)
    return { ok: false, error: "Apenas gestores e admins gerenciam automações.", status: 403 };
  const parsed = z.object({ id: z.string().uuid() }).safeParse(input);
  if (!parsed.success) return { ok: false, error: "Dados inválidos.", status: 400 };
  const automation = await prisma.automation.findUnique({ where: { id: parsed.data.id } });
  if (!automation) return { ok: false, error: "Automação não encontrada.", status: 404 };
  await prisma.automation.create({
    data: {
      name: `${automation.name} (cópia)`,
      enabled: false,
      isSystem: false,
      trigger: automation.trigger as object,
      conditions: automation.conditions as object,
      actions: automation.actions as object,
      createdBy: session.userId,
    },
  });
  revalidatePath("/automations");
  return { ok: true };
}

/** "Testar" (US-29): simula a regra contra um card e mostra o que SERIA feito. */
export async function testAutomationAction(
  input: unknown
): Promise<ActionResult<{ matched: boolean; outcomes: ActionOutcome[] }>> {
  const session = await requireManager();
  if (!session)
    return { ok: false, error: "Apenas gestores e admins testam automações.", status: 403 };
  const parsed = z.object({ id: z.string().uuid(), cardId: z.string().uuid() }).safeParse(input);
  if (!parsed.success) return { ok: false, error: "Dados inválidos.", status: 400 };

  const automation = await prisma.automation.findUnique({ where: { id: parsed.data.id } });
  const card = await prisma.card.findUnique({
    where: { id: parsed.data.cardId },
    include: { board: { select: { key: true } } },
  });
  if (!automation || !card) return { ok: false, error: "Automação ou card não encontrado.", status: 404 };

  const trigger = automation.trigger as { type?: string };
  const result = await runAutomation(
    automation,
    card.id,
    {
      type: (trigger.type ?? "card.moved") as never,
      boardKey: card.board.key,
      cardId: card.id,
      actorId: session.userId,
      toListId: card.listId,
    },
    0,
    { simulate: true }
  );
  return {
    ok: true,
    data: { matched: result.status !== "skipped", outcomes: result.outcomes },
  };
}
