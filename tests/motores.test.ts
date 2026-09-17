import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import * as domain from "@/core/domain";
import { ComplianceError, PermissionError } from "@/core/errors";
import type { Actor } from "@/core/events";
import { actorWithRole, cleanupTestUsers } from "./helpers";

/**
 * Testes de integração dos motores contra o Postgres real (US-31: o bloqueio
 * vale em chamada direta à camada de domínio, sem passar pela interface).
 * Pré-requisito: banco migrado e seed executado (usuários, quadros, regras).
 */

let manager: Actor;
let salesActor: Actor;
let salesBoardId: string;
let projectsBoardId: string;
let lists: Record<string, { id: string }>;

async function freshProject(title: string, listStage = "em_andamento") {
  return domain.createCard(
    {
      boardId: projectsBoardId,
      listId: lists[listStage]!.id,
      type: "project",
      title,
      assigneeId: manager.id,
      dueDate: new Date(Date.now() + 7 * 86_400_000),
      createdBy: manager.id,
    },
    manager
  );
}

beforeAll(async () => {
  // Restos de uma execução anterior saem ANTES de criar as contas novas.
  await cleanupTestUsers();

  // Contas próprias de teste: os papéis dos usuários de demonstração mudam
  // conforme quem usa o sistema, e a suíte não pode depender disso.
  manager = await actorWithRole("manager");
  salesActor = await actorWithRole("sales");

  salesBoardId = (await prisma.board.findUniqueOrThrow({ where: { key: "sales" } })).id;
  projectsBoardId = (await prisma.board.findUniqueOrThrow({ where: { key: "projects" } })).id;
  const allLists = await prisma.list.findMany();
  lists = Object.fromEntries(allLists.map((l) => [l.stageKey, { id: l.id }]));

  // Limpa somente os cards de execuções anteriores DESTES testes.
  await prisma.card.deleteMany({ where: { title: { startsWith: "[teste]" } } });
});

afterAll(async () => {
  // Não deixa resíduo de teste nos dados de demonstração.
  await prisma.notification.deleteMany({ where: { message: { contains: "[teste]" } } });
  await prisma.card.deleteMany({ where: { title: { startsWith: "[teste]" } } });
  await cleanupTestUsers();
});

