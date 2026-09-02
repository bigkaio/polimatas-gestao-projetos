import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/auth";
import { CardDetail, type ActivityDTO, type CardFullDTO, type TaskDTO } from "@/components/card/card-detail";

export const dynamic = "force-dynamic";

/** Detalhe do card com URL própria para compartilhar (US-09). */
export default async function CardPage({ params }: { params: { key: string; id: string } }) {
  await requireSession();

  const card = await prisma.card.findUnique({
    where: { id: params.id },
    include: {
      list: true,
      board: true,
      assignee: { select: { id: true, name: true } },
      tasks: { orderBy: { position: "asc" }, include: { assignee: { select: { id: true, name: true } } } },
      sourceCard: { select: { id: true, title: true, board: { select: { key: true } } } },
      spawned: { select: { id: true, title: true, board: { select: { key: true } } } },
      activities: {
        orderBy: { createdAt: "desc" },
        take: 40,
        include: { actor: { select: { name: true } } },
      },
    },
  });
  if (!card || card.board.key !== params.key) notFound();

  const users = await prisma.profile.findMany({
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });

  const dto: CardFullDTO = {
    id: card.id,
    boardKey: card.board.key,
    listName: card.list.name,
    type: card.type,
    title: card.title,
    description: card.description,
    assigneeId: card.assigneeId,
    dueDate: card.dueDate ? card.dueDate.toISOString().slice(0, 10) : null,
    clientName: card.clientName,
    clientEmail: card.clientEmail,
    clientPhone: card.clientPhone,
    amount: card.amount === null ? null : String(card.amount),
    lossReason: card.lossReason,
    source: card.sourceCard
      ? { id: card.sourceCard.id, title: card.sourceCard.title, boardKey: card.sourceCard.board.key }
      : null,
    spawned: card.spawned
      ? { id: card.spawned.id, title: card.spawned.title, boardKey: card.spawned.board.key }
      : null,
  };

  const tasks: TaskDTO[] = card.tasks.map((t) => ({
    id: t.id,
    title: t.title,
    done: t.done,
    dueDate: t.dueDate.toISOString().slice(0, 10),
    assignee: t.assignee,
  }));

  const activities: ActivityDTO[] = card.activities.map((a) => ({
    id: a.id,
    action: a.action,
    actorName: a.actor?.name ?? null,
    automationName:
      a.after && typeof a.after === "object" && "automation" in (a.after as object)
        ? String((a.after as Record<string, unknown>).automation)
        : null,
    detail: a.after ? JSON.stringify(a.after) : null,
    createdAt: a.createdAt.toISOString(),
  }));

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/40 p-4 md:p-8">
      <Link
        href={`/board/${params.key}`}
        aria-label="Voltar ao quadro"
        className="fixed inset-0 -z-10 cursor-default"
      />
      <CardDetail card={dto} tasks={tasks} activities={activities} users={users} />
    </div>
  );
}
