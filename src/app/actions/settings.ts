"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { Role } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { createMemberAccount, requireSession, type Session } from "@/lib/auth";
import {
  CAPABILITY_KEYS,
  ROLE_LABELS,
  buildUserPermissions,
  can,
  defaultFor,
  type Capability,
} from "@/core/permissions";
import { canManageUsers, invalidatePermissionCache } from "@/core/permission-store";
import { toResult, type ActionResult } from "./result";

/**
 * Configurações do administrador: matriz de permissões e papéis dos usuários.
 * Tudo passa por `users.manage` e tudo é auditado — a mesma disciplina que o
 * resto do sistema aplica às regras de compliance.
 */

async function requireManager(): Promise<Session | null> {
  const session = await requireSession();
  return (await canManageUsers(session.userId)) ? session : null;
}

const DENIED = {
  ok: false as const,
  error: "Apenas quem gerencia usuários pode alterar permissões.",
  status: 403,
};

async function audit(
  actorId: string,
  kind: "permission" | "role" | "user" | "status",
  target: string,
  before: string | null,
  after: string | null
) {
  await prisma.permissionAudit.create({ data: { actorId, kind, target, before, after } });
}

// --------------------------------------------------- permissões por pessoa

const overridesSchema = z.object({
  userId: z.string().uuid(),
  overrides: z.record(
    z.enum(CAPABILITY_KEYS as [Capability, ...Capability[]]),
    z.boolean().nullable()
  ),
});

/**
 * Recusa deixar o sistema sem ninguém capaz de gerenciar usuários — a única
 * porta de volta se alguém errar a mão nas permissões.
 */
async function wouldOrphanUserManagement(userId: string, willHave: boolean): Promise<boolean> {
  if (willHave) return false;
  const users = await prisma.profile.findMany({
    select: { id: true, role: true, permissions: { select: { capability: true, allowed: true } } },
  });
  const outros = users.filter((u) => u.id !== userId);
  return !outros.some((u) => can(buildUserPermissions(u.role, u.permissions), "users.manage"));
}

/**
 * Salva as permissões de UMA pessoa. `true`/`false` gravam personalização;
 * `null` apaga a linha e devolve a capacidade ao modelo da função.
 */
export async function saveUserPermissionsAction(
  input: unknown
): Promise<ActionResult<{ changed: number }>> {
  const session = await requireManager();
  if (!session) return DENIED;

  const parsed = overridesSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Dados inválidos.", status: 400 };
  const { userId, overrides } = parsed.data;

  if (userId === session.userId)
    return {
      ok: false,
      error: "Você não altera as próprias permissões — peça a outra pessoa que gerencia usuários.",
      status: 403,
    };

  try {
    const user = await prisma.profile.findUnique({
      where: { id: userId },
      select: { id: true, name: true, email: true, role: true, permissions: true },
    });
    if (!user) return { ok: false, error: "Usuário não encontrado.", status: 404 };

    const atual = buildUserPermissions(user.role, user.permissions);
    const mudancas: { capability: Capability; allowed: boolean | null; antes: boolean }[] = [];

    for (const capability of CAPABILITY_KEYS) {
      const pedido = overrides[capability];
      if (pedido === undefined) continue;
      const antes = can(atual, capability);
      const depois = pedido === null ? defaultFor(user.role, capability) : pedido;
      const jaEraExplicito = atual.overrides[capability] !== undefined;
      if (depois === antes && (pedido === null) === !jaEraExplicito) continue;
      mudancas.push({ capability, allowed: pedido, antes });
    }

    if (mudancas.length === 0) return { ok: true, data: { changed: 0 } };

    const gerencia = mudancas.find((m) => m.capability === "users.manage");
    if (gerencia) {
      const ficaraCom =
        gerencia.allowed === null ? defaultFor(user.role, "users.manage") : gerencia.allowed;
      if (await wouldOrphanUserManagement(userId, ficaraCom))
        return {
          ok: false,
          error:
            "Esta é a última pessoa que gerencia usuários — dê a permissão a outra antes de tirar desta.",
          status: 403,
        };
    }

    await prisma.$transaction(
      mudancas.map((m) =>
        m.allowed === null
          ? prisma.userPermission.deleteMany({ where: { userId, capability: m.capability } })
          : prisma.userPermission.upsert({
              where: { userId_capability: { userId, capability: m.capability } },
              create: {
                userId,
                capability: m.capability,
                allowed: m.allowed,
                updatedById: session.userId,
              },
              update: { allowed: m.allowed, updatedById: session.userId },
            })
      )
    );

    for (const m of mudancas) {
      const depois =
        m.allowed === null
          ? `padrão da função (${defaultFor(user.role, m.capability) ? "permitido" : "negado"})`
          : m.allowed
            ? "permitido"
            : "negado";
      await audit(
        session.userId,
        "permission",
        `${user.name} · ${m.capability}`,
        m.antes ? "permitido" : "negado",
        depois
      );
    }

    invalidatePermissionCache(userId);
    revalidateAll();
    return { ok: true, data: { changed: mudancas.length } };
  } catch (err) {
    return toResult(err);
  }
}

