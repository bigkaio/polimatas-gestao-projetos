import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/auth";
import { brl } from "@/lib/format";
import {
  AreaTrend,
  BarList,
  ChartCard,
  StatTile,
  StatusBar,
  type BarDatum,
} from "@/components/dashboard/charts";

export const dynamic = "force-dynamic";

const MESES = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

function monthKey(d: Date) {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

/** Painel de vendas e projetos (US-15/US-39): o estado do negócio numa tela. */
export default async function DashboardPage() {
  const session = await requireSession();

  const hoje = new Date();
  hoje.setUTCHours(0, 0, 0, 0);
  const em7dias = new Date(hoje.getTime() + 7 * 86_400_000);
  const inicioDoMes = new Date(Date.UTC(hoje.getUTCFullYear(), hoje.getUTCMonth(), 1));
  const seisMesesAtras = new Date(Date.UTC(hoje.getUTCFullYear(), hoje.getUTCMonth() - 5, 1));

  const [boards, cards, tarefas, usuarios] = await Promise.all([
    prisma.board.findMany({ include: { lists: { orderBy: { position: "asc" } } } }),
    prisma.card.findMany({
      where: { archivedAt: null },
      select: {
        id: true,
        type: true,
        listId: true,
        amount: true,
        dueDate: true,
        updatedAt: true,
        assignee: { select: { id: true, name: true } },
      },
    }),
    prisma.task.groupBy({ by: ["done"], _count: { _all: true } }),
    prisma.profile.count(),
  ]);

  const sales = boards.find((b) => b.key === "sales");
  const projects = boards.find((b) => b.key === "projects");
  const listaDe = new Map(boards.flatMap((b) => b.lists).map((l) => [l.id, l]));
  const valor = (a: unknown) => (a === null || a === undefined ? 0 : Number(a));

  // ------------------------------------------------------------------ vendas
  const oportunidades = cards.filter((c) => c.type === "opportunity");
  const emAberto = oportunidades.filter((c) => !listaDe.get(c.listId)?.isTerminal);
  const ganhas = oportunidades.filter((c) => listaDe.get(c.listId)?.semantics === "won");
  const perdidas = oportunidades.filter((c) => listaDe.get(c.listId)?.semantics === "lost");
  const ganhasNoMes = ganhas.filter((c) => c.updatedAt >= inicioDoMes);

  const funil: BarDatum[] = (sales?.lists ?? [])
    .filter((l) => !l.isTerminal)
    .map((l) => {
      const doStage = oportunidades.filter((c) => c.listId === l.id);
      const soma = doStage.reduce((a, c) => a + valor(c.amount), 0);
      return {
        label: l.name,
        value: soma,
        display: brl(soma),
        note: `${doStage.length} oportunidade(s)`,
      };
    });

  const porMes = new Map<string, number>();
  for (let i = 0; i < 6; i++) {
    const d = new Date(Date.UTC(seisMesesAtras.getUTCFullYear(), seisMesesAtras.getUTCMonth() + i, 1));
    porMes.set(monthKey(d), 0);
  }
  for (const c of ganhas) {
    const k = monthKey(c.updatedAt);
    if (porMes.has(k)) porMes.set(k, porMes.get(k)! + valor(c.amount));
  }
  const evolucao = [...porMes.entries()].map(([k, v]) => ({
    label: MESES[Number(k.slice(5, 7)) - 1]!,
    value: v,
    display: brl(v),
  }));

  const totalEmAberto = emAberto.reduce((a, c) => a + valor(c.amount), 0);
  const fechadoNoMes = ganhasNoMes.reduce((a, c) => a + valor(c.amount), 0);
  const conversao =
    ganhas.length + perdidas.length > 0
      ? Math.round((ganhas.length / (ganhas.length + perdidas.length)) * 100)
      : null;
  const ticket = ganhas.length > 0 ? ganhas.reduce((a, c) => a + valor(c.amount), 0) / ganhas.length : 0;

  // ---------------------------------------------------------------- projetos
  const projetos = cards.filter((c) => c.type === "project");
  const emExecucao = projetos.filter((c) => !listaDe.get(c.listId)?.isTerminal);
  const concluidos = projetos.filter((c) => listaDe.get(c.listId)?.semantics === "done");

  const porEtapa: BarDatum[] = (projects?.lists ?? []).map((l) => {
    const n = projetos.filter((c) => c.listId === l.id).length;
    return { label: l.name, value: n, display: String(n) };
  });

  const atrasados = emExecucao.filter((c) => c.dueDate && c.dueDate < hoje).length;
  const venceEmBreve = emExecucao.filter(
    (c) => c.dueDate && c.dueDate >= hoje && c.dueDate <= em7dias
  ).length;

  const carga = new Map<string, number>();
  for (const c of emExecucao) {
    const nome = c.assignee?.name ?? "Sem responsável";
    carga.set(nome, (carga.get(nome) ?? 0) + 1);
  }
  const porResponsavel: BarDatum[] = [...carga.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([nome, n]) => ({ label: nome, value: n, display: String(n) }));

  const tarefasAbertas = tarefas.find((t) => !t.done)?._count._all ?? 0;
  const tarefasFeitas = tarefas.find((t) => t.done)?._count._all ?? 0;

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <header>
        <p className="text-xs font-semibold uppercase tracking-widest text-accent">Visão geral</p>
        <h1 className="text-3xl font-light tracking-tight text-fg">
          Olá, {session.name.split(" ")[0]}
        </h1>
        <p className="text-sm text-fg-3">
          Como estão as vendas e os projetos agora. {usuarios} pessoas no time.
        </p>
      </header>

      <section className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile
          label="Em negociação"
          value={brl(totalEmAberto)}
          hint={`${emAberto.length} oportunidade(s) abertas`}
        />
        <StatTile
          label="Fechado no mês"
          value={brl(fechadoNoMes)}
          hint={`${ganhasNoMes.length} venda(s) ganha(s)`}
          tone="good"
        />
        <StatTile
          label="Taxa de conversão"
          value={conversao === null ? "—" : `${conversao}%`}
          hint={`${ganhas.length} ganhos · ${perdidas.length} perdas`}
        />
        <StatTile
          label="Ticket médio"
          value={brl(ticket)}
          hint="média das vendas fechadas"
        />
      </section>

      <h2 className="mt-8 text-xs font-semibold uppercase tracking-widest text-fg-4">Vendas</h2>
      <div className="mt-3 grid gap-4 lg:grid-cols-2">
        <ChartCard
          title="Funil de vendas"
          hint="Valor em cada etapa. Passe o mouse para ver quantas oportunidades."
        >
          <BarList data={funil} empty="Nenhuma oportunidade em aberto." />
        </ChartCard>

        <ChartCard
          title="Fechado por mês"
          hint="Valor das vendas ganhas nos últimos 6 meses."
        >
          <AreaTrend points={evolucao} empty="Ainda não há histórico suficiente." />
        </ChartCard>

        <ChartCard title="Ganhos e perdas" hint="Desfecho das oportunidades encerradas.">
          <StatusBar
            segments={[
              { label: "Ganhos", value: ganhas.length, tone: "good" },
              { label: "Perdas", value: perdidas.length, tone: "bad" },
            ]}
            empty="Nenhuma oportunidade encerrada ainda."
          />
        </ChartCard>

        <ChartCard title="Tarefas do time" hint="Checklists de todos os cards.">
          <StatusBar
            segments={[
              { label: "Concluídas", value: tarefasFeitas, tone: "good" },
              { label: "Abertas", value: tarefasAbertas, tone: "warn" },
            ]}
            empty="Nenhuma tarefa cadastrada."
          />
        </ChartCard>
      </div>

      <h2 className="mt-8 text-xs font-semibold uppercase tracking-widest text-fg-4">
        Projetos
      </h2>
      <section className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile
          label="Em execução"
          value={String(emExecucao.length)}
          hint="fora das listas finais"
        />
        <StatTile label="Concluídos" value={String(concluidos.length)} tone="good" />
        <StatTile
          label="Atrasados"
          value={String(atrasados)}
          tone={atrasados > 0 ? "bad" : "neutral"}
          hint="prazo já venceu"
        />
        <StatTile
          label="Vencem em 7 dias"
          value={String(venceEmBreve)}
          tone={venceEmBreve > 0 ? "warn" : "neutral"}
        />
      </section>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <ChartCard title="Projetos por etapa">
          <BarList data={porEtapa} empty="Nenhum projeto no quadro." />
        </ChartCard>

        <ChartCard
          title="Carga por responsável"
          hint="Projetos em execução atribuídos a cada pessoa."
        >
          <BarList data={porResponsavel} empty="Nenhum projeto atribuído." />
        </ChartCard>
      </div>
    </div>
  );
}
