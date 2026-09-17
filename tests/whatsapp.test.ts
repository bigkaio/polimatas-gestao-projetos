import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { prisma } from "@/lib/prisma";
import * as domain from "@/core/domain";
import { runAutomation } from "@/core/engine";
import type { Actor } from "@/core/events";
import { normalizePhone, sendWhatsAppText } from "@/lib/whatsapp";
import { brl } from "@/lib/format";
import { actorWithRole, cleanupTestUsers } from "./helpers";

/**
 * Ação "Enviar WhatsApp" das automações. O Evolution nunca é chamado de
 * verdade: o `fetch` é simulado e o teste confere o que SERIA enviado.
 */

const CONFIG = { url: "http://evolution.test", apiKey: "chave", instance: "inst" };

function fetchOk(body: unknown = { key: { id: "MSG1" } }) {
  return vi.fn(async () => new Response(JSON.stringify(body), { status: 201 }));
}

afterEach(() => vi.unstubAllGlobals());

describe("normalizePhone", () => {
  it("assume DDI 55 para número com DDD e limpa a formatação", () => {
    expect(normalizePhone("(61) 99999-0000")).toBe("5561999990000");
    expect(normalizePhone("6199990000")).toBe("556199990000");
  });
  it("mantém número que já tem DDI e recusa número curto", () => {
    expect(normalizePhone("+55 61 99999-0000")).toBe("5561999990000");
    expect(normalizePhone("1234")).toBeNull();
  });
});

