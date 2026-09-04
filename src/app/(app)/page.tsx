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
      <div className="flex items-center gap-4">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo.svg" alt="Polímatas" className="h-14 w-auto" />
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-cyan-400">Polímatas Flow</p>
          <h1 className="text-4xl font-light tracking-tight text-white">
            Olá, {session.name.split(" ")[0]}
          </h1>
        </div>
      </div>
      <div className="mt-4 space-y-2 rounded-2xl border border-cyan-400/20 bg-cyan-400/10/50 p-6 text-gray-200">
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
          className="rounded-2xl border border-white/10 bg-[#141413] p-6 shadow-sm transition hover:shadow-md"
        >
          <p className="text-sm font-medium text-gray-400">Pipeline de Vendas</p>
          <p className="mt-1 text-3xl font-light tracking-tight text-white">{openOpps} oportunidades abertas</p>
          <p className="text-sm text-gray-400">{brl(negotiating._sum.amount?.toString() ?? null)} em negociação</p>
        </Link>
        <Link
          href="/board/projects"
          className="rounded-2xl border border-white/10 bg-[#141413] p-6 shadow-sm transition hover:shadow-md"
        >
          <p className="text-sm font-medium text-gray-400">Pipeline de Projetos</p>
          <p className="mt-1 text-3xl font-light tracking-tight text-white">{projectsActive} projetos em execução</p>
          <p className="text-sm text-gray-400">{automationsOn} automações ativas cuidando do fluxo</p>
        </Link>
      </div>
    </div>
  );
}
