import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import * as domain from "@/core/domain";
import { cardContext } from "@/core/context";
import { evaluateGroup } from "@/core/conditions";
import type { Actor } from "@/core/events";
import { actorWithRole, cleanupTestUsers } from "./helpers";

/** Origem do lead na oportunidade: gravada na criação, editável e visível às regras. */

let salesActor: Actor;
let salesBoardId: string;
let leadListId: string;

beforeAll(async () => {
  await cleanupTestUsers();
  salesActor = await actorWithRole("sales");
  const board = await prisma.board.findUniqueOrThrow({ where: { key: "sales" }, include: { lists: true } });
  salesBoardId = board.id;
  leadListId = board.lists.find((l) => l.stageKey === "lead")!.id;
});

afterAll(async () => {
  await prisma.card.deleteMany({ where: { title: { startsWith: "[origem]" } } });
  await cleanupTestUsers();
});

describe("origem do lead", () => {
  it("nasce com a origem e pode trocá-la depois", async () => {
    const card = await domain.createCard(
      {
        boardId: salesBoardId,
        listId: leadListId,
        type: "opportunity",
        title: "[origem] vinda do Instagram",
        clientName: "Cliente",
        leadSource: "Instagram",
        createdBy: salesActor.id,
      },
      salesActor
    );
    expect(card.leadSource).toBe("Instagram");

    await domain.updateCard(card.id, { leadSource: "Feira do setor" }, salesActor);
    const after = await prisma.card.findUniqueOrThrow({ where: { id: card.id } });
    expect(after.leadSource).toBe("Feira do setor");

    // a troca fica no histórico como qualquer outro campo
    const log = await prisma.activityLog.findFirst({
      where: { cardId: card.id, action: "card.updated" },
      orderBy: { createdAt: "desc" },
    });
    expect(JSON.stringify(log?.after)).toContain("Feira do setor");
  });

  it("entra no contexto das automações e do compliance como card.lead_source", async () => {
    const card = await prisma.card.findFirstOrThrow({ where: { title: "[origem] vinda do Instagram" } });
    const ctx = cardContext(card);
    expect(ctx["card.lead_source"]).toBe("Feira do setor");
    expect(
      evaluateGroup(
        { op: "AND", rules: [{ field: "card.lead_source", operator: "contains", value: "Feira" }] },
        ctx
      )
    ).toBe(true);
  });
});
