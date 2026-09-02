"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireSession, sessionActor } from "@/lib/auth";
import * as domain from "@/core/domain";
import { toResult, type ActionResult } from "./result";

const createTaskSchema = z.object({
  cardId: z.string().uuid(),
  title: z.string().trim().min(1, "Escreva o título da tarefa."),
  dueDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .transform((s) => new Date(`${s}T00:00:00Z`))
    .nullable(),
  assigneeId: z.string().uuid().nullable().optional(),
});

export async function createTaskAction(input: unknown): Promise<ActionResult<{ id: string }>> {
  const session = await requireSession();
  const parsed = createTaskSchema.safeParse(input);
  if (!parsed.success)
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Dados inválidos.", status: 400 };
  try {
    const task = await domain.createTask(
      parsed.data.cardId,
      { title: parsed.data.title, dueDate: parsed.data.dueDate, assigneeId: parsed.data.assigneeId ?? null },
      sessionActor(session)
    );
    revalidatePath("/board", "layout");
    return { ok: true, data: { id: task.id } };
  } catch (err) {
    return toResult(err);
  }
}

export async function toggleTaskAction(input: unknown): Promise<ActionResult> {
  const session = await requireSession();
  const parsed = z.object({ taskId: z.string().uuid(), done: z.boolean() }).safeParse(input);
  if (!parsed.success) return { ok: false, error: "Dados inválidos.", status: 400 };
  try {
    await domain.toggleTask(parsed.data.taskId, parsed.data.done, sessionActor(session));
    revalidatePath("/board", "layout");
    return { ok: true };
  } catch (err) {
    return toResult(err);
  }
}

export async function updateTaskAction(input: unknown): Promise<ActionResult> {
  const session = await requireSession();
  const parsed = z
    .object({
      taskId: z.string().uuid(),
      title: z.string().trim().min(1).optional(),
      dueDate: z
        .string()
        .regex(/^\d{4}-\d{2}-\d{2}$/)
        .transform((s) => new Date(`${s}T00:00:00Z`))
        .optional(),
      assigneeId: z.string().uuid().nullable().optional(),
    })
    .safeParse(input);
  if (!parsed.success) return { ok: false, error: "Dados inválidos.", status: 400 };
  try {
    const { taskId, ...patch } = parsed.data;
    await domain.updateTask(taskId, patch, sessionActor(session));
    revalidatePath("/board", "layout");
    return { ok: true };
  } catch (err) {
    return toResult(err);
  }
}

export async function deleteTaskAction(input: unknown): Promise<ActionResult> {
  const session = await requireSession();
  const parsed = z.object({ taskId: z.string().uuid() }).safeParse(input);
  if (!parsed.success) return { ok: false, error: "Dados inválidos.", status: 400 };
  try {
    await domain.deleteTask(parsed.data.taskId, sessionActor(session));
    revalidatePath("/board", "layout");
    return { ok: true };
  } catch (err) {
    return toResult(err);
  }
}

export async function reorderTasksAction(input: unknown): Promise<ActionResult> {
  const session = await requireSession();
  const parsed = z
    .object({ cardId: z.string().uuid(), orderedIds: z.array(z.string().uuid()) })
    .safeParse(input);
  if (!parsed.success) return { ok: false, error: "Dados inválidos.", status: 400 };
  try {
    await domain.reorderTasks(parsed.data.cardId, parsed.data.orderedIds, sessionActor(session));
    revalidatePath("/board", "layout");
    return { ok: true };
  } catch (err) {
    return toResult(err);
  }
}
