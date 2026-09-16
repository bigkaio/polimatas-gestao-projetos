"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireSession, sessionActor } from "@/lib/auth";
import * as domain from "@/core/domain";
import { LIST_COLOR_KEYS } from "@/lib/colors";
import { toResult, type ActionResult } from "./result";

/** Colunas do quadro: criar, renomear, recolorir, reordenar e excluir. */

const colorField = z.enum(LIST_COLOR_KEYS as [string, ...string[]]).nullable().optional();
const nameField = z.string().trim().min(1, "Dê um nome à coluna.").max(40, "Nome muito longo.");

export async function createListAction(input: unknown): Promise<ActionResult<{ id: string }>> {
  const session = await requireSession();
  const parsed = z
    .object({ boardId: z.string().uuid(), name: nameField, color: colorField })
    .safeParse(input);
  if (!parsed.success)
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Dados inválidos.", status: 400 };

  try {
    const list = await domain.createList(
      parsed.data.boardId,
      { name: parsed.data.name, color: parsed.data.color ?? null },
      sessionActor(session)
    );
    revalidatePath("/board", "layout");
    return { ok: true, data: { id: list.id } };
  } catch (err) {
    return toResult(err);
  }
}

export async function updateListAction(input: unknown): Promise<ActionResult> {
  const session = await requireSession();
  const parsed = z
    .object({ listId: z.string().uuid(), name: nameField.optional(), color: colorField })
    .safeParse(input);
  if (!parsed.success)
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Dados inválidos.", status: 400 };

  try {
    await domain.updateList(
      parsed.data.listId,
      { name: parsed.data.name, color: parsed.data.color },
      sessionActor(session)
    );
    revalidatePath("/board", "layout");
    return { ok: true };
  } catch (err) {
    return toResult(err);
  }
}

export async function deleteListAction(input: unknown): Promise<ActionResult> {
  const session = await requireSession();
  const parsed = z
    .object({ listId: z.string().uuid(), moveToListId: z.string().uuid().nullable().optional() })
    .safeParse(input);
  if (!parsed.success) return { ok: false, error: "Dados inválidos.", status: 400 };

  try {
    await domain.deleteList(
      parsed.data.listId,
      parsed.data.moveToListId ?? null,
      sessionActor(session)
    );
    revalidatePath("/board", "layout");
    return { ok: true };
  } catch (err) {
    return toResult(err);
  }
}

export async function reorderListsAction(input: unknown): Promise<ActionResult> {
  const session = await requireSession();
  const parsed = z
    .object({ boardId: z.string().uuid(), orderedIds: z.array(z.string().uuid()).min(1) })
    .safeParse(input);
  if (!parsed.success) return { ok: false, error: "Dados inválidos.", status: 400 };

  try {
    await domain.reorderLists(parsed.data.boardId, parsed.data.orderedIds, sessionActor(session));
    revalidatePath("/board", "layout");
    return { ok: true };
  } catch (err) {
    return toResult(err);
  }
}
