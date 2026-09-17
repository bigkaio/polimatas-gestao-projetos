import "server-only";
import type { CardType } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  buildUserPermissions,
  can,
  canEditCardWith,
  canMutateBoardWith,
  type Capability,
  type UserPermissions,
} from "./permissions";

/**
 * Leitura das permissões de uma PESSOA. Separado de `permissions.ts` de
 * propósito: o catálogo é puro e pode ser importado pela interface, este
 * módulo toca o Prisma e é só de servidor.
 *
 * A função vem do banco, e não da sessão: assim, trocar o papel de alguém
 * vale na hora, sem esperar o próximo login.
 *
 * Cache por pessoa, já que a verificação acontece em toda mutação. Toda
 * gravação chama `invalidatePermissionCache()`, e o TTL curto cobre o caso de
 * mais de uma instância do servidor.
 */
const CACHE_TTL_MS = 10_000;
const cache = new Map<string, { perms: UserPermissions | null; active: boolean; at: number }>();

export function invalidatePermissionCache(userId?: string): void {
  if (userId) cache.delete(userId);
  else cache.clear();
}

async function load(userId: string) {
  const hit = cache.get(userId);
  if (hit && Date.now() - hit.at < CACHE_TTL_MS) return hit;

  const user = await prisma.profile.findUnique({
    where: { id: userId },
    select: {
      role: true,
      deactivatedAt: true,
      permissions: { select: { capability: true, allowed: true } },
    },
  });
  const entry = {
    // Pessoa desativada não tem capacidade nenhuma — a checagem morre aqui,
    // sem depender de cada tela lembrar de conferir.
    perms: user && !user.deactivatedAt ? buildUserPermissions(user.role, user.permissions) : null,
    active: !!user && !user.deactivatedAt,
    at: Date.now(),
  };
  cache.set(userId, entry);
  return entry;
}

export async function loadUserPermissions(userId: string): Promise<UserPermissions | null> {
  return (await load(userId)).perms;
}

/** A pessoa ainda pode usar o sistema? */
export async function isActiveUser(userId: string): Promise<boolean> {
  return (await load(userId)).active;
}

export async function hasCapability(userId: string, capability: Capability): Promise<boolean> {
  const perms = await loadUserPermissions(userId);
  return perms ? can(perms, capability) : false;
}

// ------------------------------------------------------- checagens de uso

export async function canMutateBoard(userId: string, boardType: CardType): Promise<boolean> {
  const perms = await loadUserPermissions(userId);
  return perms ? canMutateBoardWith(perms, boardType) : false;
}

export async function canEditCard(
  userId: string,
  boardType: CardType,
  card: { assigneeId: string | null }
): Promise<boolean> {
  const perms = await loadUserPermissions(userId);
  return perms ? canEditCardWith(perms, boardType, card, userId) : false;
}

/** Criar, editar ou remover tarefa: exige a capacidade e poder editar o card. */
export async function canManageTasks(
  userId: string,
  boardType: CardType,
  card: { assigneeId: string | null }
): Promise<boolean> {
  const perms = await loadUserPermissions(userId);
  if (!perms) return false;
  return can(perms, "task.manage") && canEditCardWith(perms, boardType, card, userId);
}

/** Excluir card: exige a capacidade e poder mexer no quadro onde ele está. */
export async function canDeleteCard(userId: string, boardType: CardType): Promise<boolean> {
  const perms = await loadUserPermissions(userId);
  if (!perms) return false;
  return can(perms, "card.delete") && canMutateBoardWith(perms, boardType);
}

export async function canCompleteTask(userId: string): Promise<boolean> {
  return hasCapability(userId, "task.complete");
}

/** Comentar exige a capacidade; ver o card já basta, não é preciso poder editá-lo. */
export async function canComment(userId: string): Promise<boolean> {
  return hasCapability(userId, "card.comment");
}

export async function canManageLists(userId: string): Promise<boolean> {
  return hasCapability(userId, "lists.manage");
}

export async function canManageAutomations(userId: string): Promise<boolean> {
  return hasCapability(userId, "automations.manage");
}

export async function canManageCompliance(userId: string): Promise<boolean> {
  return hasCapability(userId, "compliance.manage");
}

export async function canManageUsers(userId: string): Promise<boolean> {
  return hasCapability(userId, "users.manage");
}
