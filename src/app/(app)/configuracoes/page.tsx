import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/auth";
import { CAPABILITIES, DEFAULT_MATRIX, EDITABLE_ROLES } from "@/core/permissions";
import { canManageUsers, loadPermissionMatrix } from "@/core/permission-store";
import { SettingsPage } from "@/components/settings/settings-page";

export const dynamic = "force-dynamic";

/** Configurações do administrador (seção 3.1: "gerenciar usuários"). */
export default async function Page() {
  const session = await requireSession();
  if (!(await canManageUsers(session.role))) redirect("/inicio");

  const [matrix, users, audits] = await Promise.all([
    loadPermissionMatrix(),
    prisma.profile.findMany({
      select: { id: true, name: true, email: true, role: true, createdAt: true },
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
      roles={[...EDITABLE_ROLES]}
      matrix={matrix}
      defaults={DEFAULT_MATRIX}
      users={users.map((u) => ({
        id: u.id,
        name: u.name,
        email: u.email,
        role: u.role,
        createdAt: u.createdAt.toISOString(),
      }))}
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
