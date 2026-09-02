import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/auth";
import { canManageCompliance } from "@/core/permissions";
import type { ListRef } from "@/lib/humanize";
import { CompliancePage } from "@/components/compliance/compliance-page";

export const dynamic = "force-dynamic";

export default async function Page() {
  const session = await requireSession();

  const [rules, violations, lists, users] = await Promise.all([
    prisma.complianceRule.findMany({
      orderBy: [{ isSystem: "desc" }, { name: "asc" }],
      include: { _count: { select: { violations: true } } },
    }),
    prisma.complianceViolation.findMany({
      orderBy: { createdAt: "desc" },
      take: 50,
      include: {
        rule: { select: { name: true } },
        actor: { select: { name: true } },
        card: { select: { id: true, title: true, board: { select: { key: true } } } },
      },
    }),
    prisma.list.findMany({ include: { board: { select: { key: true } } } }),
    prisma.profile.findMany({ select: { id: true, name: true }, orderBy: { name: "asc" } }),
  ]);

  const listRefs: ListRef[] = lists.map((l) => ({
    stageKey: l.stageKey,
    name: l.name,
    boardKey: l.board.key,
  }));

  return (
    <CompliancePage
      rules={rules.map((r) => ({
        id: r.id,
        name: r.name,
        scope: r.scope,
        condition: r.condition,
        message: r.message,
        severity: r.severity,
        enabled: r.enabled,
        isSystem: r.isSystem,
        violationCount: r._count.violations,
      }))}
      violations={violations.map((v) => ({
        id: v.id,
        ruleName: v.rule.name,
        actorName: v.actor?.name ?? null,
        card: v.card ? { id: v.card.id, title: v.card.title, boardKey: v.card.board.key } : null,
        createdAt: v.createdAt.toISOString(),
      }))}
      lists={listRefs}
      users={users}
      canManage={canManageCompliance(session.role)}
    />
  );
}