describe("US-33/US-31 — compliance bloqueia no servidor", () => {
  it("tarefa sem deadline é recusada e NÃO existe no banco", async () => {
    const card = await freshProject("[teste] Projeto sem prazo de tarefa");
    await expect(
      domain.createTask(card.id, { title: "[teste] tarefa sem prazo", dueDate: null }, manager)
    ).rejects.toBeInstanceOf(ComplianceError);
    // Checa a tarefa recusada, e não o total do card: uma automação criada
    // pelo usuário pode legitimamente ter adicionado outras tarefas ao card.
    const persisted = await prisma.task.count({
      where: { cardId: card.id, title: "[teste] tarefa sem prazo" },
    });
    expect(persisted).toBe(0);
  });

  it("projeto com tarefa aberta não entra em Concluído; nada é persistido", async () => {
    const card = await freshProject("[teste] Projeto com pendência");
    await domain.createTask(
      card.id,
      { title: "[teste] pendência", dueDate: new Date(Date.now() + 86_400_000) },
      manager
    );
    await expect(
      domain.moveCard(card.id, { toListId: lists.concluido!.id }, manager)
    ).rejects.toBeInstanceOf(ComplianceError);

    const after = await prisma.card.findUniqueOrThrow({ where: { id: card.id } });
    expect(after.listId).toBe(lists.em_andamento!.id); // voltou/ficou na origem

    const violation = await prisma.complianceViolation.findFirst({
      where: { cardId: card.id },
      include: { rule: true },
    });
    expect(violation?.rule.key).toBe("project-done-open-tasks");
  });

  it("segunda linha de defesa: o trigger do Postgres bloqueia escrita direta", async () => {
    const card = await freshProject("[teste] Bypass direto no banco");
    await domain.createTask(
      card.id,
      { title: "[teste] aberta", dueDate: new Date(Date.now() + 86_400_000) },
      manager
    );
    await expect(
      prisma.card.update({ where: { id: card.id }, data: { listId: lists.concluido!.id } })
    ).rejects.toThrowError(/compliance/);
  });

  it("oportunidade não vai para Perdido sem motivo; com motivo, vai", async () => {
    const opp = await domain.createCard(
      {
        boardId: salesBoardId,
        listId: lists.negociacao!.id,
        type: "opportunity",
        title: "[teste] Negociação fria",
        clientName: "Cliente Teste",
        createdBy: salesActor.id,
      },
      salesActor
    );
    await expect(
      domain.moveCard(opp.id, { toListId: lists.perdido!.id }, salesActor)
    ).rejects.toBeInstanceOf(ComplianceError);

    // Motivo recusado junto com o movimento não fica gravado (o executor não move vendas)
    const member = await actorWithRole("member");
    await expect(
      domain.moveCard(
        opp.id,
        { toListId: lists.perdido!.id, lossReason: "[teste] não deveria ficar" },
        member
      )
    ).rejects.toBeInstanceOf(PermissionError);
    expect((await prisma.card.findUniqueOrThrow({ where: { id: opp.id } })).lossReason).toBeNull();

    // Motivo e movimento vão juntos, com registro no histórico
    await domain.moveCard(
      opp.id,
      { toListId: lists.perdido!.id, lossReason: "Sem orçamento neste semestre." },
      salesActor
    );
    const after = await prisma.card.findUniqueOrThrow({ where: { id: opp.id } });
    expect(after.listId).toBe(lists.perdido!.id);
    expect(after.lossReason).toBe("Sem orçamento neste semestre.");
    const reasonLog = await prisma.activityLog.findFirst({
      where: { cardId: opp.id, action: "card.updated" },
      orderBy: { createdAt: "desc" },
    });
    expect(JSON.stringify(reasonLog?.after)).toContain("Sem orçamento");
  });

  it("salvar o mesmo valor com outra grafia não gera histórico nem evento", async () => {
    const card = await freshProject("[teste] Valor repetido");
    await domain.updateCard(card.id, { amount: "88000.00" }, manager);
    const before = await prisma.activityLog.count({ where: { cardId: card.id } });

    // "88000" no banco, "88000.00" vindo do campo formatado
    await domain.updateCard(card.id, { amount: "88000.00" }, manager);
    await domain.updateCard(card.id, { amount: "88000" }, manager);
    expect(await prisma.activityLog.count({ where: { cardId: card.id } })).toBe(before);
  });

  it("reordenar o checklist exige poder editar as tarefas do card", async () => {
    const card = await freshProject("[teste] Reordenar checklist");
    const a = await domain.createTask(card.id, { title: "[teste] a", dueDate: new Date(Date.now() + 86_400_000) }, manager);
    const b = await domain.createTask(card.id, { title: "[teste] b", dueDate: new Date(Date.now() + 86_400_000) }, manager);

    // vendedor não mexe no quadro de projetos
    await expect(domain.reorderTasks(card.id, [b.id, a.id], salesActor)).rejects.toBeInstanceOf(
      PermissionError
    );
    await domain.reorderTasks(card.id, [b.id, a.id], manager);
    // a automação de kickoff pode ter adicionado outra tarefa: olha só a ordem relativa de a e b
    const ordered = await prisma.task.findMany({ where: { cardId: card.id }, orderBy: { position: "asc" } });
    const ids = ordered.map((t) => t.id);
    expect(ids.indexOf(b.id)).toBeLessThan(ids.indexOf(a.id));
  });

  it("projeto sem prazo reordena dentro do Backlog, mas não sai dele", async () => {
    const card = await domain.createCard(
      {
        boardId: projectsBoardId,
        listId: lists.backlog!.id,
        type: "project",
        title: "[teste] Projeto sem prazo no Backlog",
        assigneeId: manager.id,
        createdBy: manager.id,
      },
      manager
    );

    // mudar a posição na própria coluna não é sair do Backlog
    await domain.moveCard(card.id, { toListId: lists.backlog!.id, index: 0 }, manager);

    await expect(
      domain.moveCard(card.id, { toListId: lists.em_andamento!.id }, manager)
    ).rejects.toBeInstanceOf(ComplianceError);

    await domain.updateCard(card.id, { dueDate: new Date(Date.now() + 7 * 86_400_000) }, manager);
    await domain.moveCard(card.id, { toListId: lists.em_andamento!.id }, manager);
    const after = await prisma.card.findUniqueOrThrow({ where: { id: card.id } });
    expect(after.listId).toBe(lists.em_andamento!.id);
  });
});

