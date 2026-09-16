import { afterEach, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import * as domain from "@/core/domain";
import { PermissionError } from "@/core/errors";
import { invalidatePermissionCache } from "@/core/permission-store";
import { actorWithRole, cleanupTestUsers } from "./helpers";

/** Comentários: quem escreve, quem edita, quem remove. */


async function anyCard() {
  return prisma.card.findFirstOrThrow({ where: { archivedAt: null } });
}

afterEach(async () => {
  await prisma.comment.deleteMany({ where: { text: { startsWith: "[teste]" } } });
  await prisma.userPermission.deleteMany({});
  await cleanupTestUsers();
  invalidatePermissionCache();
});

describe("comentários no card", () => {
  it("qualquer papel comenta por padrão, e o texto fica registrado", async () => {
    const card = await anyCard();
    const member = await actorWithRole("member");
    const comment = await domain.createComment(card.id, "  [teste] alinhado com o cliente  ", member);

    expect(comment.text).toBe("[teste] alinhado com o cliente"); // espaços das pontas removidos
    expect(comment.authorId).toBe(member.id);
    expect(comment.editedAt).toBeNull();

    const logged = await prisma.activityLog.findFirst({
      where: { cardId: card.id, action: "comment.created" },
      orderBy: { createdAt: "desc" },
    });
    expect(logged).not.toBeNull();
  });

  it("recusa comentário vazio", async () => {
    const card = await anyCard();
    const member = await actorWithRole("member");
    await expect(domain.createComment(card.id, "   ", member)).rejects.toBeInstanceOf(PermissionError);
  });

  it("o autor edita o próprio; outra pessoa não", async () => {
    const card = await anyCard();
    const member = await actorWithRole("member");
    const sales = await actorWithRole("sales");
    const comment = await domain.createComment(card.id, "[teste] original", member);

    await expect(domain.updateComment(comment.id, "[teste] alheio", sales)).rejects.toBeInstanceOf(
      PermissionError
    );

    const edited = await domain.updateComment(comment.id, "[teste] corrigido", member);
    expect(edited.text).toBe("[teste] corrigido");
    expect(edited.editedAt).not.toBeNull();
  });

  it("o admin remove comentário de outra pessoa; um par, não", async () => {
    const card = await anyCard();
    const member = await actorWithRole("member");
    const sales = await actorWithRole("sales");
    const admin = await actorWithRole("admin");

    const comment = await domain.createComment(card.id, "[teste] para moderar", member);
    await expect(domain.deleteComment(comment.id, sales)).rejects.toBeInstanceOf(PermissionError);

    await domain.deleteComment(comment.id, admin);
    expect(await prisma.comment.findUnique({ where: { id: comment.id } })).toBeNull();
  });

  it("o admin pode desligar `card.comment` para um papel", async () => {
    const card = await anyCard();
    const sales = await actorWithRole("sales");
    await prisma.userPermission.create({
      data: { userId: sales.id, capability: "card.comment", allowed: false },
    });
    invalidatePermissionCache();

    await expect(domain.createComment(card.id, "[teste] bloqueado", sales)).rejects.toBeInstanceOf(
      PermissionError
    );
  });
});
