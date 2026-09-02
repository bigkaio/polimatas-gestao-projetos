"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireSession, sessionActor } from "@/lib/auth";
import * as domain from "@/core/domain";
import { toResult, type ActionResult } from "./result";

const dateField = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .transform((s) => new Date(`${s}T00:00:00Z`))
  .nullable()
  .optional();

/** Aceita moeda em formato brasileiro: "12.500,00" → "12500.00" (US-12). */
const amountField = z
  .string()
  .transform((s) => s.trim().replace(/\./g, "").replace(",", "."))
  .refine((s) => s === "" || /^\d+(\.\d{1,2})?$/.test(s), "Valor inválido — use formato como 12.500,00.")
  .transform((s) => (s === "" ? null : s))
  .nullable()
  .optional();

const createCardSchema = z.object({
  listId: z.string().uuid(),
  title: z.string().trim().min(1, "O título é obrigatório."),
  description: z.string().nullable().optional(),
  assigneeId: z.string().uuid().nullable().optional(),
  dueDate: dateField,
  clientName: z.string().nullable().optional(),
  clientEmail: z.string().email("E-mail do cliente inválido.").nullable().optional().or(z.literal("").transform(() => null)),
  clientPhone: z.string().nullable().optional(),
  amount: amountField,
});

export async function createCardAction(input: unknown): Promise<ActionResult<{ id: string }>> {
  const session = await requireSession();
  const parsed = createCardSchema.safeParse(input);
  if (!parsed.success)
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Dados inválidos.", status: 400 };

  try {
    const list = await prisma.list.findUnique({
      where: { id: parsed.data.listId },
      include: { board: true },
    });
    if (!list) return { ok: false, error: "Lista não encontrada.", status: 404 };
    if (list.board.type === "opportunity" && !parsed.data.clientName?.trim()) {
      return { ok: false, error: "O nome do cliente é obrigatório na oportunidade.", status: 400 };
    }
    const card = await domain.createCard(
      {
        boardId: list.boardId,
        listId: list.id,
        type: list.board.type,
        title: parsed.data.title,
        description: parsed.data.description ?? null,
        assigneeId: parsed.data.assigneeId ?? null,
        dueDate: parsed.data.dueDate ?? null,
        clientName: parsed.data.clientName?.trim() || null,
        clientEmail: parsed.data.clientEmail || null,
        clientPhone: parsed.data.clientPhone || null,
        amount: parsed.data.amount ?? null,
        createdBy: session.userId,
      },
      sessionActor(session)
    );
    revalidatePath("/board", "layout");
    return { ok: true, data: { id: card.id } };
  } catch (err) {
    return toResult(err);
  }
}

const updateCardSchema = z.object({
  cardId: z.string().uuid(),
  patch: z.object({
    title: z.string().trim().min(1, "O título é obrigatório.").optional(),
    description: z.string().nullable().optional(),
    assigneeId: z.string().uuid().nullable().optional(),
    dueDate: dateField,
    clientName: z.string().nullable().optional(),
    clientEmail: z.string().nullable().optional(),
    clientPhone: z.string().nullable().optional(),
    amount: amountField,
    lossReason: z.string().nullable().optional(),
  }),
});

export async function updateCardAction(input: unknown): Promise<ActionResult> {
  const session = await requireSession();
  const parsed = updateCardSchema.safeParse(input);
  if (!parsed.success)
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Dados inválidos.", status: 400 };
  try {
    await domain.updateCard(parsed.data.cardId, parsed.data.patch, sessionActor(session));
    revalidatePath("/board", "layout");
    return { ok: true };
  } catch (err) {
    return toResult(err);
  }
}

const moveCardSchema = z.object({
  cardId: z.string().uuid(),
  toListId: z.string().uuid(),
  index: z.number().int().min(0),
  /** Preenchido pela confirmação de fechamento (US-14). */
  lossReason: z.string().optional(),
});

export async function moveCardAction(input: unknown): Promise<ActionResult> {
  const session = await requireSession();
  const parsed = moveCardSchema.safeParse(input);
  if (!parsed.success)
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Dados inválidos.", status: 400 };
  try {
    if (parsed.data.lossReason?.trim()) {
      await domain.updateCard(
        parsed.data.cardId,
        { lossReason: parsed.data.lossReason.trim() },
        sessionActor(session)
      );
    }
    await domain.moveCard(
      parsed.data.cardId,
      { toListId: parsed.data.toListId, index: parsed.data.index },
      sessionActor(session)
    );
    revalidatePath("/board", "layout");
    return { ok: true };
  } catch (err) {
    return toResult(err);
  }
}
