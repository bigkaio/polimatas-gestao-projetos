import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import * as domain from "@/core/domain";
import { PermissionError } from "@/core/errors";
import type { Actor } from "@/core/events";
import { invalidatePermissionCache } from "@/core/permission-store";
import { actorWithRole, cleanupTestUsers } from "./helpers";

/** Exclusão de cards: capacidade `card.delete` + o que vai junto e o que fica. */

let manager: Actor;
let salesActor: Actor;
let salesBoardId: string;
let projectsBoardId: string;
let lists: Record<string, { id: string }>;

beforeAll(async () => {
  await cleanupTestUsers();
  manager = await actorWithRole("manager");
  salesActor = await actorWithRole("sales");
  salesBoardId = (await prisma.board.findUniqueOrThrow({ where: { key: "sales" } })).id;
  projectsBoardId = (await prisma.board.findUniqueOrThrow({ where: { key: "projects" } })).id;
  const all = await prisma.list.findMany();
  lists = Object.fromEntries(all.map((l) => [l.stageKey, { id: l.id }]));
  await prisma.card.deleteMany({ where: { title: { startsWith: "[excluir]" } } });
});

afterAll(async () => {
  await prisma.card.deleteMany({ where: { title: { startsWith: "[excluir]" } } });
  await cleanupTestUsers();
});

async function project(title: string) {
  return domain.createCard(
    {
      boardId: projectsBoardId,
      listId: lists.backlog!.id,
      type: "project",
      title,
      assigneeId: manager.id,
      createdBy: manager.id,
    },
    manager
  );
}

describe("excluir card", () => {
  it("gestor exclui o card e tudo que pendura nele", async () => {
    const card = await project("[excluir] projeto com tarefa");
    await domain.createTask(
      card.id,
      { title: "[excluir] tarefa", dueDate: new Date(Date.now() + 86_400_000) },
      manager
    );
    await domain.createComment(card.id, "[excluir] comentário", manager);

    const { title } = await domain.deleteCard(card.id, manager);
    expect(title).toBe("[excluir] projeto com tarefa");

    expect(await prisma.card.findUnique({ where: { id: card.id } })).toBeNull();
    expect(await prisma.task.count({ where: { cardId: card.id } })).toBe(0);
    expect(await prisma.comment.count({ where: { cardId: card.id } })).toBe(0);
    expect(await prisma.activityLog.count({ where: { cardId: card.id } })).toBe(0);
  });

  it("vendedor não exclui projeto (modelo da função); com a permissão, exclui a própria oportunidade", async () => {
    const card = await project("[excluir] fora do alcance do vendedor");
    await expect(domain.deleteCard(card.id, salesActor)).rejects.toBeInstanceOf(PermissionError);
    expect(await prisma.card.findUnique({ where: { id: card.id } })).not.toBeNull();

    const opp = await domain.createCard(
      {
        boardId: salesBoardId,
        listId: lists.lead!.id,
        type: "opportunity",
        title: "[excluir] oportunidade",
        clientName: "Cliente",
        createdBy: salesActor.id,
      },
      salesActor
    );
    // sem a capacidade, nem no próprio quadro
    await expect(domain.deleteCard(opp.id, salesActor)).rejects.toBeInstanceOf(PermissionError);

    await prisma.userPermission.create({
      data: { userId: salesActor.id, capability: "card.delete", allowed: true },
    });
    invalidatePermissionCache(salesActor.id);
    await domain.deleteCard(opp.id, salesActor);
    expect(await prisma.card.findUnique({ where: { id: opp.id } })).toBeNull();

    // a capacidade não abre o quadro de projetos, que o vendedor não move
    await expect(domain.deleteCard(card.id, salesActor)).rejects.toBeInstanceOf(PermissionError);
  });

  it("excluir a venda mantém o projeto gerado, sem o elo de origem e com o rastro no histórico", async () => {
    const opp = await domain.createCard(
      {
        boardId: salesBoardId,
        listId: lists.negociacao!.id,
        type: "opportunity",
        title: "[excluir] venda que virou projeto",
        clientName: "Cliente Excluído",
        amount: "1000.00",
        assigneeId: manager.id,
        createdBy: manager.id,
      },
      manager
    );
    await domain.moveCard(opp.id, { toListId: lists.fechado!.id }, manager);
    const spawned = await prisma.card.findUniqueOrThrow({ where: { sourceCardId: opp.id } });

    await domain.deleteCard(opp.id, manager);

    const after = await prisma.card.findUniqueOrThrow({ where: { id: spawned.id } });
    expect(after.sourceCardId).toBeNull();
    const trace = await prisma.activityLog.findFirst({
      where: { cardId: spawned.id, action: "card.linked_deleted" },
    });
    expect(JSON.stringify(trace?.before)).toContain("[excluir] venda que virou projeto");

    await prisma.card.delete({ where: { id: spawned.id } });
  });
});