/** Devolve a pessoa ao modelo da função dela. */
export async function resetUserPermissionsAction(input: unknown): Promise<ActionResult> {
  const session = await requireManager();
  if (!session) return DENIED;
  const parsed = z.object({ userId: z.string().uuid() }).safeParse(input);
  if (!parsed.success) return { ok: false, error: "Dados inválidos.", status: 400 };
  const { userId } = parsed.data;

  if (userId === session.userId)
    return { ok: false, error: "Você não altera as próprias permissões.", status: 403 };

  try {
    const user = await prisma.profile.findUnique({
      where: { id: userId },
      select: { name: true, role: true },
    });
    if (!user) return { ok: false, error: "Usuário não encontrado.", status: 404 };

    if (await wouldOrphanUserManagement(userId, defaultFor(user.role, "users.manage")))
      return {
        ok: false,
        error: "Isso deixaria o sistema sem ninguém para gerenciar usuários.",
        status: 403,
      };

    const removidas = await prisma.userPermission.deleteMany({ where: { userId } });
    if (removidas.count > 0) {
      await audit(
        session.userId,
        "permission",
        `${user.name} · todas`,
        "personalizado",
        `modelo de ${ROLE_LABELS[user.role]}`
      );
    }
    invalidatePermissionCache(userId);
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

    invalidatePermissionCache(userId);
    revalidateAll();
    return { ok: true };
  } catch (err) {
    return toResult(err);
  }
}

// ------------------------------------------------ desativar, reativar, excluir

/** O que impede apagar o perfil de vez — e some do caminho se for desativação. */
async function vinculos(userId: string) {
  const [criouCards, responsavelCards, comentarios, tarefas] = await Promise.all([
    prisma.card.count({ where: { createdBy: userId } }),
    prisma.card.count({ where: { assigneeId: userId } }),
    prisma.comment.count({ where: { authorId: userId } }),
    prisma.task.count({ where: { assigneeId: userId } }),
  ]);
  return { criouCards, responsavelCards, comentarios, tarefas };
}

const alvoSchema = z.object({ userId: z.string().uuid() });

type Alvo =
  | { ok: false; erro: Extract<ActionResult, { ok: false }> }
  | { ok: true; userId: string; user: { id: string; email: string; deactivatedAt: Date | null } };

async function alvoValido(input: unknown, session: Session, verbo: string): Promise<Alvo> {
  const parsed = alvoSchema.safeParse(input);
  if (!parsed.success) return { ok: false, erro: { ok: false, error: "Dados inválidos.", status: 400 } };
  const { userId } = parsed.data;
  if (userId === session.userId)
    return {
      ok: false,
      erro: {
        ok: false,
        error: `Você não pode ${verbo} a própria conta — peça a outra pessoa que gerencia usuários.`,
        status: 403,
      },
    };
  const user = await prisma.profile.findUnique({ where: { id: userId } });
  if (!user) return { ok: false, erro: { ok: false, error: "Usuário não encontrado.", status: 404 } };
  return { ok: true, userId, user };
}