describe("sendWhatsAppText", () => {
  it("chama o endpoint sendText da instância com a chave e o número normalizado", async () => {
    const fetchMock = fetchOk();
    vi.stubGlobal("fetch", fetchMock);

    const result = await sendWhatsAppText("(61) 99999-0000", "olá", CONFIG);
    expect(result).toEqual({ ok: true, messageId: "MSG1" });

    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("http://evolution.test/message/sendText/inst");
    expect((init.headers as Record<string, string>).apikey).toBe("chave");
    expect(JSON.parse(String(init.body))).toEqual({ number: "5561999990000", text: "olá" });
  });

  it("devolve erro legível quando o Evolution recusa", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("Unauthorized", { status: 401 })));
    const result = await sendWhatsAppText("61999990000", "olá", CONFIG);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain("401");
  });

  it("sem configuração não tenta enviar", async () => {
    const fetchMock = fetchOk();
    vi.stubGlobal("fetch", fetchMock);
    const result = await sendWhatsAppText("61999990000", "olá", null);
    expect(result.ok).toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("ação send_whatsapp numa automação", () => {
  let manager: Actor;
  let automationId: string;
  let cardId: string;

  beforeAll(async () => {
    await cleanupTestUsers();
    manager = await actorWithRole("manager");
    const board = await prisma.board.findUniqueOrThrow({ where: { key: "sales" } });
    const list = await prisma.list.findFirstOrThrow({ where: { boardId: board.id, stageKey: "lead" } });

    const automation = await prisma.automation.create({
      data: {
        name: "[teste] aviso no WhatsApp",
        enabled: false, // nunca dispara sozinha: o teste a executa diretamente
        trigger: { type: "card.created", board: "sales" },
        conditions: { op: "AND", rules: [] },
        actions: [
          {
            type: "send_whatsapp",
            number: "61999990000",
            message: "Venda: {{card.title}} — {{card.client_name}} — {{card.amount_brl}}",
          },
        ],
      },
    });
    automationId = automation.id;

    const card = await domain.createCard(
      {
        boardId: board.id,
        listId: list.id,
        type: "opportunity",
        title: "[teste] WhatsApp",
        clientName: "Cliente Zap",
        amount: "1234.50",
        createdBy: manager.id,
      },
      manager
    );
    cardId = card.id;
  });

  afterAll(async () => {
    await prisma.automation.deleteMany({ where: { id: automationId } });
    await prisma.card.deleteMany({ where: { title: { startsWith: "[teste]" } } });
    await cleanupTestUsers();
    process.env.EVOLUTION_API_URL = "";
    process.env.EVOLUTION_API_KEY = "";
    process.env.EVOLUTION_INSTANCE = "";
  });

  const event = () => ({ type: "card.created" as const, boardKey: "sales" as const, cardId, actorId: null });

  it("sem EVOLUTION_* a ação é pulada e a regra não falha", async () => {
    const fetchMock = fetchOk();
    vi.stubGlobal("fetch", fetchMock);
    const automation = await prisma.automation.findUniqueOrThrow({ where: { id: automationId } });

    const result = await runAutomation(automation, cardId, event());
    expect(result.outcomes[0]).toMatchObject({ action: "send_whatsapp", status: "skipped" });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("com EVOLUTION_* envia a mensagem renderizada e registra sucesso", async () => {
    process.env.EVOLUTION_API_URL = CONFIG.url;
    process.env.EVOLUTION_API_KEY = CONFIG.apiKey;
    process.env.EVOLUTION_INSTANCE = CONFIG.instance;
    const fetchMock = fetchOk();
    vi.stubGlobal("fetch", fetchMock);
    const automation = await prisma.automation.findUniqueOrThrow({ where: { id: automationId } });

    const result = await runAutomation(automation, cardId, event());
    expect(result.status).toBe("success");

    const [, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(JSON.parse(String(init.body))).toEqual({
      number: "5561999990000",
      // `brl` usa o espaço fino do Intl entre "R$" e o número
      text: `Venda: [teste] WhatsApp — Cliente Zap — ${brl("1234.50")}`,
    });

    const run = await prisma.automationRun.findFirst({
      where: { automationId, cardId, status: "success" },
    });
    expect(run).not.toBeNull();
  });

  it("falha no Evolution vira erro auditado, sem derrubar a regra", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("boom", { status: 500 })));
    const automation = await prisma.automation.findUniqueOrThrow({ where: { id: automationId } });

    const result = await runAutomation(automation, cardId, event());
    expect(result.status).toBe("error");
    expect(result.outcomes[0]).toMatchObject({ action: "send_whatsapp", status: "error" });
    expect(result.outcomes[0]!.detail).toContain("500");
  });
});

describe("destinatário da ação send_whatsapp", () => {
  let manager: Actor;
  let automationId: string;
  let cardId: string;

  const withTarget = async (patch: Record<string, unknown>) =>
    prisma.automation.update({
      where: { id: automationId },
      data: { actions: [{ type: "send_whatsapp", message: "oi {{card.title}}", ...patch }] },
    });

  const run = async () => {
    const automation = await prisma.automation.findUniqueOrThrow({ where: { id: automationId } });
    return runAutomation(automation, cardId, {
      type: "card.created",
      boardKey: "sales",
      cardId,
      actorId: null,
    });
  };

  const sentTo = (fetchMock: ReturnType<typeof fetchOk>) => {
    const [, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    return JSON.parse(String(init.body)).number as string;
  };

  beforeAll(async () => {
    await cleanupTestUsers();
    manager = await actorWithRole("manager");
    process.env.EVOLUTION_API_URL = CONFIG.url;
    process.env.EVOLUTION_API_KEY = CONFIG.apiKey;
    process.env.EVOLUTION_INSTANCE = CONFIG.instance;

    const board = await prisma.board.findUniqueOrThrow({ where: { key: "sales" } });
    const list = await prisma.list.findFirstOrThrow({ where: { boardId: board.id, stageKey: "lead" } });
    const automation = await prisma.automation.create({
      data: {
        name: "[teste] destinatário do WhatsApp",
        enabled: false,
        trigger: { type: "card.created", board: "sales" },
        conditions: { op: "AND", rules: [] },
        actions: [],
      },
    });
    automationId = automation.id;
    const card = await domain.createCard(
      {
        boardId: board.id,
        listId: list.id,
        type: "opportunity",
        title: "[teste] destinatário",
        clientName: "Cliente Zap",
        clientPhone: "(11) 98888-7777",
        assigneeId: manager.id,
        createdBy: manager.id,
      },
      manager
    );
    cardId = card.id;
  });

  afterAll(async () => {
    await prisma.automation.deleteMany({ where: { id: automationId } });
    await prisma.card.deleteMany({ where: { title: { startsWith: "[teste]" } } });
    await cleanupTestUsers();
    process.env.EVOLUTION_API_URL = "";
    process.env.EVOLUTION_API_KEY = "";
    process.env.EVOLUTION_INSTANCE = "";
  });

  it("regra antiga sem `to` continua valendo como número fixo", async () => {
    const fetchMock = fetchOk();
    vi.stubGlobal("fetch", fetchMock);
    await withTarget({ number: "61999990000" });
    expect((await run()).status).toBe("success");
    expect(sentTo(fetchMock)).toBe("5561999990000");
  });

  it("`client` usa o telefone do cliente gravado no card", async () => {
    const fetchMock = fetchOk();
    vi.stubGlobal("fetch", fetchMock);
    await withTarget({ to: "client" });
    expect((await run()).status).toBe("success");
    expect(sentTo(fetchMock)).toBe("5511988887777");
  });

  it("`assignee` sem WhatsApp no perfil é pulado; com WhatsApp, envia", async () => {
    const fetchMock = fetchOk();
    vi.stubGlobal("fetch", fetchMock);
    await withTarget({ to: "assignee" });

    await prisma.profile.update({ where: { id: manager.id }, data: { phone: null } });
    const skipped = await run();
    expect(skipped.outcomes[0]).toMatchObject({ status: "skipped" });
    expect(skipped.outcomes[0]!.detail).toContain("não tem WhatsApp");
    expect(fetchMock).not.toHaveBeenCalled();

    await prisma.profile.update({ where: { id: manager.id }, data: { phone: "61 97777-6666" } });
    expect((await run()).status).toBe("success");
    expect(sentTo(fetchMock)).toBe("5561977776666");
  });

  it("`user` envia para a pessoa escolhida", async () => {
    const fetchMock = fetchOk();
    vi.stubGlobal("fetch", fetchMock);
    const sales = await actorWithRole("sales");
    await prisma.profile.update({ where: { id: sales.id }, data: { phone: "21955554444" } });
    await withTarget({ to: "user", user_id: sales.id });
    expect((await run()).status).toBe("success");
    expect(sentTo(fetchMock)).toBe("5521955554444");
  });
});
