import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import type { Card, CardType } from "@prisma/client";
import { assertCompliance } from "./compliance";
import { cardContext } from "./context";
import { dispatch } from "./engine";
import { NotFoundError, PermissionError } from "./errors";
import type { Actor, AutomationContext } from "./events";
import {
  canComment,
  canManageLists,
  canCompleteTask,
  canDeleteCard,
  canEditCard,
  canManageTasks,
  canMutateBoard,
  loadUserPermissions,
} from "./permission-store";

/**
 * CAMADA DE DOMÍNIO — única porta de escrita (seção 5.1 do backlog).
 * Toda mutação segue a mesma sequência:
 *   1. ComplianceGuard.assert  ← BLOQUEIA antes de persistir
 *   2. Persistência (Prisma)
 *   3. ActivityLog
 *   4. Evento de domínio → AutomationEngine
 * Rotas e Server Actions nunca chamam o Prisma diretamente para escrever.
 */

const CARD_INCLUDE = {
  list: true,
  tasks: true,
  board: { select: { key: true } },
} satisfies Prisma.CardInclude;

async function requireCard(cardId: string) {
  const card = await prisma.card.findUnique({ where: { id: cardId }, include: CARD_INCLUDE });
  if (!card) throw new NotFoundError("Card não encontrado.");
  return card;
}

function actorLabel(auto?: AutomationContext) {
  return auto ? { automation: auto.automationName } : {};
}

async function log(
  cardId: string,
  actorId: string | null,
  action: string,
  before: Prisma.InputJsonValue | null,
  after: Prisma.InputJsonValue | null,
  auto?: AutomationContext
) {
  await prisma.activityLog.create({
    data: {
      cardId,
      actorId,
      action,
      before: before ?? undefined,
      after: after ? { ...(after as object), ...actorLabel(auto) } : actorLabel(auto),
    },
  });
}

// ---------------------------------------------------------------- cards

export type CreateCardData = {
  boardId: string;
  listId: string;
  type: CardType;
  title: string;
  description?: string | null;
  assigneeId?: string | null;
  dueDate?: Date | null;
  clientName?: string | null;
  clientEmail?: string | null;
  clientPhone?: string | null;
  leadSource?: string | null;
  amount?: string | null;
  sourceCardId?: string | null;
  createdBy: string;
};

export async function createCard(
  data: CreateCardData,
  actor: Actor | null,
  auto?: AutomationContext,
  opts: { creationNote?: string } = {}
): Promise<Card> {
  const list = await prisma.list.findUnique({
    where: { id: data.listId },
    include: { board: true },
  });
  if (!list || list.boardId !== data.boardId) throw new NotFoundError("Lista não encontrada.");
  if (actor && !(await canMutateBoard(actor.id, list.board.type))) {
    throw new PermissionError(
      list.board.type === "opportunity"
        ? "Apenas vendas, gestores e admins criam oportunidades."
        : "Apenas gestores e admins criam cards de projeto."
    );
  }

  const proposed = {
    ...data,
    id: "",
    position: 0,
    lossReason: null,
    archivedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    description: data.description ?? null,
    assigneeId: data.assigneeId ?? null,
    dueDate: data.dueDate ?? null,
    clientName: data.clientName ?? null,
    clientEmail: data.clientEmail ?? null,
    clientPhone: data.clientPhone ?? null,
    leadSource: data.leadSource ?? null,
    amount: data.amount ? new Prisma.Decimal(data.amount) : null,
    sourceCardId: data.sourceCardId ?? null,
  } satisfies Card;

  await assertCompliance(
    "card.create",
    cardContext(proposed, { toList: list, openTasks: 0 }),
    { actorId: actor?.id ?? null, action: { kind: "card.create", title: data.title } }
  );

  const last = await prisma.card.findFirst({
    where: { listId: list.id },
    orderBy: { position: "desc" },
    select: { position: true },
  });

  const card = await prisma.card.create({
    data: {
      boardId: data.boardId,
      listId: data.listId,
      type: data.type,
      title: data.title,
      description: data.description ?? null,
      position: (last?.position ?? 0) + 1024,
      assigneeId: data.assigneeId ?? null,
      dueDate: data.dueDate ?? null,
      clientName: data.clientName ?? null,
      clientEmail: data.clientEmail ?? null,
      clientPhone: data.clientPhone ?? null,
      leadSource: data.leadSource ?? null,
      amount: data.amount ?? null,
      sourceCardId: data.sourceCardId ?? null,
      createdBy: data.createdBy,
    },
  });

  await log(
    card.id,
    actor?.id ?? null,
    "card.created",
    null,
    { title: card.title, list: list.name, note: opts.creationNote ?? null },
    auto
  );

  await dispatch(
    {
      type: "card.created",
      boardKey: list.board.key,
      cardId: card.id,
      actorId: actor?.id ?? null,
      toListId: list.id,
    },
    auto?.depth ?? 0
  );

  return card;
}

