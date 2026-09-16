"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireSession, sessionActor } from "@/lib/auth";
import * as domain from "@/core/domain";
import { toResult, type ActionResult } from "./result";

/** Comentários do card (escrever, editar e remover). */

const MAX = 2000;

export async function createCommentAction(input: unknown): Promise<ActionResult<{ id: string }>> {
  const session = await requireSession();
  const parsed = z
    .object({
      cardId: z.string().uuid(),
      text: z.string().trim().min(1, "Escreva algo antes de comentar.").max(MAX),
    })
    .safeParse(input);
  if (!parsed.success)
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Dados inválidos.", status: 400 };

  try {
    const comment = await domain.createComment(
      parsed.data.cardId,
      parsed.data.text,
      sessionActor(session)
    );
    revalidatePath("/board", "layout");
    return { ok: true, data: { id: comment.id } };
  } catch (err) {
    return toResult(err);
  }
}

export async function updateCommentAction(input: unknown): Promise<ActionResult> {
  const session = await requireSession();
  const parsed = z
    .object({
      commentId: z.string().uuid(),
      text: z.string().trim().min(1, "O comentário não pode ficar vazio.").max(MAX),
    })
    .safeParse(input);
  if (!parsed.success)
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Dados inválidos.", status: 400 };

  try {
    await domain.updateComment(parsed.data.commentId, parsed.data.text, sessionActor(session));
    revalidatePath("/board", "layout");
    return { ok: true };
  } catch (err) {
    return toResult(err);
  }
}

export async function deleteCommentAction(input: unknown): Promise<ActionResult> {
  const session = await requireSession();
  const parsed = z.object({ commentId: z.string().uuid() }).safeParse(input);
  if (!parsed.success) return { ok: false, error: "Dados inválidos.", status: 400 };

  try {
    await domain.deleteComment(parsed.data.commentId, sessionActor(session));
    revalidatePath("/board", "layout");
    return { ok: true };
  } catch (err) {
    return toResult(err);
  }
}
