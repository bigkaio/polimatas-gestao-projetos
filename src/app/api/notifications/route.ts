import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";

export const dynamic = "force-dynamic";

/** Alimenta o sino (US-35) por polling — adaptação sem Supabase Realtime. */
export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const notifications = await prisma.notification.findMany({
    where: { userId: session.userId },
    orderBy: { createdAt: "desc" },
    take: 30,
    include: { card: { select: { id: true, title: true, board: { select: { key: true } } } } },
  });
  const unread = await prisma.notification.count({
    where: { userId: session.userId, readAt: null },
  });
  return NextResponse.json({
    unread,
    notifications: notifications.map((n) => ({
      id: n.id,
      message: n.message,
      readAt: n.readAt,
      createdAt: n.createdAt,
      card: n.card ? { id: n.card.id, title: n.card.title, boardKey: n.card.board.key } : null,
    })),
  });
}
