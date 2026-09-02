/* eslint-disable no-console */
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

const day = (offset: number) => {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  d.setUTCDate(d.getUTCDate() + offset);
  return d;
};

async function main() {
  console.log("Seed: usuários (um por papel, US-05/US-43)…");
  const password = await bcrypt.hash("polimatas123", 10);
  const usersData = [
    { email: "admin@polimatas.dev", name: "Alice Admin", role: "admin" },
    { email: "gestor@polimatas.dev", name: "Gabriel Gestor", role: "manager" },
    { email: "vendas@polimatas.dev", name: "Valentina Vendas", role: "sales" },
    { email: "executor@polimatas.dev", name: "Enzo Executor", role: "member" },
  ] as const;
  const users: Record<string, string> = {};
  for (const u of usersData) {
    const profile = await prisma.profile.upsert({
      where: { email: u.email },
      update: { name: u.name, role: u.role },
      create: { email: u.email, name: u.name, role: u.role, passwordHash: password },
    });
    users[u.role] = profile.id;
  }

  console.log("Seed: quadros e listas (US-11/US-16)…");
  const sales = await prisma.board.upsert({
    where: { key: "sales" },
    update: {},
    create: { key: "sales", name: "Pipeline de Vendas", type: "opportunity" },
  });
  const projects = await prisma.board.upsert({
    where: { key: "projects" },
    update: {},
    create: { key: "projects", name: "Pipeline de Projetos", type: "project" },
  });

  const salesLists = [
    { stageKey: "lead", name: "Lead", position: 1 },
    { stageKey: "qualificacao", name: "Qualificação", position: 2 },
    { stageKey: "proposta", name: "Proposta", position: 3 },
    { stageKey: "negociacao", name: "Negociação", position: 4 },
    { stageKey: "fechado", name: "Fechado", position: 5, isTerminal: true, semantics: "won" as const },
    { stageKey: "perdido", name: "Perdido", position: 6, isTerminal: true, semantics: "lost" as const },
  ];
  const projectLists = [
    { stageKey: "backlog", name: "Backlog", position: 1 },
    { stageKey: "em_andamento", name: "Em andamento", position: 2 },
    { stageKey: "revisao", name: "Revisão", position: 3 },
    { stageKey: "concluido", name: "Concluído", position: 4, isTerminal: true, semantics: "done" as const },
    { stageKey: "atrasados", name: "Atrasados", position: 5, semantics: "late" as const },
  ];
  const lists: Record<string, string> = {};
  for (const [boardId, defs] of [
    [sales.id, salesLists],
    [projects.id, projectLists],
  ] as const) {
    for (const l of defs) {
      const list = await prisma.list.upsert({
        where: { boardId_stageKey: { boardId, stageKey: l.stageKey } },
        update: { name: l.name, position: l.position },
        create: { boardId, ...l },
      });
      lists[l.stageKey] = list.id;
    }
  }

  console.log("Seed: regras de compliance (seção 5.4)…");
  const complianceRules = [
    {
      key: "task-deadline",
      name: "Toda tarefa precisa de deadline",
      scope: "task.create,task.update",
      condition: { op: "AND", rules: [{ field: "task.due_date", operator: "is_empty" }] },
      message: "Defina um prazo para a tarefa antes de salvar.",
      severity: "block" as const,
      isSystem: true,
    },
    {
      key: "project-done-open-tasks",
      name: "Projeto não vai para Concluído com tarefas abertas",
      scope: "card.move",
      condition: {
        op: "AND",
        rules: [
          { field: "to_list.semantics", operator: "is", value: "done" },
          { field: "card.open_tasks", operator: "greater_than", value: 0 },
        ],
      },
      message:
        "Este projeto tem {{open_tasks}} tarefa(s) aberta(s). Conclua ou remova antes de finalizar.",
      severity: "block" as const,
      isSystem: true,
    },
    {
      key: "in-progress-needs-assignee",
      name: "Card de projeto em Em andamento precisa de responsável",
      scope: "card.move",
      condition: {
        op: "AND",
        rules: [
          { field: "card.type", operator: "is", value: "project" },
          { field: "to_list", operator: "is", value: "em_andamento" },
          { field: "card.assignee", operator: "is_empty" },
        ],
      },
      message: "Defina um responsável antes de mover o projeto para Em andamento.",
      severity: "block" as const,
      isSystem: false,
    },
    {
      key: "proposal-needs-amount",
      name: "Oportunidade não vai para Proposta sem valor",
      scope: "card.move",
      condition: {
        op: "AND",
        rules: [
          { field: "card.type", operator: "is", value: "opportunity" },
          { field: "to_list", operator: "is", value: "proposta" },
          { field: "card.amount", operator: "is_empty" },
        ],
      },
      message: "Informe o valor estimado antes de enviar a oportunidade para Proposta.",
      severity: "block" as const,
      isSystem: false,
    },
    {
      key: "lost-needs-reason",
      name: "Oportunidade Perdida exige motivo de perda",
      scope: "card.move",
      condition: {
        op: "AND",
        rules: [
          { field: "to_list.semantics", operator: "is", value: "lost" },
          { field: "card.loss_reason", operator: "is_empty" },
        ],
      },
      message: "Informe o motivo da perda antes de mover para Perdido.",
      severity: "block" as const,
      isSystem: false,
    },
    {
      key: "leave-backlog-needs-due",
      name: "Projeto precisa de prazo ao sair do Backlog",
      scope: "card.move",
      condition: {
        op: "AND",
        rules: [
          { field: "card.type", operator: "is", value: "project" },
          { field: "from_list", operator: "is", value: "backlog" },
          { field: "card.due_date", operator: "is_empty" },
        ],
      },
      message: "Defina um prazo para o projeto antes de tirá-lo do Backlog.",
      severity: "block" as const,
      isSystem: false,
    },
  ];
  for (const rule of complianceRules) {
    await prisma.complianceRule.upsert({
      where: { key: rule.key },
      update: {
        name: rule.name,
        scope: rule.scope,
        condition: rule.condition,
        message: rule.message,
        severity: rule.severity,
        isSystem: rule.isSystem,
      },
      create: { ...rule, enabled: true },
    });
  }

  console.log("Seed: automações nativas (seção 5.3)…");
  const systemAutomations = [
    {
      name: "Venda fechada gera projeto",
      isSystem: true,
      trigger: { type: "card.moved", board: "sales", to_list: "fechado" },
      conditions: {
        op: "AND",
        rules: [{ field: "card.type", operator: "is", value: "opportunity" }],
      },
      actions: [
        {
          type: "create_project_card",
          target_board: "projects",
          target_list: "backlog",
          inherit: ["client_name", "client_email", "client_phone", "amount", "description", "assignee_id"],
          title_template: "{{client_name}} — {{card.title}}",
          link_back: true,
        },
        {
          type: "notify_user",
          target: "assignee",
          message: "Projeto criado a partir da venda {{card.title}}",
        },
      ],
    },
    {
      name: "Tarefa atrasada vai para Atrasados",
      isSystem: false,
      trigger: { type: "task.overdue" },
      conditions: {
        op: "AND",
        rules: [{ field: "card.list", operator: "is_not", value: "concluido" }],
      },
      actions: [
        { type: "move_card", target_list: "atrasados" },
        {
          type: "notify_user",
          target: "assignee",
          message: "A tarefa {{task.title}} passou do prazo",
        },
      ],
    },
    {
      name: "Card em Revisão notifica o responsável",
      isSystem: false,
      trigger: { type: "card.moved", board: "projects", to_list: "revisao" },
      conditions: {
        op: "AND",
        rules: [{ field: "card.assignee", operator: "is_filled" }],
      },
      actions: [
        {
          type: "notify_user",
          target: "assignee",
          message: "O card {{card.title}} entrou em Revisão — hora de conferir a entrega.",
        },
      ],
    },
  ];
  for (const auto of systemAutomations) {
    const existing = await prisma.automation.findFirst({ where: { name: auto.name } });
    if (existing) {
      await prisma.automation.update({
        where: { id: existing.id },
        data: { trigger: auto.trigger, conditions: auto.conditions, actions: auto.actions, isSystem: auto.isSystem },
      });
    } else {
      await prisma.automation.create({
        data: {
          name: auto.name,
          enabled: true,
          isSystem: auto.isSystem,
          trigger: auto.trigger,
          conditions: auto.conditions,
          actions: auto.actions,
          createdBy: users.admin ?? null,
        },
      });
    }
  }

  const cardCount = await prisma.card.count();
  if (cardCount > 0) {
    console.log(`Seed: ${cardCount} cards já existem — dados de demonstração preservados (idempotente).`);
    return;
  }

  console.log("Seed: oportunidades e projetos de demonstração…");
  const opp = (data: {
    title: string;
    list: string;
    client: string;
    email?: string;
    phone?: string;
    amount?: string;
    assignee?: string;
    due?: number;
    description?: string;
    lossReason?: string;
  }) =>
    prisma.card.create({
      data: {
        boardId: sales.id,
        listId: lists[data.list]!,
        type: "opportunity",
        title: data.title,
        description: data.description ?? null,
        position: 1024 + Math.random() * 10,
        clientName: data.client,
        clientEmail: data.email ?? null,
        clientPhone: data.phone ?? null,
        amount: data.amount ?? null,
        lossReason: data.lossReason ?? null,
        assigneeId: data.assignee ?? users.sales!,
        dueDate: data.due !== undefined ? day(data.due) : null,
        createdBy: users.sales!,
      },
    });

  await opp({ title: "Site institucional", list: "lead", client: "Padaria Pão Quente", email: "contato@paoquente.com.br", phone: "(11) 98888-0001" });
  await opp({ title: "App de agendamento", list: "lead", client: "Clínica Sorriso", email: "adm@clinicasorriso.com.br" });
  await opp({ title: "Sistema de estoque", list: "qualificacao", client: "Auto Peças Silva", amount: "18000.00", due: 12 });
  await opp({ title: "Portal do aluno", list: "proposta", client: "Colégio Horizonte", amount: "42000.00", due: 8, description: "Portal com notas, boletos e comunicação com responsáveis." });
  await opp({ title: "E-commerce B2B", list: "negociacao", client: "Distribuidora Norte", amount: "65000.00", due: 4, description: "Catálogo com preço por perfil de cliente e integração com ERP." });
  await opp({ title: "Landing pages de campanha", list: "negociacao", client: "Agência Vetor", amount: "9500.00", due: 6 });
  await opp({ title: "Manutenção de intranet", list: "perdido", client: "Transportes Rápido", amount: "12000.00", lossReason: "Optou por equipe interna." });

  const proj = async (data: {
    title: string;
    list: string;
    client?: string;
    amount?: string;
    assignee?: string;
    due?: number;
    description?: string;
    tasks?: { title: string; due: number; done?: boolean; assignee?: string }[];
  }) => {
    const card = await prisma.card.create({
      data: {
        boardId: projects.id,
        listId: lists[data.list]!,
        type: "project",
        title: data.title,
        description: data.description ?? null,
        position: 1024 + Math.random() * 10,
        clientName: data.client ?? null,
        amount: data.amount ?? null,
        assigneeId: data.assignee ?? users.member!,
        dueDate: data.due !== undefined ? day(data.due) : null,
        createdBy: users.manager!,
      },
    });
    let pos = 1024;
    for (const t of data.tasks ?? []) {
      await prisma.task.create({
        data: {
          cardId: card.id,
          title: t.title,
          dueDate: day(t.due),
          done: t.done ?? false,
          completedAt: t.done ? new Date() : null,
          assigneeId: t.assignee ?? users.member!,
          position: (pos += 1024),
        },
      });
    }
    return card;
  };

  await proj({
    title: "Mercado Central — Cardápio digital",
    list: "em_andamento",
    client: "Mercado Central",
    amount: "22000.00",
    due: 10,
    description: "Cardápio com QR code, painel de pedidos e relatório diário.",
    tasks: [
      { title: "Aprovar wireframes com o cliente", due: -1 },
      { title: "Implementar painel de pedidos", due: 5 },
      { title: "Configurar domínio e publicação", due: 9 },
    ],
  });
  await proj({
    title: "Studio Fit — Sistema de matrículas",
    list: "revisao",
    client: "Studio Fit",
    amount: "31000.00",
    due: 3,
    assignee: users.manager!,
    tasks: [
      { title: "Revisar fluxo de pagamento", due: 2 },
      { title: "Teste de carga no agendamento", due: 2, done: true },
    ],
  });
  await proj({
    title: "Café do Ponto — Site com pedidos",
    list: "backlog",
    client: "Café do Ponto",
    amount: "15000.00",
    tasks: [{ title: "Kickoff com o cliente", due: 4 }],
  });
  await proj({
    title: "Ótica Vista — Catálogo online",
    list: "concluido",
    client: "Ótica Vista",
    amount: "12500.00",
    due: -5,
    tasks: [
      { title: "Publicar catálogo", due: -6, done: true },
      { title: "Treinamento da equipe", due: -5, done: true },
    ],
  });

  console.log("Seed concluído.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
