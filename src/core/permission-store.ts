import "server-only";
import type { CardType, Role } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  applyOverrides,
  can,
  canEditCardWith,
  canMutateBoardWith,
  type Capability,
  type PermissionMatrix,
} from "./permissions";

/**
 * Leitura da matriz de permissões no banco. Separado de `permissions.ts`
 * de propósito: o catálogo é puro e pode ser importado pela interface,
 * este módulo toca o Prisma e é só de servidor.
 *
 * Cache de processo: a verificação acontece em toda mutação e reler a matriz
 * a cada uma seria desperdício. Toda escrita chama `invalidatePermissionCache()`
 * e o TTL curto cobre o caso de mais de uma instância do servidor.
 */
const CACHE_TTL_MS = 10_000;
let cache: { matrix: PermissionMatrix; at: number } | null = null;

export function invalidatePermissionCache(): void {
  cache = null;
}

export async function loadPermissionMatrix(): Promise<PermissionMatrix> {
  if (cache && Date.now() - cache.at < CACHE_TTL_MS) return cache.matrix;
  const overrides = await prisma.rolePermission.findMany({
    select: { role: true, capability: true, allowed: true },
  });
  const matrix = applyOverrides(overrides);
  cache = { matrix, at: Date.now() };
  return matrix;
}

export async function hasCapability(role: Role, capability: Capability): Promise<boolean> {
  return can(await loadPermissionMatrix(), role, capability);
}

// ------------------------------------------------------- checagens de uso

export async function canMutateBoard(role: Role, boardType: CardType): Promise<boolean> {
  return canMutateBoardWith(await loadPermissionMatrix(), role, boardType);
}

export async function canEditCard(
  role: Role,
  boardType: CardType,
  card: { assigneeId: string | null },
  userId: string
): Promise<boolean> {
  return canEditCardWith(await loadPermissionMatrix(), role, boardType, card, userId);
}

/** Criar, editar ou remover tarefa: exige a capacidade e poder editar o card. */
export async function canManageTasks(
  role: Role,
  boardType: CardType,
  card: { assigneeId: string | null },
  userId: string
): Promise<boolean> {
  const matrix = await loadPermissionMatrix();
  return can(matrix, role, "task.manage") && canEditCardWith(matrix, role, boardType, card, userId);
}

export async function canCompleteTask(role: Role): Promise<boolean> {
  return hasCapability(role, "task.complete");
}

export async function canManageAutomations(role: Role): Promise<boolean> {
  return hasCapability(role, "automations.manage");
}

export async function canManageCompliance(role: Role): Promise<boolean> {
  return hasCapability(role, "compliance.manage");
}

export async function canManageUsers(role: Role): Promise<boolean> {
  return hasCapability(role, "users.manage");
}
