import type { CardType, Role } from "@prisma/client";
import { PermissionError } from "./errors";

/**
 * PERMISSÕES POR PESSOA.
 *
 * A função (papel) continua existindo, mas como **modelo**: DEFAULT_MATRIX diz
 * o que cada função libera por padrão. Quem manda é a pessoa — o admin ajusta
 * capacidade por capacidade em `user_permissions`, e cada linha ali sobrepõe o
 * modelo. Sem linha, vale o padrão da função.
 *
 * Não há mais a invariante "admin pode tudo, sempre": qualquer permissão pode
 * ser retirada de qualquer pessoa. Contra o tiro no pé sobraram duas travas,
 * aplicadas nas Server Actions: ninguém altera as próprias permissões, e o
 * sistema recusa deixar o sistema sem ninguém com `users.manage`.
 */

export const ROLES = ["sales", "member", "manager", "admin"] as const satisfies readonly Role[];

export const ROLE_LABELS: Record<Role, string> = {
  sales: "Vendedor",
  member: "Executor",
  manager: "Gestor",
  admin: "Administrador",
};

/**
 * Catálogo de capacidades. Cada chave corresponde a um ponto de verificação
 * real na camada de domínio — nada aqui é decorativo.
 */
export const CAPABILITIES = [
  {
    key: "board.sales.mutate",
    group: "Pipeline de Vendas",
    label: "Criar e mover oportunidades",
    help: "Sem isto o quadro de vendas fica somente leitura para o papel.",
  },
  {
    key: "board.projects.mutate",
    group: "Pipeline de Projetos",
    label: "Criar e mover cards de projeto",
    help: "Sem isto o quadro de projetos fica somente leitura para o papel.",
  },
  {
    key: "card.edit.own",
    group: "Cards",
    label: "Editar o card em que é responsável",
    help: "Vale mesmo sem permissão de mexer no quadro.",
  },
  {
    key: "card.edit.any",
    group: "Cards",
    label: "Editar cards de outras pessoas",
    help: "Só nos quadros em que o papel já pode criar e mover.",
  },
  {
    key: "card.delete",
    group: "Cards",
    label: "Excluir cards",
    help: "Apaga o card com tarefas, comentários e histórico — não tem volta. Só nos quadros em que o papel já pode criar e mover.",
  },
  {
    key: "card.comment",
    group: "Cards",
    label: "Comentar nos cards",
    help: "Cada pessoa edita e apaga os próprios comentários; o admin apaga qualquer um.",
  },
  {
    key: "task.manage",
    group: "Checklist",
    label: "Criar, editar e remover tarefas",
    help: "Exige também poder editar o card onde a tarefa está.",
  },
  {
    key: "task.complete",
    group: "Checklist",
    label: "Concluir e reabrir tarefas",
    help: "Marcar item do checklist como feito.",
  },
  {
    key: "lists.manage",
    group: "Quadros",
    label: "Criar, renomear e excluir colunas",
    help: "As colunas com função especial (Fechado, Perdido, Concluído, Atrasados) nunca são excluídas.",
  },
  {
    key: "automations.manage",
    group: "Configuração",
    label: "Criar e editar automações",
    help: "Acesso ao construtor de regras Quando → Se → Então.",
  },
  {
    key: "compliance.manage",
    group: "Configuração",
    label: "Criar e editar regras de compliance",
    help: "As regras nativas do briefing seguem imutáveis para todos.",
  },
  {
    key: "users.manage",
    group: "Configuração",
    label: "Gerenciar usuários e permissões",
    help: "Dá acesso a esta própria tela — conceda com cuidado.",
  },
] as const;

export type Capability = (typeof CAPABILITIES)[number]["key"];

export const CAPABILITY_KEYS = CAPABILITIES.map((c) => c.key) as Capability[];

function isCapability(value: string): value is Capability {
  return (CAPABILITY_KEYS as string[]).includes(value);
}

export type PermissionMatrix = Record<Role, Record<Capability, boolean>>;

/** Modelo de cada função — o ponto de partida de quem tem aquele papel. */
export const DEFAULT_MATRIX: PermissionMatrix = {
  sales: {
    "board.sales.mutate": true,
    "board.projects.mutate": false,
    "card.edit.own": true,
    "card.edit.any": true,
    "card.delete": false,
    "card.comment": true,
    "task.manage": true,
    "task.complete": true,
    "lists.manage": false,
    "automations.manage": false,
    "compliance.manage": false,
    "users.manage": false,
  },
  member: {
    "board.sales.mutate": false,
    "board.projects.mutate": false,
    "card.edit.own": true,
    "card.edit.any": true,
    "card.delete": false,
    "card.comment": true,
    "task.manage": true,
    "task.complete": true,
    "lists.manage": false,
    "automations.manage": false,
    "compliance.manage": false,
    "users.manage": false,
  },
  manager: {
    "board.sales.mutate": true,
    "board.projects.mutate": true,
    "card.edit.own": true,
    "card.edit.any": true,
    "card.delete": true,
    "card.comment": true,
    "task.manage": true,
    "task.complete": true,
    "lists.manage": true,
    "automations.manage": true,
    "compliance.manage": false,
    "users.manage": false,
  },
  admin: Object.fromEntries(CAPABILITY_KEYS.map((k) => [k, true])) as Record<Capability, boolean>,
};

// ---------------------------------------------------- leitura por pessoa

/** O que a pessoa tem: a função dela e o que foi personalizado por cima. */
export type UserPermissions = {
  role: Role;
  overrides: Partial<Record<Capability, boolean>>;
};

/** Padrão da função, sem personalização. */
export function defaultFor(role: Role, capability: Capability): boolean {
  return DEFAULT_MATRIX[role]?.[capability] ?? false;
}

/** Leitura efetiva: o personalizado vence; na ausência, o modelo da função. */
export function can(perms: UserPermissions, capability: Capability): boolean {
  return perms.overrides[capability] ?? defaultFor(perms.role, capability);
}

/** Monta as permissões de uma pessoa a partir das linhas do banco. */
export function buildUserPermissions(
  role: Role,
  rows: { capability: string; allowed: boolean }[]
): UserPermissions {
  const overrides: Partial<Record<Capability, boolean>> = {};
  for (const row of rows) {
    if (isCapability(row.capability)) overrides[row.capability] = row.allowed;
  }
  return { role, overrides };
}

export function boardCapability(boardType: CardType): Capability {
  return boardType === "opportunity" ? "board.sales.mutate" : "board.projects.mutate";
}

export function canMutateBoardWith(perms: UserPermissions, boardType: CardType): boolean {
  return can(perms, boardCapability(boardType));
}

export function canEditCardWith(
  perms: UserPermissions,
  boardType: CardType,
  card: { assigneeId: string | null },
  userId: string
): boolean {
  if (card.assigneeId === userId) return can(perms, "card.edit.own");
  return can(perms, "card.edit.any") && canMutateBoardWith(perms, boardType);
}



export function assertPermission(allowed: boolean, message?: string): void {
  if (!allowed) throw new PermissionError(message);
}
