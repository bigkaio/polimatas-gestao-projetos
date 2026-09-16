import { afterEach, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import * as domain from "@/core/domain";
import { PermissionError } from "@/core/errors";
import { invalidatePermissionCache } from "@/core/permission-store";
import { actorWithRole, cleanupTestUsers } from "./helpers";

/** Personalização das colunas, com as travas que protegem o fluxo. */

const projectsBoard = () => prisma.board.findUniqueOrThrow({ where: { key: "projects" } });

afterEach(async () => {
  await prisma.card.deleteMany({ where: { title: { startsWith: "[COL]" } } });
  await prisma.list.deleteMany({ where: { name: { startsWith: "[COL]" } } });
  await prisma.userPermission.deleteMany({});
  await cleanupTestUsers();
  invalidatePermissionCache();
});

describe("colunas do quadro", () => {
  it("cria com chave derivada do nome, sem acento nem espaço", async () => {
    const board = await projectsBoard();
    const admin = await actorWithRole("admin");
    const list = await domain.createList(board.id, { name: "[COL] Validação Técnica", color: "violet" }, admin);

    expect(list.stageKey).toBe("col_validacao_tecnica");
    expect(list.color).toBe("violet");
    expect(list.semantics).toBeNull();
  });

  it("renomear NÃO muda a chave — automações e compliance continuam valendo", async () => {
    const board = await projectsBoard();
    const admin = await actorWithRole("admin");
    const list = await domain.createList(board.id, { name: "[COL] Original" }, admin);

    const renomeada = await domain.updateList(list.id, { name: "[COL] Nome Novo" }, admin);
    expect(renomeada.name).toBe("[COL] Nome Novo");
    expect(renomeada.stageKey).toBe(list.stageKey);
  });

  it("chave duplicada ganha sufixo em vez de estourar", async () => {
    const board = await projectsBoard();
    const admin = await actorWithRole("admin");
    const a = await domain.createList(board.id, { name: "[COL] Repetida" }, admin);
    const b = await domain.createList(board.id, { name: "[COL] Repetida" }, admin);
    expect(b.stageKey).toBe(`${a.stageKey}_2`);
  });

  it("recusa excluir coluna com função no fluxo", async () => {
    const admin = await actorWithRole("admin");
    const concluido = await prisma.list.findFirstOrThrow({
      where: { stageKey: "concluido", board: { key: "projects" } },
    });
    await expect(domain.deleteList(concluido.id, null, admin)).rejects.toBeInstanceOf(PermissionError);
    expect(await prisma.list.findUnique({ where: { id: concluido.id } })).not.toBeNull();
  });

  it("coluna com cards exige destino, e os cards são movidos — não apagados", async () => {
    const board = await projectsBoard();
    const admin = await actorWithRole("admin");
    const origem = await domain.createList(board.id, { name: "[COL] Origem" }, admin);
    const destino = await domain.createList(board.id, { name: "[COL] Destino" }, admin);
    const card = await domain.createCard(
      { boardId: board.id, listId: origem.id, type: "project", title: "[COL] card que não pode sumir", createdBy: admin.id },
      admin
    );

    await expect(domain.deleteList(origem.id, null, admin)).rejects.toBeInstanceOf(PermissionError);

    await domain.deleteList(origem.id, destino.id, admin);
    const sobrevivente = await prisma.card.findUnique({ where: { id: card.id } });
    expect(sobrevivente?.listId).toBe(destino.id);
    expect(await prisma.list.findUnique({ where: { id: origem.id } })).toBeNull();
  });

  it("papel sem `lists.manage` não mexe nas colunas", async () => {
    const board = await projectsBoard();
    const vendas = await actorWithRole("sales");
    await expect(domain.createList(board.id, { name: "[COL] Proibida" }, vendas)).rejects.toBeInstanceOf(
      PermissionError
    );
  });

  it("o admin pode conceder `lists.manage` a outro papel", async () => {
    const board = await projectsBoard();
    const vendas = await actorWithRole("sales");
    await prisma.userPermission.create({
      data: { userId: vendas.id, capability: "lists.manage", allowed: true },
    });
    invalidatePermissionCache();

    const list = await domain.createList(board.id, { name: "[COL] Liberada" }, vendas);
    expect(list.id).toBeTruthy();
  });

  it("reordenar exige a lista completa do quadro", async () => {
    const board = await projectsBoard();
    const admin = await actorWithRole("admin");
    await expect(domain.reorderLists(board.id, ["nao", "existe"], admin)).rejects.toBeInstanceOf(
      PermissionError
    );
  });
});
