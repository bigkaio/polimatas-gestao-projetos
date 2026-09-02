import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/auth";
import { canManageAutomations } from "@/core/permissions";
import type { ListRef } from "@/lib/humanize";
import { AutomationsPage } from "@/components/automations/automations-page";

export const dynamic = "force-dynamic";

export default async function Page() {
  const session = await requireSession();

  const [automations, lists, users, cards] = await Promise.all([
    prisma.automation.findMany({
      orderBy: [{ isSystem: "desc" }, { name: "asc" }],
      include: { _count: { select: { runs: true } } },
    }),
    prisma.list.findMany({ include: { board: { select: { key: true } } } }),
    prisma.profile.findMany({ select: { id: true, name: true }, orderBy: { name: "asc" } }),
    prisma.card.findMany({
      where: { archivedAt: null },
      orderBy: { updatedAt: "desc" },
      take: 30,
      select: { id: true, title: true, type: true },
    }),
  ]);

  const listRefs: ListRef[] = lists.map((l) => ({
    stageKey: l.stageKey,
    name: l.name,
    boardKey: l.board.key,
  }));

  return (
    <AutomationsPage
      automations={automations.map((a) => ({
        id: a.id,
        name: a.name,
        enabled: a.enabled,
        isSystem: a.isSystem,
        trigger: a.trigger,
        conditions: a.conditions,
        actions: a.actions,
        runCount: a._count.runs,
      }))}
      lists={listRefs}
      users={users}
      cards={cards}
      canManage={canManageAutomations(session.role)}
    />
  );
}
