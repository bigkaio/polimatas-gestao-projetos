import type { CardType, Role } from "@prisma/client";
import { PermissionError } from "./errors";

/** Matriz de permissões da seção 3.1 do backlog. */

export function canMutateBoard(role: Role, boardType: CardType): boolean {
  if (role === "admin" || role === "manager") return true;
  if (role === "sales") return boardType === "opportunity";
  return false; // member não cria/move cards
}

export function canEditCard(
  role: Role,
  boardType: CardType,
  card: { assigneeId: string | null },
  userId: string
): boolean {
  // Qualquer papel edita o card em que é responsável (linha da matriz).
  if (card.assigneeId === userId) return true;
  return canMutateBoard(role, boardType);
}

export function canManageAutomations(role: Role): boolean {
  return role === "admin" || role === "manager";
}

export function canManageCompliance(role: Role): boolean {
  return role === "admin";
}

export function assertPermission(allowed: boolean, message?: string): void {
  if (!allowed) throw new PermissionError(message);
}
