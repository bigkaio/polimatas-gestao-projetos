import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/auth";
import { brl } from "@/lib/format";

/** Primeiros passos guiados (US-39): o sistema em três frases + atalhos. */
export default async function HomePage() {
  const session = await requireSession();
  const [openOpps, negotiating, projectsActive, automationsOn] = await Promise.all([
    prisma.card.count({ where: { type: "opportunity", list: { isTerminal: false }, archivedAt: null } }),
    prisma.card.aggregate({
      _sum: { amount: true },
      where: { type: "opportunity", list: { isTerminal: false }, archivedAt: null },
    }),
    prisma.card.count({ where: { type: "project", list: { semantics: null }, archivedAt: null } }),
    prisma.automation.count({ where: { enabled: true } }),
  ]);

  return (
    <div className="mx-auto max-w-4xl px-4 py-10">
      <h1 className="text-3xl font-bold">Olá, {session.name.split(" ")[0]} 👋</h1>
      <div className="mt-4 space-y-2 rounded-2xl border border-indigo-100 bg-indigo-50/50 p-6 text-slate-700">
        <p>
          <strong>1.</strong> As negociações vivem no <strong>Pipeline de Vendas</strong> — do Lead ao Fechado.
        </p>
        <p>
          <strong>2.</strong> Quando uma venda é marcada como <strong>Fechada</strong>, o sistema cria sozinho o
          card no <strong>Pipeline de Projetos</strong>, herdando cliente, valor e responsável.
        </p>
        <p>
          <strong>3.</strong> <strong>Automações</strong> fazem o trabalho repetitivo e o{" "}
          <strong>Compliance</strong> bloqueia o que sair do padrão — tudo auditado.
        </p>
      </div>

      <div className="mt-8 grid gap-4 sm:grid-cols-2">
        <Link
          href="/board/sales"
          className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition hover:shadow-md"
        >
          <p className="text-sm font-medium text-slate-500">Pipeline de Vendas</p>
          <p className="mt-1 text-2xl font-bold">{openOpps} oportunidades abertas</p>
          <p className="text-sm text-slate-500">{brl(negotiating._sum.amount?.toString() ?? null)} em negociação</p>
        </Link>
        <Link
          href="/board/projects"
          className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition hover:shadow-md"
        >
          <p className="text-sm font-medium text-slate-500">Pipeline de Projetos</p>
          <p className="mt-1 text-2xl font-bold">{projectsActive} projetos em execução</p>
          <p className="text-sm text-slate-500">{automationsOn} automações ativas cuidando do fluxo</p>
        </Link>
      </div>
    </div>
  );
}