describe("US-21/US-22/US-23 — venda fechada gera projeto (fluxo central)", () => {
  it("mover para Fechado cria o card no Backlog herdando os dados", async () => {
    const opp = await domain.createCard(
      {
        boardId: salesBoardId,
        listId: lists.negociacao!.id,
        type: "opportunity",
        title: "[teste] ERP sob medida",
        clientName: "Metalúrgica Aço Forte",
        clientEmail: "compras@acoforte.com.br",
        clientPhone: "(31) 97777-0000",
        amount: "88000.00",
        description: "Módulos de produção e faturamento.",
        assigneeId: salesActor.id,
        createdBy: salesActor.id,
      },
      salesActor
    );

    const before = Date.now();
    await domain.moveCard(opp.id, { toListId: lists.fechado!.id }, salesActor);
    const elapsed = Date.now() - before;
    expect(elapsed).toBeLessThan(2000); // north star: menos de 2 segundos

    const project = await prisma.card.findUnique({ where: { sourceCardId: opp.id } });
    expect(project).not.toBeNull();
    expect(project!.listId).toBe(lists.backlog!.id);
    expect(project!.title).toBe("Metalúrgica Aço Forte — [teste] ERP sob medida");
    expect(project!.clientEmail).toBe("compras@acoforte.com.br");
    expect(String(project!.amount)).toBe("88000");
    expect(project!.assigneeId).toBe(salesActor.id);

    // US-22: rastreabilidade
    expect(project!.sourceCardId).toBe(opp.id);

    // Histórico registra a origem (US-21)
    const activity = await prisma.activityLog.findFirst({
      where: { cardId: project!.id, action: "card.created" },
    });
    expect(JSON.stringify(activity?.after)).toContain("Criado automaticamente pela venda");

    // Notificação para o responsável
    const notif = await prisma.notification.findFirst({
      where: { userId: salesActor.id, message: { contains: "[teste] ERP sob medida" } },
    });
    expect(notif).not.toBeNull();

    // Execução auditada
    const run = await prisma.automationRun.findFirst({
      where: { cardId: opp.id, status: "success" },
      orderBy: { createdAt: "desc" },
    });
    expect(run).not.toBeNull();
  });

  it("idempotência: sair e voltar para Fechado NÃO cria segundo projeto", async () => {
    const opp = await prisma.card.findFirstOrThrow({
      where: { title: "[teste] ERP sob medida" },
    });
    await domain.moveCard(opp.id, { toListId: lists.negociacao!.id }, salesActor);
    await domain.moveCard(opp.id, { toListId: lists.fechado!.id }, salesActor);

    const projects = await prisma.card.count({ where: { sourceCardId: opp.id } });
    expect(projects).toBe(1);

    const skipped = await prisma.automationRun.findFirst({
      where: { cardId: opp.id, status: "skipped" },
      orderBy: { createdAt: "desc" },
    });
    expect(skipped).not.toBeNull(); // tentativa duplicada registrada como skipped (US-23)
  });
});

describe("US-26 — automação não fura o compliance", () => {
  it("ação bloqueada vira blocked_by_compliance no log de execuções", async () => {
    // Automação de teste: ao entrar em Revisão, mover para Concluído (vai violar
    // a regra de tarefas abertas → o motor registra o bloqueio).
    const automation = await prisma.automation.create({
      data: {
        name: "[teste] Revisão tenta concluir",
        enabled: true,
        trigger: { type: "card.moved", board: "projects", to_list: "revisao" },
        conditions: { op: "AND", rules: [] },
        actions: [{ type: "move_card", target_list: "concluido" }],
      },
    });
    try {
      const card = await freshProject("[teste] Card que a automação tenta concluir");
      await domain.createTask(
        card.id,
        { title: "[teste] impede conclusão", dueDate: new Date(Date.now() + 86_400_000) },
        manager
      );
      await domain.moveCard(card.id, { toListId: lists.revisao!.id }, manager);

      const run = await prisma.automationRun.findFirst({
        where: { automationId: automation.id, cardId: card.id },
      });
      expect(run?.status).toBe("blocked_by_compliance");

      const after = await prisma.card.findUniqueOrThrow({ where: { id: card.id } });
      expect(after.listId).toBe(lists.revisao!.id); // ficou onde o usuário deixou
    } finally {
      await prisma.automation.delete({ where: { id: automation.id } });
    }
  });
});

describe("Matriz de permissões (seção 3.1)", () => {
  it("member não cria card de projeto; sales não cria projeto", async () => {
    const member = await actorWithRole("member");
    await expect(
      domain.createCard(
        {
          boardId: projectsBoardId,
          listId: lists.backlog!.id,
          type: "project",
          title: "[teste] não deveria existir",
          createdBy: member.id,
        },
        member
      )
    ).rejects.toThrowError(/gestores/i);
    await expect(
      domain.createCard(
        {
          boardId: projectsBoardId,
          listId: lists.backlog!.id,
          type: "project",
          title: "[teste] não deveria existir 2",
          createdBy: salesActor.id,
        },
        salesActor
      )
    ).rejects.toThrowError(/gestores/i);
  });
});