export async function deactivateUserAction(input: unknown): Promise<ActionResult> {
  const session = await requireManager();
  if (!session) return DENIED;
  const alvo = await alvoValido(input, session, "desativar");
  if (!alvo.ok) return alvo.erro;
  const { userId, user } = alvo;
  if (user.deactivatedAt) return { ok: true };

  try {
    // Desativar equivale a tirar todas as capacidades: vale a mesma trava.
    if (await wouldOrphanUserManagement(userId, false))
      return {
        ok: false,
        error: "Esta é a última pessoa que gerencia usuários — passe a permissão a outra antes.",
        status: 403,
      };

    await prisma.profile.update({ where: { id: userId }, data: { deactivatedAt: new Date() } });
    await audit(session.userId, "status", user.email, "ativo", "desativado");
    invalidatePermissionCache(userId);
    revalidateAll();
    return { ok: true };
  } catch (err) {
    return toResult(err);
  }
}

export async function reactivateUserAction(input: unknown): Promise<ActionResult> {
  const session = await requireManager();
  if (!session) return DENIED;
  const alvo = await alvoValido(input, session, "reativar");
  if (!alvo.ok) return alvo.erro;
  const { userId, user } = alvo;

  try {
    await prisma.profile.update({ where: { id: userId }, data: { deactivatedAt: null } });
    await audit(session.userId, "status", user.email, "desativado", "ativo");
    invalidatePermissionCache(userId);
    revalidateAll();
    return { ok: true };
  } catch (err) {
    return toResult(err);
  }
}

/**
 * Apaga o perfil de vez. Só quando não sobrou nada ligado à pessoa: card criado
 * exige criador no banco, e comentário sumiria junto, furando o histórico.
 */
export async function deleteUserAction(input: unknown): Promise<ActionResult> {
  const session = await requireManager();
  if (!session) return DENIED;
  const alvo = await alvoValido(input, session, "excluir");
  if (!alvo.ok) return alvo.erro;
  const { userId, user } = alvo;

  try {
    if (await wouldOrphanUserManagement(userId, false))
      return {
        ok: false,
        error: "Esta é a última pessoa que gerencia usuários — passe a permissão a outra antes.",
        status: 403,
      };

    const v = await vinculos(userId);
    const presos = [
      v.criouCards ? `${v.criouCards} card(s) criado(s)` : null,
      v.responsavelCards ? `${v.responsavelCards} card(s) sob responsabilidade` : null,
      v.comentarios ? `${v.comentarios} comentário(s)` : null,
      v.tarefas ? `${v.tarefas} tarefa(s)` : null,
    ].filter(Boolean);

    if (presos.length > 0)
      return {
        ok: false,
        error: `Não dá para excluir: há ${presos.join(", ")} ligados a esta pessoa. Desative em vez de excluir — o histórico fica preservado.`,
        status: 409,
      };

    await prisma.profile.delete({ where: { id: userId } });
    await audit(session.userId, "status", user.email, "cadastrado", "excluído");
    invalidatePermissionCache(userId);
    revalidateAll();
    return { ok: true };
  } catch (err) {
    return toResult(err);
  }
}

// ------------------------------------------------------------ cadastro de membros

const memberSchema = z.object({
  name: z.string().trim().min(1, "Informe o nome."),
  email: z.string().trim().email("Informe um e-mail válido."),
  role: z.nativeEnum(Role),
});

/**
 * Cadastra um membro da equipe. A senha temporária volta UMA vez, para quem
 * cadastrou repassar — ela não é guardada em texto nem fica recuperável.
 */
export async function createMemberAction(
  input: unknown
): Promise<ActionResult<{ name: string; email: string; temporaryPassword: string }>> {
  const session = await requireManager();
  if (!session) return DENIED;

  const parsed = memberSchema.safeParse(input);
  if (!parsed.success)
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Dados inválidos.", status: 400 };

  try {
    const result = await createMemberAccount(parsed.data.name, parsed.data.email, parsed.data.role);
    if ("error" in result) return { ok: false, error: result.error, status: 409 };

    await audit(session.userId, "user", result.user.email, null, ROLE_LABELS[result.user.role]);
    revalidatePath("/configuracoes");
    return {
      ok: true,
      data: {
        name: result.user.name,
        email: result.user.email,
        temporaryPassword: result.temporaryPassword,
      },
    };
  } catch (err) {
    return toResult(err);
  }
}

function revalidateAll() {
  for (const path of ["/configuracoes", "/board/sales", "/board/projects", "/automations", "/compliance"]) {
    revalidatePath(path);
  }
}

