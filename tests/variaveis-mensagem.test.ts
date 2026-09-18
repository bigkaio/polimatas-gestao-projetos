import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import * as domain from "@/core/domain";
import { cardContext } from "@/core/context";
import { renderTemplate } from "@/core/conditions";
import type { Actor } from "@/core/events";
import { TEMPLATE_VARS, previewValues, renderPreview, unknownVars } from "@/lib/template-vars";
import { actorWithRole, cleanupTestUsers } from "./helpers";

/**
 * Variáveis `{{...}}` das mensagens: o catálogo do construtor tem de bater com
 * o que o motor entrega na hora do envio — senão a tela promete um valor que
 * chega vazio no WhatsApp.
 */

describe("catálogo de variáveis", () => {
  it("acusa variável inexistente e aceita as do catálogo", () => {
    expect(unknownVars("Olá {{card.client_name}}, valor {{card.amount_brl}}")).toEqual([]);
    expect(unknownVars("Valor: {{valor}} e {{card.cliente}}")).toEqual(["valor", "card.cliente"]);
    // formas antigas continuam válidas: há regras gravadas com elas
    expect(unknownVars("{{client_name}} — {{card.title}}")).toEqual([]);
  });

  it("a pré-visualização usa o card real quando existe", () => {
    const texto = "*Venda:* {{card.title}} — {{card.client_name}} — {{card.amount_brl}}";
    expect(renderPreview(texto, previewValues(null))).toBe(
      "*Venda:* E-commerce B2B — Distribuidora Norte — R$ 65.000,00",
    );
    const real = renderPreview(
      texto,
      previewValues({
        title: "Portal do aluno",
        clientName: "Colégio Horizonte",
        amountBRL: "R$ 42.000,00",
        dueDateBR: null,
        leadSource: null,
        assigneeName: null,
        listName: null,
        openTasks: 0,
      }),
    );
    expect(real).toBe("*Venda:* Portal do aluno — Colégio Horizonte — R$ 42.000,00");
  });
});

describe("o que o motor entrega", () => {
  let manager: Actor;
  let cardId: string;

  beforeAll(async () => {
    await cleanupTestUsers();
    manager = await actorWithRole("manager");
    const board = await prisma.board.findUniqueOrThrow({ where: { key: "sales" } });
    const list = await prisma.list.findFirstOrThrow({
      where: { boardId: board.id, stageKey: "lead" },
    });
    const card = await domain.createCard(
      {
        boardId: board.id,
        listId: list.id,
        type: "opportunity",
        title: "[vars] oportunidade",
        clientName: "Cliente das Variáveis",
        leadSource: "Indicação",
        amount: "65000.00",
        dueDate: new Date("2026-11-07T00:00:00Z"),
        assigneeId: manager.id,
        createdBy: manager.id,
      },
      manager,
    );
    cardId = card.id;
  });

  afterAll(async () => {
    await prisma.card.deleteMany({ where: { title: { startsWith: "[vars]" } } });
    await cleanupTestUsers();
  });

  it("toda variável do catálogo existe no contexto do card", async () => {
    const card = await prisma.card.findUniqueOrThrow({
      where: { id: cardId },
      include: { list: true, tasks: true, assignee: { select: { name: true } } },
    });
    const ctx = cardContext(card, { toList: card.list });
    for (const v of TEMPLATE_VARS.filter((v) => v.group !== "tarefa")) {
      expect(Object.keys(ctx), `faltou ${v.key}`).toContain(v.key);
    }
  });

  it("responsável sai como nome e prazo em formato brasileiro", async () => {
    const card = await prisma.card.findUniqueOrThrow({
      where: { id: cardId },
      include: { list: true, tasks: true, assignee: { select: { name: true } } },
    });
    const ctx = cardContext(card, { toList: card.list });

    expect(renderTemplate("{{card.assignee_name}}", ctx)).toBe("Teste manager");
    expect(renderTemplate("{{card.due_date_br}}", ctx)).toBe("07/11/2026");
    // a forma crua continua para as condições, que comparam id e data ISO
    expect(renderTemplate("{{card.assignee}}", ctx)).toBe(manager.id);
    expect(renderTemplate("{{card.due_date}}", ctx)).toBe("2026-11-07");
  });

  it("variável inexistente vira vazio (é por isso que a tela avisa antes)", async () => {
    const card = await prisma.card.findUniqueOrThrow({
      where: { id: cardId },
      include: { list: true, tasks: true, assignee: { select: { name: true } } },
    });
    const ctx = cardContext(card, { toList: card.list });
    expect(renderTemplate("Valor: {{valor}}", ctx)).toBe("Valor: ");
  });
});