export type CardPatch = Partial<{
  title: string;
  description: string | null;
  assigneeId: string | null;
  dueDate: Date | null;
  clientName: string | null;
  clientEmail: string | null;
  clientPhone: string | null;
  leadSource: string | null;
  amount: string | null;
  lossReason: string | null;
}>;

export async function updateCard(
  cardId: string,
  patch: CardPatch,
  actor: Actor | null,
  auto?: AutomationContext
): Promise<Card> {
  const card = await requireCard(cardId);
  if (actor && !(await canEditCard(actor.id, card.board.key === "sales" ? "opportunity" : "project", card))) {
    throw new PermissionError("Você só edita cards em que é responsável.");
  }

  const merged = {
    ...card,
    ...patch,
    amount:
      patch.amount !== undefined
        ? patch.amount === null
          ? null
          : new Prisma.Decimal(patch.amount)
        : card.amount,
  };

  await assertCompliance("card.update", cardContext(merged, { toList: card.list }), {
    cardId,
    actorId: actor?.id ?? null,
    action: { kind: "card.update", patch: JSON.parse(JSON.stringify(patch)) },
  });

  const changedFields = (Object.keys(patch) as (keyof CardPatch)[]).filter((k) => {
    const prev = k === "amount" ? (card.amount === null ? null : String(card.amount)) : card[k];
    const next = patch[k];
    const norm = (v: unknown) => {
      if (v instanceof Date) return v.toISOString().slice(0, 10);
      // "88000" e "88000.00" são o mesmo valor: sem isto, todo blur no campo
      // gerava uma linha de histórico e disparava "campo alterado".
      if (k === "amount" && v !== null && v !== undefined) return Number(v);
      return v ?? null;
    };
    return norm(prev) !== norm(next);
  });
  if (changedFields.length === 0) return card;

  const updated = await prisma.card.update({ where: { id: cardId }, data: patch });

  await log(
    cardId,
    actor?.id ?? null,
    "card.updated",
    Object.fromEntries(
      changedFields.map((k) => [k, card[k] instanceof Date ? card[k].toISOString() : (card[k] as never)])
    ) as Prisma.InputJsonValue,
    Object.fromEntries(
      changedFields.map((k) => {
        const v = patch[k];
        return [k, v instanceof Date ? v.toISOString() : (v as never)];
      })
    ) as Prisma.InputJsonValue,
    auto
  );

  for (const field of changedFields) {
    await dispatch(
      {
        type: "card.field_changed",
        boardKey: card.board.key,
        cardId,
        actorId: actor?.id ?? null,
        field,
      },
      auto?.depth ?? 0
    );
  }
  return updated;
}

