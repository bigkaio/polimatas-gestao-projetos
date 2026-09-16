import { afterEach, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import * as domain from "@/core/domain";
import { PermissionError } from "@/core/errors";
import { DEFAULT_MATRIX, buildUserPermissions, can, defaultFor } from "@/core/permissions";
import { invalidatePermissionCache, loadUserPermissions } from "@/core/permission-store";
import { actorWithRole, cleanupTestUsers } from "./helpers";

/**
 * As permissões são por PESSOA. A função continua existindo como modelo:
 * sem personalização, vale o padrão dela.
 */



async function personalizar(userId: string, capability: string, allowed: boolean) {
  await prisma.userPermission.upsert({
    where: { userId_capability: { userId, capability } },
    create: { userId, capability, allowed },
    update: { allowed },
  });
  invalidatePermissionCache(userId);
}

afterEach(async () => {
  await prisma.userPermission.deleteMany({});
  await cleanupTestUsers();
  invalidatePermissionCache();
});

describe("modelo da função", () => {
  it("sem personalização, a pessoa segue o padrão do papel dela", async () => {
    const vendas = await actorWithRole("sales");
    const perms = await loadUserPermissions(vendas.id);
    expect(perms).toEqual({ role: "sales", overrides: {} });
    expect(can(perms!, "board.sales.mutate")).toBe(true);
    expect(can(perms!, "board.projects.mutate")).toBe(false);
    expect(defaultFor("sales", "automations.manage")).toBe(
      DEFAULT_MATRIX.sales["automations.manage"]
    );
  });

  it("a personalização de uma pessoa vence o modelo — e não contamina quem tem a mesma função", async () => {
    const vendas = await actorWithRole("sales");
    const executor = await actorWithRole("member");
    await personalizar(executor.id, "board.projects.mutate", true);

    expect(can((await loadUserPermissions(executor.id))!, "board.projects.mutate")).toBe(true);
    expect(can((await loadUserPermissions(vendas.id))!, "board.projects.mutate")).toBe(false);
  });

  it("capacidade desconhecida no banco é ignorada", () => {
    const perms = buildUserPermissions("sales", [
      { capability: "capacidade.inexistente", allowed: true },
    ]);
    expect(perms.overrides).toEqual({});
  });

  it("dois admins são independentes: dá para tirar permissão de um deles", async () => {
    const admin = await actorWithRole("admin");
    await personalizar(admin.id, "compliance.manage", false);
    expect(can((await loadUserPermissions(admin.id))!, "compliance.manage")).toBe(false);
  });
});

describe("efeito no domínio", () => {
  let projectsBoardId: string;
  let backlogId: string;

  async function ids() {
    const board = await prisma.board.findUniqueOrThrow({
      where: { key: "projects" },
      include: { lists: true },
    });
    projectsBoardId = board.id;
    backlogId = board.lists.find((l) => l.stageKey === "backlog")!.id;
  }

  it("nega ao vendedor criar card de projeto (modelo da função)", async () => {
    await ids();
    const sales = await actorWithRole("sales");
    await expect(
      domain.createCard(
        {
          boardId: projectsBoardId,
          listId: backlogId,
          type: "project",
          title: "[perm] proibido",
          createdBy: sales.id,
        },
        sales
      )
    ).rejects.toBeInstanceOf(PermissionError);
  });

  it("libera assim que a permissão é dada àquela pessoa", async () => {
    await ids();
    const sales = await actorWithRole("sales");
    await personalizar(sales.id, "board.projects.mutate", true);

    const card = await domain.createCard(
      {
        boardId: projectsBoardId,
        listId: backlogId,
        type: "project",
        title: "[perm] liberado para esta pessoa",
        createdBy: sales.id,
      },
      sales
    );
    expect(card.id).toBeTruthy();
    await prisma.card.delete({ where: { id: card.id } });
  });

  it("desligar `task.complete` de uma pessoa recusa a conclusão só para ela", async () => {
    const manager = await actorWithRole("manager");
    const admin = await actorWithRole("admin");
    const card = await prisma.card.findFirstOrThrow({ where: { type: "project" } });
    const task = await domain.createTask(
      card.id,
      { title: "[perm] tarefa de teste", dueDate: new Date(Date.now() + 86_400_000) },
      manager
    );

    await personalizar(manager.id, "task.complete", false);
    await expect(domain.toggleTask(task.id, true, manager)).rejects.toBeInstanceOf(PermissionError);
    await expect(domain.toggleTask(task.id, true, admin)).resolves.toBeTruthy();

    await prisma.task.delete({ where: { id: task.id } });
  });
});
