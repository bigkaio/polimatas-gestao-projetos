import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import * as domain from "@/core/domain";
import { PermissionError } from "@/core/errors";
import type { Actor } from "@/core/events";
import { DEFAULT_MATRIX, applyOverrides, can } from "@/core/permissions";
import { invalidatePermissionCache, loadPermissionMatrix } from "@/core/permission-store";

/**
 * A matriz de permissões é editável pelo admin (seção 3.1) e o efeito precisa
 * valer na camada de domínio — não só na interface.
 */

async function actorOf(email: string): Promise<Actor> {
  const user = await prisma.profile.findUniqueOrThrow({ where: { email } });
  return { id: user.id, role: user.role };
}

async function override(role: "sales" | "member" | "manager", capability: string, allowed: boolean) {
  await prisma.rolePermission.upsert({
    where: { role_capability: { role, capability } },
    create: { role, capability, allowed },
    update: { allowed },
  });
  invalidatePermissionCache();
}

afterEach(async () => {
  await prisma.rolePermission.deleteMany({});
  invalidatePermissionCache();
});

describe("matriz de permissões", () => {
  it("sem overrides, entrega o padrão do briefing", async () => {
    const matrix = await loadPermissionMatrix();
    expect(matrix).toEqual(DEFAULT_MATRIX);
    expect(can(matrix, "sales", "board.projects.mutate")).toBe(false);
    expect(can(matrix, "member", "board.sales.mutate")).toBe(false);
  });

  it("o override do admin substitui o padrão", async () => {
    await override("member", "board.sales.mutate", true);
    const matrix = await loadPermissionMatrix();
    expect(can(matrix, "member", "board.sales.mutate")).toBe(true);
  });

  it("ignora override gravado para admin — ele nunca perde capacidade", () => {
    const matrix = applyOverrides([
      { role: "admin", capability: "compliance.manage", allowed: false },
    ]);
    expect(can(matrix, "admin", "compliance.manage")).toBe(true);
  });

  it("ignora capacidade desconhecida sem derrubar a matriz", () => {
    const matrix = applyOverrides([
      { role: "sales", capability: "capacidade.inexistente", allowed: true },
    ]);
    expect(matrix.sales).toEqual(DEFAULT_MATRIX.sales);
  });
});

describe("efeito no domínio", () => {
  let projectsBoardId: string;
  let backlogId: string;

  beforeEach(async () => {
    const board = await prisma.board.findUniqueOrThrow({
      where: { key: "projects" },
      include: { lists: true },
    });
    projectsBoardId = board.id;
    backlogId = board.lists.find((l) => l.stageKey === "backlog")!.id;
  });

  it("nega ao vendedor criar card de projeto (padrão)", async () => {
    const sales = await actorOf("vendas@polimatas.dev");
    await expect(
      domain.createCard(
        {
          boardId: projectsBoardId,
          listId: backlogId,
          type: "project",
          title: "Projeto proibido",
          createdBy: sales.id,
        },
        sales
      )
    ).rejects.toBeInstanceOf(PermissionError);
  });

  it("passa a permitir assim que o admin liga a capacidade", async () => {
    const sales = await actorOf("vendas@polimatas.dev");
    await override("sales", "board.projects.mutate", true);

    const card = await domain.createCard(
      {
        boardId: projectsBoardId,
        listId: backlogId,
        type: "project",
        title: "Projeto liberado pela matriz",
        createdBy: sales.id,
      },
      sales
    );
    expect(card.id).toBeTruthy();
    await prisma.card.delete({ where: { id: card.id } });
  });

  it("desligar `task.complete` recusa concluir tarefa do checklist", async () => {
    const manager = await actorOf("gestor@polimatas.dev");
    const card = await prisma.card.findFirstOrThrow({ where: { type: "project" } });
    const task = await domain.createTask(
      card.id,
      { title: "Tarefa de teste de permissão", dueDate: new Date(Date.now() + 86_400_000) },
      manager
    );

    await override("manager", "task.complete", false);
    await expect(domain.toggleTask(task.id, true, manager)).rejects.toBeInstanceOf(PermissionError);

    await override("manager", "task.complete", true);
    await expect(domain.toggleTask(task.id, true, manager)).resolves.toBeTruthy();

    await prisma.task.delete({ where: { id: task.id } });
  });
});