export async function moveCard(
  cardId: string,
  /** `lossReason` (US-14) é gravado junto com o movimento: se ele for recusado, nada fica. */
  target: { toListId: string; index?: number; lossReason?: string },
  actor: Actor | null,
  auto?: AutomationContext
): Promise<Card> {
  const stored = await requireCard(cardId);
  const lossReason = target.lossReason?.trim() || undefined;
  const card = lossReason ? { ...stored, lossReason } : stored;
  const toList = await prisma.list.findUnique({
    where: { id: target.toListId },
    include: { board: true },
  });
  if (!toList || toList.boardId !== card.boardId)
    throw new NotFoundError("Lista de destino não encontrada.");

  if (actor && !(await canMutateBoard(actor.id, toList.board.type))) {
    throw new PermissionError(
      toList.board.type === "opportunity"
        ? "Apenas vendas, gestores e admins movem oportunidades."
        : "Apenas gestores e admins movem cards de projeto."
    );
  }

  const openTasks = card.tasks.filter((t) => !t.done).length;
  const ctx = cardContext(card, { fromList: card.list, toList, openTasks });
  const meta = {
    cardId,
    actorId: actor?.id ?? null,
    action: { kind: "card.move", from: card.list.stageKey, to: toList.stageKey },
  };
  // Reordenar dentro da mesma coluna não é mudança de etapa: as regras de
  // movimento ("sair do Backlog", "entrar em Concluído") não se aplicam — o
  // quadro já libera esse gesto, e o servidor recusava com o toast de erro.
  if (card.listId !== toList.id) {
    await assertCompliance("card.move", ctx, meta);
    if (toList.semantics === "won") await assertCompliance("opportunity.close", ctx, meta);
  }

  // Posição fracionária entre vizinhos do índice pedido.
  const siblings = await prisma.card.findMany({
    where: { listId: toList.id, id: { not: cardId }, archivedAt: null },
    orderBy: { position: "asc" },
    select: { position: true },
  });
  const index = Math.max(0, Math.min(target.index ?? siblings.length, siblings.length));
  const before = index > 0 ? siblings[index - 1]?.position ?? 0 : 0;
  const after = siblings[index]?.position ?? before + 2048;
  const position = (before + after) / 2;

  const reasonChanged = lossReason !== undefined && lossReason !== stored.lossReason;
  const updated = await prisma.card.update({
    where: { id: cardId },
    data: { listId: toList.id, position, ...(reasonChanged ? { lossReason } : {}) },
  });

  if (reasonChanged) {
    await log(cardId, actor?.id ?? null, "card.updated", { lossReason: stored.lossReason }, { lossReason }, auto);
    await dispatch(
      { type: "card.field_changed", boardKey: card.board.key, cardId, actorId: actor?.id ?? null, field: "lossReason" },
      auto?.depth ?? 0
    );
  }

  if (card.listId !== toList.id) {
    await log(
      cardId,
      actor?.id ?? null,
      "card.moved",
      { list: card.list.name },
      { list: toList.name },
      auto
    );
    await dispatch(
      {
        type: "card.moved",
        boardKey: card.board.key,
        cardId,
        actorId: actor?.id ?? null,
        fromListId: card.listId,
        toListId: toList.id,
      },
      auto?.depth ?? 0
    );
  }
  return updated;
}

/**
 * Exclusão definitiva. Tarefas, comentários, notificações e o histórico do
 * card vão junto (cascade); execuções de automação e violações ficam, sem o
 * card. Um projeto gerado por esta venda continua existindo, só perde o elo
 * de origem. Como o log do card some com ele, o rastro fica na venda/projeto
 * ligado, quando houver.
 */
export async function deleteCard(cardId: string, actor: Actor): Promise<{ title: string }> {
  const card = await requireCard(cardId);
  if (!(await canDeleteCard(actor.id, card.board.key === "sales" ? "opportunity" : "project"))) {
    throw new PermissionError("Seu papel não exclui cards neste quadro.");
  }

  const linked = await prisma.card.findFirst({
    where: { OR: [{ id: card.sourceCardId ?? "" }, { sourceCardId: card.id }] },
    select: { id: true },
  });
  await prisma.card.delete({ where: { id: cardId } });
  if (linked) {
    await log(linked.id, actor.id, "card.linked_deleted", { title: card.title }, null);
  }
  return { title: card.title };
}

export async function addComment(
  cardId: string,
  text: string,
  actor: Actor | null,
  auto?: AutomationContext
): Promise<void> {
  await requireCard(cardId);
  await log(cardId, actor?.id ?? null, "comment", null, { text }, auto);
}

