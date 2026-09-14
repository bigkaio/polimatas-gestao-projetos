"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { Role } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireSession, type Session } from "@/lib/auth";
import {
  CAPABILITY_KEYS,
  EDITABLE_ROLES,
  ROLE_LABELS,
  type Capability,
  type EditableRole,
} from "@/core/permissions";
import {
  canManageUsers,
  invalidatePermissionCache,
  loadPermissionMatrix,
} from "@/core/permission-store";
import { toResult, type ActionResult } from "./result";

/**
 * Configurações do administrador: matriz de permissões e papéis dos usuários.
 * Tudo passa por `users.manage` e tudo é auditado — a mesma disciplina que o
 * resto do sistema aplica às regras de compliance.
 */

async function requireManager(): Promise<Session | null> {
  const session = await requireSession();
  return (await canManageUsers(session.role)) ? session : null;
}

const DENIED = {
  ok: false as const,
  error: "Apenas quem gerencia usuários pode alterar permissões.",
  status: 403,
};

async function audit(
  actorId: string,
  kind: "permission" | "role",
  target: string,
  before: string | null,
  after: string | null
) {
  await prisma.permissionAudit.create({ data: { actorId, kind, target, before, after } });
}

// ------------------------------------------------------- matriz de permissões

const matrixSchema = z.object({
  matrix: z.record(
    z.enum(EDITABLE_ROLES),
    z.record(z.enum(CAPABILITY_KEYS as [Capability, ...Capability[]]), z.boolean())
  ),
});

export async function savePermissionMatrixAction(input: unknown): Promise<ActionResult<{ changed: number }>> {
  const session = await requireManager();
  if (!session) return DENIED;

  const parsed = matrixSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Matriz inválida.", status: 400 };

  try {
    const current = await loadPermissionMatrix();
    const writes: { role: EditableRole; capability: Capability; allowed: boolean }[] = [];

    for (const role of EDITABLE_ROLES) {
      const row = parsed.data.matrix[role];
      if (!row) continue;
      for (const capability of CAPABILITY_KEYS) {
        const allowed = row[capability];
        if (allowed === undefined) continue;
        if (allowed === current[role][capability]) continue;
        writes.push({ role, capability, allowed });
      }
    }

    if (writes.length === 0) return { ok: true, data: { changed: 0 } };

    await prisma.$transaction(
      writes.map((w) =>
        prisma.rolePermission.upsert({
          where: { role_capability: { role: w.role, capability: w.capability } },
          create: {
            role: w.role,
            capability: w.capability,
            allowed: w.allowed,
            updatedById: session.userId,
          },
          update: { allowed: w.allowed, updatedById: session.userId },
        })
      )
    );

    for (const w of writes) {
      await audit(
        session.userId,
        "permission",
        `${ROLE_LABELS[w.role]} · ${w.capability}`,
        current[w.role][w.capability] ? "permitido" : "negado",
        w.allowed ? "permitido" : "negado"
      );
    }

    invalidatePermissionCache();
    revalidateAll();
    return { ok: true, data: { changed: writes.length } };
  } catch (err) {
    return toResult(err);
  }
}

export async function resetPermissionsAction(): Promise<ActionResult> {
  const session = await requireManager();
  if (!session) return DENIED;

  try {
    const removed = await prisma.rolePermission.deleteMany({});
    if (removed.count > 0) {
      await audit(session.userId, "permission", "matriz completa", "personalizada", "padrão do briefing");
    }
    invalidatePermissionCache();
    revalidateAll();
    return { ok: true };
  } catch (err) {
    return toResult(err);
  }
}

// ------------------------------------------------------------ papéis dos usuários

const roleSchema = z.object({
  userId: z.string().uuid(),
  role: z.nativeEnum(Role),
});

export async function changeUserRoleAction(input: unknown): Promise<ActionResult> {
  const session = await requireManager();
  if (!session) return DENIED;

  const parsed = roleSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Dados inválidos.", status: 400 };
  const { userId, role } = parsed.data;

  if (userId === session.userId)
    return {
      ok: false,
      error: "Você não altera o próprio papel — peça a outro administrador.",
      status: 403,
    };

  try {
    const user = await prisma.profile.findUnique({ where: { id: userId } });
    if (!user) return { ok: false, error: "Usuário não encontrado.", status: 404 };
    if (user.role === role) return { ok: true };

    // O sistema precisa sobrar com pelo menos um administrador.
    if (user.role === "admin") {
      const admins = await prisma.profile.count({ where: { role: "admin" } });
      if (admins <= 1)
        return {
          ok: false,
          error: "Este é o último administrador — promova outra pessoa antes de rebaixá-lo.",
          status: 403,
        };
    }

    await prisma.profile.update({ where: { id: userId }, data: { role } });
    await audit(session.userId, "role", user.email, ROLE_LABELS[user.role], ROLE_LABELS[role]);
    await prisma.notification.create({
      data: {
        userId,
        message: `Seu papel no Polímatas Flow agora é ${ROLE_LABELS[role]}.`,
      },
    });

    invalidatePermissionCache();
    revalidateAll();
    return { ok: true };
  } catch (err) {
    return toResult(err);
  }
}

function revalidateAll() {
  for (const path of ["/configuracoes", "/board/sales", "/board/projects", "/automations", "/compliance"]) {
    revalidatePath(path);
  }
}

