import type { CardType, Role } from "@prisma/client";
import { PermissionError } from "./errors";

/**
 * MATRIZ DE PERMISSÕES (seção 3.1 do backlog).
 *
 * O padrão do briefing vive em DEFAULT_MATRIX; o admin pode sobrescrever
 * qualquer célula pela tela de Configurações, e o override é persistido em
 * `role_permissions`. Linha ausente no banco = valor padrão.
 *
 * Invariante deliberada: `admin` tem todas as capacidades, sempre, e não é
 * editável. Sem isso o admin poderia se trancar para fora da própria tela
 * de configurações — e não haveria como voltar atrás pela interface.
 */

export const ROLES = ["sales", "member", "manager", "admin"] as const satisfies readonly Role[];

/** Papéis cujas permissões o admin edita (todos menos ele próprio). */
export const EDITABLE_ROLES = ["sales", "member", "manager"] as const;
export type EditableRole = (typeof EDITABLE_ROLES)[number];

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

export function isEditableRole(value: string): value is EditableRole {
  return (EDITABLE_ROLES as readonly string[]).includes(value);
}

export type PermissionMatrix = Record<Role, Record<Capability, boolean>>;

/** Padrão do briefing (tabela 3.1 de `docs/personas.md`). */
export const DEFAULT_MATRIX: PermissionMatrix = {
  sales: {
    "board.sales.mutate": true,
    "board.projects.mutate": false,
    "card.edit.own": true,
    "card.edit.any": true,
    "task.manage": true,
    "task.complete": true,
    "automations.manage": false,
    "compliance.manage": false,
    "users.manage": false,
  },
  member: {
    "board.sales.mutate": false,
    "board.projects.mutate": false,
    "card.edit.own": true,
    "card.edit.any": true,
    "task.manage": true,
    "task.complete": true,
    "automations.manage": false,
    "compliance.manage": false,
    "users.manage": false,
  },
  manager: {
    "board.sales.mutate": true,
    "board.projects.mutate": true,
    "card.edit.own": true,
    "card.edit.any": true,
    "task.manage": true,
    "task.complete": true,
    "automations.manage": true,
    "compliance.manage": false,
    "users.manage": false,
  },
  admin: Object.fromEntries(CAPABILITY_KEYS.map((k) => [k, true])) as Record<Capability, boolean>,
};

function cloneDefaults(): PermissionMatrix {
  return {
    sales: { ...DEFAULT_MATRIX.sales },
    member: { ...DEFAULT_MATRIX.member },
    manager: { ...DEFAULT_MATRIX.manager },
    admin: { ...DEFAULT_MATRIX.admin },
  };
}

// ------------------------------------------------------- leitura da matriz

/** Leitura pura da matriz — usada pelas checagens e pelos testes. */
export function can(matrix: PermissionMatrix, role: Role, capability: Capability): boolean {
  if (role === "admin") return true;
  return matrix[role]?.[capability] ?? false;
}

export function boardCapability(boardType: CardType): Capability {
  return boardType === "opportunity" ? "board.sales.mutate" : "board.projects.mutate";
}

export function canMutateBoardWith(
  matrix: PermissionMatrix,
  role: Role,
  boardType: CardType
): boolean {
  return can(matrix, role, boardCapability(boardType));
}

export function canEditCardWith(
  matrix: PermissionMatrix,
  role: Role,
  boardType: CardType,
  card: { assigneeId: string | null },
  userId: string
): boolean {
  if (card.assigneeId === userId) return can(matrix, role, "card.edit.own");
  return can(matrix, role, "card.edit.any") && canMutateBoardWith(matrix, role, boardType);
}

/** Aplica ao banco só o que difere do padrão — o resto continua implícito. */
export function applyOverrides(
  overrides: { role: Role; capability: string; allowed: boolean }[]
): PermissionMatrix {
  const matrix = cloneDefaults();
  for (const row of overrides) {
    // `admin` é ignorado de propósito: a invariante acima não é negociável.
    if (row.role === "admin") continue;
    if (!isCapability(row.capability)) continue;
    matrix[row.role][row.capability] = row.allowed;
  }
  return matrix;
}

export function assertPermission(allowed: boolean, message?: string): void {
  if (!allowed) throw new PermissionError(message);
}