// ---------------------------------------------------------------- colunas

/**
 * Colunas (listas) do quadro. Regras que sustentam o resto do sistema:
 *
 * - `stageKey` é a identidade da coluna para automações e compliance
 *   (`to_list`, `from_list`, `target_list`). Por isso ela é gerada na criação
 *   e NUNCA muda no rename — trocar o nome exibido não pode quebrar regra.
 * - Coluna com `semantics` tem função no fluxo (fecha venda, exige motivo,
 *   bloqueia conclusão, recebe atraso) e não pode ser excluída.
 * - Excluir exige destino para os cards; nada é apagado junto.
 */

function slugify(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 40);
}

async function assertListManager(actor: Actor) {
  if (!(await canManageLists(actor.id))) {
    throw new PermissionError("Seu papel não gerencia as colunas do quadro.");
  }
}

async function uniqueStageKey(boardId: string, name: string): Promise<string> {
  const base = slugify(name) || "coluna";
  for (let i = 0; i < 50; i++) {
    const candidate = i === 0 ? base : `${base}_${i + 1}`;
    const taken = await prisma.list.findUnique({
      where: { boardId_stageKey: { boardId, stageKey: candidate } },
    });
    if (!taken) return candidate;
  }
  return `${base}_${Date.now()}`;
}

export async function createList(
  boardId: string,
  data: { name: string; color?: string | null },
  actor: Actor
) {
  await assertListManager(actor);
  const name = data.name.trim();
  if (!name) throw new PermissionError("Dê um nome à coluna.");

  const board = await prisma.board.findUnique({ where: { id: boardId } });
  if (!board) throw new NotFoundError("Quadro não encontrado.");

  const last = await prisma.list.findFirst({
    where: { boardId },
    orderBy: { position: "desc" },
    select: { position: true },
  });

  return prisma.list.create({
    data: {
      boardId,
      name,
      stageKey: await uniqueStageKey(boardId, name),
      position: (last?.position ?? 0) + 1,
      color: data.color ?? null,
    },
  });
}

export async function updateList(
  listId: string,
  patch: { name?: string; color?: string | null },
  actor: Actor
) {
  await assertListManager(actor);
  const list = await prisma.list.findUnique({ where: { id: listId } });
  if (!list) throw new NotFoundError("Coluna não encontrada.");

  const name = patch.name?.trim();
  if (patch.name !== undefined && !name) throw new PermissionError("A coluna precisa de um nome.");

  // stageKey fica de fora de propósito: renomear não pode quebrar automação.
  return prisma.list.update({
    where: { id: listId },
    data: { name: name ?? list.name, color: patch.color === undefined ? list.color : patch.color },
  });
}

export async function deleteList(listId: string, moveToListId: string | null, actor: Actor) {
  await assertListManager(actor);
  const list = await prisma.list.findUnique({
    where: { id: listId },
    include: { _count: { select: { cards: true } } },
  });
  if (!list) throw new NotFoundError("Coluna não encontrada.");

  if (list.semantics) {
    throw new PermissionError(
      "Esta coluna tem função no fluxo (fechamento, perda, conclusão ou atraso) e não pode ser excluída. Você pode renomeá-la."
    );
  }

  const siblings = await prisma.list.count({ where: { boardId: list.boardId } });
  if (siblings <= 1) throw new PermissionError("O quadro precisa de pelo menos uma coluna.");

  if (list._count.cards > 0) {
    if (!moveToListId) {
      throw new PermissionError(
        `Esta coluna tem ${list._count.cards} card(s). Escolha para onde movê-los antes de excluir.`
      );
    }
    const target = await prisma.list.findUnique({ where: { id: moveToListId } });
    if (!target || target.boardId !== list.boardId)
      throw new NotFoundError("Coluna de destino não encontrada.");
    if (target.id === list.id) throw new PermissionError("Escolha uma coluna diferente.");

    // Move sem passar pelo motor: é uma operação de estrutura, não de fluxo —
    // disparar automações de "card mudou de lista" aqui seria ruído.
    await prisma.card.updateMany({ where: { listId }, data: { listId: target.id } });
  }

  await prisma.list.delete({ where: { id: listId } });
}

