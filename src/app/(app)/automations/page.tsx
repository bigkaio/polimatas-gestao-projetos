import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/auth";
import { canManageAutomations } from "@/core/permission-store";
import type { ListRef } from "@/lib/humanize";
import { AutomationsPage } from "@/components/automations/automations-page";
import { brl, dateBR } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function Page() {
  const session = await requireSession();

  const [automations, lists, users, cards, sampleCard] = await Promise.all([
    prisma.automation.findMany({
      orderBy: [{ isSystem: "desc" }, { name: "asc" }],
      include: { _count: { select: { runs: true } } },
    }),
    prisma.list.findMany({ include: { board: { select: { key: true } } } }),
    prisma.profile.findMany({
      where: { deactivatedAt: null },
      select: { id: true, name: true, phone: true },
      orderBy: { name: "asc" },
    }),
    prisma.card.findMany({
      where: { archivedAt: null },
      orderBy: { updatedAt: "desc" },
      take: 30,
      select: { id: true, title: true, type: true },
    }),
    // Card de verdade para a pré-visualização das mensagens no construtor.
    prisma.card.findFirst({
      where: { archivedAt: null, type: "opportunity", clientName: { not: null } },
      orderBy: { updatedAt: "desc" },
      include: {
        list: { select: { name: true } },
        assignee: { select: { name: true } },
        _count: { select: { tasks: true } },
      },
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
      users={users.map((u) => ({ id: u.id, name: u.name, hasWhatsApp: u.phone !== null }))}
      sample={
        sampleCard
          ? {
              title: sampleCard.title,
              clientName: sampleCard.clientName,
              amountBRL: sampleCard.amount === null ? null : brl(String(sampleCard.amount)),
              dueDateBR: sampleCard.dueDate ? dateBR(sampleCard.dueDate) : null,
              leadSource: sampleCard.leadSource,
              assigneeName: sampleCard.assignee?.name ?? null,
              listName: sampleCard.list.name,
              openTasks: sampleCard._count.tasks,
            }
          : null
      }
      cards={cards}
      canManage={await canManageAutomations(session.userId)}
    />
  );
}
