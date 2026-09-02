import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/auth";
import { canMutateBoard } from "@/core/permissions";
import type { BoardDTO, CardDTO, FunnelStats, UserDTO } from "@/lib/dto";
import { BoardView } from "@/components/board/board-view";

export const dynamic = "force-dynamic";

export default async function BoardPage({ params }: { params: { key: string } }) {
  const session = await requireSession();
  if (params.key !== "sales" && params.key !== "projects") notFound();

  const board = await prisma.board.findUnique({
    where: { key: params.key },
    include: { lists: { orderBy: { position: "asc" } } },
  });
  if (!board) notFound();

  const cards = await prisma.card.findMany({
    where: { boardId: board.id, archivedAt: null },
    orderBy: { position: "asc" },
    include: {
      assignee: { select: { id: true, name: true } },
      tasks: { select: { done: true } },
      spawned: { select: { id: true } },
    },
  });

  const users: UserDTO[] = await prisma.profile.findMany({
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });

  const boardDTO: BoardDTO = {
    id: board.id,
    key: board.key,
    name: board.name,
    lists: board.lists.map((l) => ({
      id: l.id,
      name: l.name,
      stageKey: l.stageKey,
      isTerminal: l.isTerminal,
      semantics: l.semantics,
    })),
  };

  const cardDTOs: CardDTO[] = cards.map((c) => ({
    id: c.id,
    title: c.title,
    type: c.type,
    listId: c.listId,
    position: c.position,
    assignee: c.assignee,
    dueDate: c.dueDate ? c.dueDate.toISOString().slice(0, 10) : null,
    amount: c.amount === null ? null : String(c.amount),
    clientName: c.clientName,
    lossReason: c.lossReason,
    sourceCardId: c.sourceCardId,
    hasSpawned: c.spawned !== null,
    tasksTotal: c.tasks.length,
    tasksDone: c.tasks.filter((t) => t.done).length,
  }));

  // Indicadores do funil (US-15)
  let funnel: FunnelStats = null;
  if (board.key === "sales") {
    const monthStart = new Date();
    monthStart.setUTCDate(1);
    monthStart.setUTCHours(0, 0, 0, 0);
    const [open, won, wonCount, lostCount] = await Promise.all([
      prisma.card.aggregate({
        _sum: { amount: true },
        where: { boardId: board.id, archivedAt: null, list: { isTerminal: false } },
      }),
      prisma.card.aggregate({
        _sum: { amount: true },
        where: {
          boardId: board.id,
          archivedAt: null,
          list: { semantics: "won" },
          updatedAt: { gte: monthStart },
        },
      }),
      prisma.card.count({ where: { boardId: board.id, list: { semantics: "won" } } }),
      prisma.card.count({ where: { boardId: board.id, list: { semantics: "lost" } } }),
    ]);
    funnel = {
      openTotal: open._sum.amount?.toString() ?? "0",
      wonThisMonth: won._sum.amount?.toString() ?? "0",
      conversion: wonCount + lostCount > 0 ? Math.round((wonCount / (wonCount + lostCount)) * 100) : null,
    };
  }

  return (
    <BoardView
      board={boardDTO}
      initialCards={cardDTOs}
      users={users}
      funnel={funnel}
      canMutate={canMutateBoard(session.role, board.type)}
      currentUserId={session.userId}
    />
  );
}