export async function reorderLists(boardId: string, orderedIds: string[], actor: Actor) {
  await assertListManager(actor);
  const lists = await prisma.list.findMany({ where: { boardId }, select: { id: true } });
  const known = new Set(lists.map((l) => l.id));
  if (orderedIds.length !== known.size || orderedIds.some((id) => !known.has(id))) {
    throw new PermissionError("A ordem enviada não corresponde às colunas do quadro.");
  }
  await prisma.$transaction(
    orderedIds.map((id, i) => prisma.list.update({ where: { id }, data: { position: i + 1 } }))
  );
}

// ------------------------------------------------------------ comentários

/**
 * Comentário escrito por uma pessoa (ver `addComment` acima para a nota
 * automática das automações). Fica na tabela `comments`: o autor pode editar
 * e apagar, e por isso não entra em `activity_log`, que é imutável. Cada
 * edição e remoção, porém, deixa rastro no log.
 */
export async function createComment(cardId: string, text: string, actor: Actor) {
  await requireCard(cardId);
  if (!(await canComment(actor.id))) {
    throw new PermissionError("Seu papel não pode comentar nos cards.");
  }
  const body = text.trim();
  if (!body) throw new PermissionError("Escreva algo antes de comentar.");

  const comment = await prisma.comment.create({
    data: { cardId, authorId: actor.id, text: body },
  });
  await log(cardId, actor.id, "comment.created", null, { commentId: comment.id });
  return comment;
}

async function requireOwnComment(commentId: string, actor: Actor, verb: string) {
  const comment = await prisma.comment.findUnique({ where: { id: commentId } });
  if (!comment) throw new NotFoundError("Comentário não encontrado.");
  // O admin modera; os demais mexem apenas no que escreveram. O papel vem do
  // banco, não da sessão: o JWT guarda o papel de quando a pessoa entrou.
  const isAdmin = verb === "remover" && (await loadUserPermissions(actor.id))?.role === "admin";
  const allowed = comment.authorId === actor.id || isAdmin;
  if (!allowed) throw new PermissionError(`Você só pode ${verb} os próprios comentários.`);
  return comment;
}

export async function updateComment(commentId: string, text: string, actor: Actor) {
  const comment = await requireOwnComment(commentId, actor, "editar");
  const body = text.trim();
  if (!body) throw new PermissionError("O comentário não pode ficar vazio.");
  if (body === comment.text) return comment;

  const updated = await prisma.comment.update({
    where: { id: commentId },
    data: { text: body, editedAt: new Date() },
  });
  await log(comment.cardId, actor.id, "comment.edited", { text: comment.text }, { text: body });
  return updated;
}

export async function deleteComment(commentId: string, actor: Actor) {
  const comment = await requireOwnComment(commentId, actor, "remover");
  await prisma.comment.delete({ where: { id: commentId } });
  await log(comment.cardId, actor.id, "comment.deleted", { text: comment.text }, null);
}

// ---------------------------------------------------------------- tasks

export async function createTask(
  cardId: string,
  data: { title: string; dueDate: Date | null; assigneeId?: string | null },
  actor: Actor | null,
  auto?: AutomationContext
) {
  const card = await requireCard(cardId);
  if (actor && !(await canManageTasks(actor.id, card.board.key === "sales" ? "opportunity" : "project", card))) {
    throw new PermissionError("Você só adiciona tarefas em cards que pode editar.");
  }

  await assertCompliance(
    "task.create",
    cardContext(card, {
      toList: card.list,
      task: { title: data.title, dueDate: data.dueDate as Date, assigneeId: data.assigneeId ?? null },
    }),
    { cardId, actorId: actor?.id ?? null, action: { kind: "task.create", title: data.title } }
  );
  if (!data.dueDate) {
    // Nunca deveria chegar aqui (a regra nativa bloqueia antes); NOT NULL é a rede final.
    throw new NotFoundError("Tarefa sem prazo não pode ser criada.");
  }

  const last = await prisma.task.findFirst({
    where: { cardId },
    orderBy: { position: "desc" },
    select: { position: true },
  });
  const task = await prisma.task.create({
    data: {
      cardId,
      title: data.title,
      dueDate: data.dueDate,
      assigneeId: data.assigneeId ?? null,
      position: (last?.position ?? 0) + 1024,
    },
  });

  await log(cardId, actor?.id ?? null, "task.created", null, { title: task.title }, auto);
  await dispatch(
    {
      type: "task.created",
      boardKey: card.board.key,
      cardId,
      actorId: actor?.id ?? null,
      taskId: task.id,
    },
    auto?.depth ?? 0
  );
  return task;
}

