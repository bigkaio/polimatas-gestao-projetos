import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/auth";
import { CAPABILITIES, DEFAULT_MATRIX, buildUserPermissions, can } from "@/core/permissions";
import { canManageUsers } from "@/core/permission-store";
import { SettingsPage } from "@/components/settings/settings-page";

export const dynamic = "force-dynamic";

/** Configurações do administrador (seção 3.1: "gerenciar usuários"). */
export default async function Page() {
  const session = await requireSession();
  if (!(await canManageUsers(session.userId))) redirect("/inicio");

  const [users, audits] = await Promise.all([
    prisma.profile.findMany({
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        createdAt: true,
        mustChangePassword: true,
        deactivatedAt: true,
        permissions: { select: { capability: true, allowed: true } },
        _count: { select: { createdCards: true, assignedCards: true, comments: true, assignedTasks: true } },
      },
      orderBy: [{ role: "asc" }, { name: "asc" }],
    }),
    prisma.permissionAudit.findMany({
      orderBy: { createdAt: "desc" },
      take: 30,
      include: { actor: { select: { name: true } } },
    }),
  ]);

  return (
    <SettingsPage
      capabilities={CAPABILITIES.map((c) => ({ ...c }))}
      defaults={DEFAULT_MATRIX}
      users={users.map((u) => {
        const perms = buildUserPermissions(u.role, u.permissions);
        return {
          id: u.id,
          name: u.name,
          email: u.email,
          role: u.role,
          createdAt: u.createdAt.toISOString(),
          mustChangePassword: u.mustChangePassword,
          active: u.deactivatedAt === null,
          // só some de vez quem não deixou rastro: card exige criador, e
          // comentário sumiria junto com o perfil
          erasable:
            u._count.createdCards === 0 &&
            u._count.assignedCards === 0 &&
            u._count.comments === 0 &&
            u._count.assignedTasks === 0,
          // valor que vale hoje + de onde ele veio, para a tela marcar o que foi personalizado
          effective: Object.fromEntries(
            CAPABILITIES.map((c) => [c.key, can(perms, c.key)])
          ) as Record<string, boolean>,
          customized: Object.keys(perms.overrides),
        };
      })}
      audits={audits.map((a) => ({
        id: a.id,
        actorName: a.actor?.name ?? "—",
        kind: a.kind,
        target: a.target,
        before: a.before,
        after: a.after,
        createdAt: a.createdAt.toISOString(),
      }))}
      currentUserId={session.userId}
    />
  );
}
