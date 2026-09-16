import { afterEach, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { createMemberAccount, login } from "@/lib/auth";
import { invalidatePermissionCache, isActiveUser, loadUserPermissions } from "@/core/permission-store";

/** Desativar tira o acesso sem apagar o rastro da pessoa. */

const EMAIL = "desativavel.teste@polimatas.dev";

async function criar() {
  const r = await createMemberAccount("Pessoa Desativável", EMAIL, "manager");
  if ("error" in r) throw new Error(r.error);
  return r;
}

afterEach(async () => {
  await prisma.profile.deleteMany({ where: { email: EMAIL } });
  invalidatePermissionCache();
});

describe("desativar usuário", () => {
  it("pessoa ativa tem as capacidades do modelo da função", async () => {
    const { user } = await criar();
    expect(await isActiveUser(user.id)).toBe(true);
    const perms = await loadUserPermissions(user.id);
    expect(perms?.role).toBe("manager");
  });

  it("desativada perde todas as capacidades, sem precisar mexer em permissão", async () => {
    const { user } = await criar();
    await prisma.profile.update({ where: { id: user.id }, data: { deactivatedAt: new Date() } });
    invalidatePermissionCache(user.id);

    expect(await isActiveUser(user.id)).toBe(false);
    expect(await loadUserPermissions(user.id)).toBeNull();
  });

  it("desativada não consegue mais entrar, nem com a senha certa", async () => {
    const { user, temporaryPassword } = await criar();
    await prisma.profile.update({ where: { id: user.id }, data: { deactivatedAt: new Date() } });
    invalidatePermissionCache(user.id);

    await expect(login(EMAIL, temporaryPassword)).resolves.toBeNull();
  });

  it("reativar devolve o acesso", async () => {
    const { user } = await criar();
    await prisma.profile.update({ where: { id: user.id }, data: { deactivatedAt: new Date() } });
    invalidatePermissionCache(user.id);
    await prisma.profile.update({ where: { id: user.id }, data: { deactivatedAt: null } });
    invalidatePermissionCache(user.id);

    expect(await isActiveUser(user.id)).toBe(true);
  });

  it("o banco impede apagar quem criou card — por isso existe o desativar", async () => {
    const { user } = await criar();
    const board = await prisma.board.findUniqueOrThrow({
      where: { key: "projects" },
      include: { lists: true },
    });
    const card = await prisma.card.create({
      data: {
        boardId: board.id,
        listId: board.lists[0]!.id,
        type: "project",
        title: "[del] card de quem vai sair",
        position: 1,
        createdBy: user.id,
      },
    });

    await expect(prisma.profile.delete({ where: { id: user.id } })).rejects.toThrow();

    await prisma.card.delete({ where: { id: card.id } });
    await expect(prisma.profile.delete({ where: { id: user.id } })).resolves.toBeTruthy();
  });
});
