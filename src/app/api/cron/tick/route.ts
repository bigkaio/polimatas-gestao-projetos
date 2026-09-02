import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { runAutomation } from "@/core/engine";
import { triggerSchema } from "@/core/rules";

export const dynamic = "force-dynamic";

/**
 * Gatilhos temporais (US-27, ADR-06): o Vercel Cron chama este endpoint a
 * cada 15 minutos. Avalia card.overdue, task.overdue e card.due_soon.
 * Idempotência diária por (automation_id, card_id, event_key) — o mesmo
 * atraso não dispara a mesma regra duas vezes.
 */
export async function GET(request: NextRequest) {
  const auth = request.headers.get("authorization");
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const today = new Date();
  const todayKey = today.toISOString().slice(0, 10);
  const startOfToday = new Date(`${todayKey}T00:00:00Z`);

  const automations = await prisma.automation.findMany({ where: { enabled: true } });
  const temporal = automations
    .map((a) => ({ automation: a, trigger: triggerSchema.safeParse(a.trigger) }))
    .filter((x) => x.trigger.success)
    .map((x) => ({ automation: x.automation, trigger: x.trigger.data! }))
    .filter((x) => ["card.overdue", "card.due_soon", "task.overdue"].includes(x.trigger.type));

  let fired = 0;

  for (const { automation, trigger } of temporal) {
    const boardFilter = trigger.board ? { board: { key: trigger.board } } : {};

    if (trigger.type === "card.overdue" || trigger.type === "card.due_soon") {
      const dueFilter =
        trigger.type === "card.overdue"
          ? { lt: startOfToday }
          : {
              gte: new Date(startOfToday.getTime() + (trigger.days ?? 2) * 86_400_000),
              lt: new Date(startOfToday.getTime() + ((trigger.days ?? 2) + 1) * 86_400_000),
            };
      const cards = await prisma.card.findMany({
        where: {
          archivedAt: null,
          dueDate: dueFilter,
          list: { isTerminal: false },
          ...boardFilter,
        },
        include: { board: { select: { key: true } } },
      });
      for (const card of cards) {
        const result = await runAutomation(automation, card.id, {
          type: trigger.type,
          boardKey: card.board.key,
          cardId: card.id,
          actorId: null,
          eventKey: `${trigger.type}:${card.id}:${todayKey}`,
        });
        if (result.status !== "skipped") fired += 1;
      }
    }

    if (trigger.type === "task.overdue") {
      const tasks = await prisma.task.findMany({
        where: {
          done: false,
          dueDate: { lt: startOfToday },
          card: { archivedAt: null, list: { isTerminal: false }, ...boardFilter },
        },
        include: { card: { include: { board: { select: { key: true } } } } },
      });
      for (const task of tasks) {
        const result = await runAutomation(automation, task.card.id, {
          type: "task.overdue",
          boardKey: task.card.board.key,
          cardId: task.card.id,
          actorId: null,
          taskId: task.id,
          eventKey: `task.overdue:${task.id}:${todayKey}`,
        });
        if (result.status !== "skipped") fired += 1;
      }
    }
  }

  return NextResponse.json({ ok: true, fired, at: today.toISOString() });
}
