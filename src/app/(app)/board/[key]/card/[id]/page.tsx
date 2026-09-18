import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/auth";
import { canComment, canDeleteCard, canMutateBoard } from "@/core/permission-store";
import {
  CardDetail,
  type CardFullDTO,
  type CommentDTO,
  type ListOptionDTO,
  type TaskDTO,
} from "@/components/card/card-detail";

export const dynamic = "force-dynamic";

/** Detalhe do card com URL própria para compartilhar (US-09). */
export default async function CardPage({ params }: { params: { key: string; id: string } }) {
  const session = await requireSession();

  const card = await prisma.card.findUnique({
    where: { id: params.id },
    include: {
      list: true,
      board: true,
      assignee: { select: { id: true, name: true } },
      tasks: { orderBy: { position: "asc" }, include: { assignee: { select: { id: true, name: true } } } },
      sourceCard: { select: { id: true, title: true, board: { select: { key: true } } } },
      spawned: { select: { id: true, title: true, board: { select: { key: true } } } },
      comments: {
        orderBy: { createdAt: "asc" },
        include: { author: { select: { id: true, name: true } } },
      },
    },
  });
  if (!card || card.board.key !== params.key) notFound();

  const [users, lists, canMove, mayComment, mayDelete] = await Promise.all([
    prisma.profile.findMany({
      where: { deactivatedAt: null },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
    prisma.list.findMany({ where: { boardId: card.boardId }, orderBy: { position: "asc" } }),
    canMutateBoard(session.userId, card.type),
    canComment(session.userId),
    canDeleteCard(session.userId, card.type),
  ]);

  const dto: CardFullDTO = {
    id: card.id,
    boardKey: card.board.key,
    listId: card.listId,
    listName: card.list.name,
    type: card.type,
    title: card.title,
    description: card.description,
    assigneeId: card.assigneeId,
    dueDate: card.dueDate ? card.dueDate.toISOString().slice(0, 10) : null,
    clientName: card.clientName,
    clientEmail: card.clientEmail,
    clientPhone: card.clientPhone,
    leadSource: card.leadSource,
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

  const comments: CommentDTO[] = card.comments.map((c) => ({
    id: c.id,
    text: c.text,
    authorId: c.author.id,
    authorName: c.author.name,
    createdAt: c.createdAt.toISOString(),
    editedAt: c.editedAt ? c.editedAt.toISOString() : null,
  }));

  const listOptions: ListOptionDTO[] = lists.map((l) => ({
    id: l.id,
    name: l.name,
    stageKey: l.stageKey,
    semantics: l.semantics,
  }));

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-overlay/70 p-4 md:p-8">
      <Link
        href={`/board/${params.key}`}
        aria-label="Voltar ao quadro"
        className="fixed inset-0 -z-10 cursor-default"
      />
      <CardDetail
        card={dto}
        tasks={tasks}
        comments={comments}
        users={users}
        lists={listOptions}
        currentUser={{ id: session.userId, isAdmin: session.role === "admin" }}
        canMove={canMove}
        canComment={mayComment}
        canDelete={mayDelete}
      />
    </div>
  );
}