export async function updateTask(
  taskId: string,
  patch: Partial<{ title: string; dueDate: Date; assigneeId: string | null }>,
  actor: Actor | null,
  auto?: AutomationContext
) {
  const task = await prisma.task.findUnique({ where: { id: taskId } });
  if (!task) throw new NotFoundError("Tarefa não encontrada.");
  const card = await requireCard(task.cardId);
  if (actor && !(await canManageTasks(actor.id, card.board.key === "sales" ? "opportunity" : "project", card))) {
    throw new PermissionError("Você só edita tarefas de cards que pode editar.");
  }

  await assertCompliance(
    "task.update",
    cardContext(card, {
      toList: card.list,
      task: {
        title: patch.title ?? task.title,
        dueDate: patch.dueDate === undefined ? task.dueDate : patch.dueDate,
        assigneeId: patch.assigneeId === undefined ? task.assigneeId : patch.assigneeId,
      },
    }),
    { cardId: card.id, actorId: actor?.id ?? null, action: { kind: "task.update", taskId } }
  );

  const updated = await prisma.task.update({ where: { id: taskId }, data: patch });
  await log(card.id, actor?.id ?? null, "task.updated", { title: task.title }, { title: updated.title }, auto);
  return updated;
}

export async function toggleTask(taskId: string, done: boolean, actor: Actor | null) {
  const task = await prisma.task.findUnique({ where: { id: taskId } });
  if (!task) throw new NotFoundError("Tarefa não encontrada.");
  const card = await requireCard(task.cardId);
  if (actor && !(await canCompleteTask(actor.id))) {
    throw new PermissionError("Seu papel não pode concluir tarefas do checklist.");
  }

  const updated = await prisma.task.update({
    where: { id: taskId },
    data: { done, completedAt: done ? new Date() : null },
  });
  await log(
    card.id,
    actor?.id ?? null,
    done ? "task.completed" : "task.reopened",
    null,
    { title: task.title }
  );
  if (done) {
    await dispatch({
      type: "task.completed",
      boardKey: card.board.key,
      cardId: card.id,
      actorId: actor?.id ?? null,
      taskId,
    });
  }
  return updated;
}

export async function deleteTask(taskId: string, actor: Actor | null) {
  const task = await prisma.task.findUnique({ where: { id: taskId } });
  if (!task) throw new NotFoundError("Tarefa não encontrada.");
  const card = await requireCard(task.cardId);
  if (actor && !(await canManageTasks(actor.id, card.board.key === "sales" ? "opportunity" : "project", card))) {
    throw new PermissionError("Você só remove tarefas de cards que pode editar.");
  }
  await prisma.task.delete({ where: { id: taskId } });
  await log(card.id, actor?.id ?? null, "task.deleted", { title: task.title }, null);
}

export async function reorderTasks(cardId: string, orderedIds: string[], actor: Actor | null) {
  const card = await requireCard(cardId);
  if (actor && !(await canManageTasks(actor.id, card.board.key === "sales" ? "opportunity" : "project", card))) {
    throw new PermissionError("Você só reordena tarefas de cards que pode editar.");
  }
  await prisma.$transaction(
    orderedIds.map((id, i) =>
      prisma.task.update({ where: { id, cardId }, data: { position: (i + 1) * 1024 } })
    )
  );
}
