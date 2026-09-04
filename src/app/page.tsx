import Link from "next/link";
import { getSession } from "@/lib/auth";

const NAV = [
  { href: "#sobre", label: "Sobre" },
  { href: "#funcionalidades", label: "Funcionalidades" },
  { href: "#como-funciona", label: "Como funciona" },
  { href: "#tecnologia", label: "Tecnologia" },
];

const eyebrow = "text-xs font-semibold uppercase tracking-widest text-cyan-400";

/** Ícones outline (guia seção 6): linha fina, sem preenchimento, cor ciano. */
const ICON_PROPS = {
  width: 20,
  height: 20,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.6,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

const FEATURE_ICONS = {
  sync: (
    <svg {...ICON_PROPS}>
      <path d="M4 12a8 8 0 0 1 14-5.3M20 12a8 8 0 0 1-14 5.3" />
      <path d="M18 3v4h-4M6 21v-4h4" />
    </svg>
  ),
  automation: (
    <svg {...ICON_PROPS}>
      <rect x="4" y="4" width="6" height="6" rx="1.5" />
      <rect x="14" y="14" width="6" height="6" rx="1.5" />
      <path d="M10 7h4a3 3 0 0 1 3 3v4M14 17h-4a3 3 0 0 1-3-3V10" />
    </svg>
  ),
  shield: (
    <svg {...ICON_PROPS}>
      <path d="M12 3l7 3v6c0 4.5-3 7.5-7 9-4-1.5-7-4.5-7-9V6l7-3z" />
      <path d="M9 12l2 2 4-4" />
    </svg>
  ),
  board: (
    <svg {...ICON_PROPS}>
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <path d="M9 4v16M15 4v16" />
    </svg>
  ),
  bell: (
    <svg {...ICON_PROPS}>
      <path d="M18 8a6 6 0 10-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
      <path d="M13.7 21a2 2 0 01-3.4 0" />
    </svg>
  ),
  audit: (
    <svg {...ICON_PROPS}>
      <path d="M9 4h6a1 1 0 011 1v1H8V5a1 1 0 011-1z" />
      <rect x="5" y="6" width="14" height="15" rx="2" />
      <path d="M9 12h6M9 16h6" />
    </svg>
  ),
} as const;

/** Landing pública: contextualiza o sistema antes do login. */
export default async function LandingPage() {
  const session = await getSession();
  const appHref = session ? "/inicio" : "/login";

  return (
    <div className="min-h-screen bg-black text-gray-200">
      {/* Header fixo com blur (guia 5.1) */}
      <header className="fixed inset-x-0 top-0 z-50 px-3 pt-3">
        <div className="mx-auto flex h-14 max-w-6xl items-center gap-4 rounded-2xl border border-white/10 bg-black/70 px-4 backdrop-blur-md">
          <Link href="/" className="flex shrink-0 items-center gap-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo.svg" alt="" className="h-7 w-auto" />
            <span className="text-lg font-medium text-white">
              Polímatas <span className="font-light text-cyan-400">Flow</span>
            </span>
          </Link>
          <nav className="mx-auto hidden items-center gap-1 md:flex">
            {NAV.map((item) => (
              <a
                key={item.href}
                href={item.href}
                className="rounded-full px-3 py-1.5 text-sm font-medium text-gray-300 hover:bg-white/10 hover:text-white"
              >
                {item.label}
              </a>
            ))}
          </nav>
          <div className="ml-auto flex items-center gap-2 md:ml-0">
            {session ? (
              <Link
                href={appHref}
                className="rounded-full bg-white px-4 py-1.5 text-sm font-semibold text-black hover:bg-gray-200"
              >
                Abrir o sistema
              </Link>
            ) : (
              <>
                <Link
                  href="/login"
                  className="rounded-full border border-white/15 px-4 py-1.5 text-sm font-medium text-gray-200 hover:bg-white/10"
                >
                  Entrar
                </Link>
                <Link
                  href="/cadastro"
                  className="rounded-full bg-white px-4 py-1.5 text-sm font-semibold text-black hover:bg-gray-200"
                >
                  Cadastrar-se
                </Link>
              </>
            )}
          </div>
        </div>
      </header>

      {/* Hero (faixa gradiente do guia) */}
      <section
        className="px-4 pb-20 pt-32 text-center"
        style={{ background: "linear-gradient(180deg, #164E63 0%, #155E75 30%, #000000 100%)" }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo.svg" alt="Polímatas" className="mx-auto h-24 w-auto" />
        <p className={`mt-6 ${eyebrow}`}>Gestão de vendas e projetos</p>
        <h1 className="mx-auto mt-3 max-w-3xl text-4xl font-light tracking-tight text-white md:text-6xl">
          Da venda fechada ao projeto entregue, <span className="text-cyan-400">sem repasse manual</span>.
        </h1>
        <p className="mx-auto mt-5 max-w-2xl text-lg text-gray-300">
          O Polímatas Flow conecta o funil comercial à execução em dois quadros integrados —
          com automações que você mesmo cria e regras de compliance que bloqueiam de verdade.
        </p>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <Link
            href={appHref}
            className="rounded-full bg-cyan-500 px-6 py-3 text-sm font-semibold text-black hover:bg-cyan-400"
          >
            {session ? "Abrir o sistema" : "Acessar o sistema"}
          </Link>
        </div>
        <p className="mt-6 text-xs text-gray-500">
          Credenciais de demonstração na tela de login • Nenhuma instalação necessária
        </p>
      </section>

      {/* Sobre */}
      <section id="sobre" className="mx-auto max-w-5xl scroll-mt-24 px-4 py-20">
        <p className={eyebrow}>Sobre o sistema</p>
        <h2 className="mt-2 max-w-2xl text-3xl font-light tracking-tight text-white md:text-4xl">
          Um único fluxo, do <span className="text-cyan-400">Lead</span> ao{" "}
          <span className="text-cyan-400">Concluído</span>
        </h2>
        <div className="mt-6 grid gap-4 text-gray-300 md:grid-cols-2">
          <p>
            Hoje o controle de vendas e projetos vive disperso em planilhas, WhatsApp e anotações
            soltas. Venda fechada demora a virar projeto, tarefa fica sem responsável, prazo passa
            despercebido — e a gestão acontece por achismo.
          </p>
          <p>
            O Polímatas Flow centraliza tudo em dois quadros no estilo Trello:{" "}
            <strong className="text-white">Pipeline de Vendas</strong> (Lead → Qualificação →
            Proposta → Negociação → Fechado/Perdido) e{" "}
            <strong className="text-white">Pipeline de Projetos</strong> (Backlog → Em andamento →
            Revisão → Concluído), integrados por automação.
          </p>
        </div>
      </section>

      {/* Funcionalidades */}
      <section id="funcionalidades" className="border-t border-white/10 bg-[#030712]">
        <div className="mx-auto max-w-5xl scroll-mt-24 px-4 py-20">
          <p className={eyebrow}>Funcionalidades</p>
          <h2 className="mt-2 text-3xl font-light tracking-tight text-white md:text-4xl">
            O que o sistema faz por você
          </h2>
          <div className="mt-8 grid gap-4 md:grid-cols-3">
            {[
              {
                icon: FEATURE_ICONS.sync,
                title: "Integração venda → projeto",
                cyan: "automática",
                text: "Venda marcada como Fechada vira card de projeto em menos de 2 segundos, herdando cliente, valor, descrição e responsável — com rastreabilidade nos dois sentidos.",
              },
              {
                icon: FEATURE_ICONS.automation,
                title: "Automações sem",
                cyan: "código",
                text: "Monte regras em 3 passos (Quando → Se → Então) escolhendo opções em telas: notificar, mover, atribuir, criar tarefa. Com gatilhos temporais para prazos e atrasos.",
              },
              {
                icon: FEATURE_ICONS.shield,
                title: "Compliance que",
                cyan: "bloqueia",
                text: "Regras impostas no servidor: nenhuma tarefa sem prazo, nenhum projeto concluído com pendências. Não é aviso — a ação é recusada e tudo fica auditado.",
              },
              {
                icon: FEATURE_ICONS.board,
                title: "Quadros com",
                cyan: "drag and drop",
                text: "Cards com responsável, prazo, checklist e histórico. Arraste entre listas com atualização otimista; destino inválido é sinalizado antes do drop.",
              },
              {
                icon: FEATURE_ICONS.bell,
                title: "Notificações no",
                cyan: "momento certo",
                text: "Central de avisos alimentada pelas automações: card em revisão, tarefa vencida, projeto criado. Cada aviso leva direto ao card.",
              },
              {
                icon: FEATURE_ICONS.audit,
                title: "Tudo",
                cyan: "auditável",
                text: "Histórico por card, log de execuções das automações e registro de cada bloqueio de compliance — quem tentou, o quê e quando.",
              },
            ].map((f) => (
              <div key={f.title} className="rounded-2xl border border-white/10 bg-[#141413] p-5">
                <span className="flex h-10 w-10 items-center justify-center rounded-full border border-white/15 text-cyan-400">
                  {f.icon}
                </span>
                <h3 className="mt-3 font-medium text-white">
                  {f.title} <span className="text-cyan-400">{f.cyan}</span>
                </h3>
                <p className="mt-2 text-sm text-gray-400">{f.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Como funciona */}
      <section id="como-funciona" className="mx-auto max-w-5xl scroll-mt-24 px-4 py-20">
        <p className={eyebrow}>Como funciona</p>
        <h2 className="mt-2 text-3xl font-light tracking-tight text-white md:text-4xl">
          O fluxo central em quatro passos
        </h2>
        <ol className="mt-8 space-y-6 border-l border-white/10 pl-6">
          {[
            ["Registre a oportunidade", "O vendedor cria o card com cliente, valor e previsão — e move pelo funil conforme a negociação avança."],
            ["Feche a venda", "Ao arrastar para Fechado, o sistema confirma e mostra o que será criado. O motivo de perda é obrigatório no caminho contrário."],
            ["O projeto nasce sozinho", "Um card aparece no Backlog de Projetos herdando os dados da venda, sem retrabalho e sem duplicar — a mesma venda nunca gera dois projetos."],
            ["Execute com garantias", "Checklist com prazos obrigatórios, automações movendo e avisando, e compliance impedindo o que sair do padrão."],
          ].map(([title, text], i) => (
            <li key={title} className="relative">
              <span className="absolute -left-[35px] flex h-5 w-5 items-center justify-center rounded-full bg-cyan-500 text-[10px] font-bold text-black">
                {i + 1}
              </span>
              <h3 className="font-medium text-white">{title}</h3>
              <p className="mt-1 text-sm text-gray-400">{text}</p>
            </li>
          ))}
        </ol>
      </section>

      {/* Tecnologia */}
      <section id="tecnologia" className="border-t border-white/10 bg-[#030712]">
        <div className="mx-auto max-w-5xl scroll-mt-24 px-4 py-20">
          <p className={eyebrow}>Tecnologia</p>
          <h2 className="mt-2 text-3xl font-light tracking-tight text-white md:text-4xl">
            Construído com método
          </h2>
          <p className="mt-4 max-w-2xl text-gray-300">
            Next.js, TypeScript, Prisma e PostgreSQL. Toda escrita passa por uma única camada de
            domínio — compliance avaliado antes de persistir, evento emitido depois — e os motores
            são cobertos por testes automatizados.
          </p>
          <div className="mt-6 flex flex-wrap gap-2">
            {["Next.js", "TypeScript", "Prisma", "PostgreSQL", "Tailwind", "Vercel"].map((t) => (
              <span key={t} className="rounded-full border border-white/10 px-3 py-1 text-sm text-gray-400">
                {t}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* CTA final */}
      <section className="px-4 py-24 text-center">
        <h2 className="text-3xl font-light tracking-tight text-white md:text-4xl">
          Pronto para ver o fluxo <span className="text-cyan-400">rodando</span>?
        </h2>
        <p className="mx-auto mt-3 max-w-xl text-gray-400">
          Entre com uma das credenciais de demonstração e acompanhe uma venda virar projeto.
        </p>
        <Link
          href={appHref}
          className="mt-7 inline-block rounded-full bg-cyan-500 px-8 py-3 text-sm font-semibold text-black hover:bg-cyan-400"
        >
          {session ? "Abrir o sistema" : "Acessar o sistema"}
        </Link>
        <p className="mt-4 text-xs text-gray-500">
          Demonstração aberta • Um usuário por papel • Dados de exemplo inclusos
        </p>
      </section>

      <footer className="border-t border-white/10 px-4 py-8">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3 text-sm text-gray-500">
          <span className="flex items-center gap-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo.svg" alt="" className="h-5 w-auto" />
            Polímatas Flow — transformando negócios com automação inteligente.
          </span>
          <Link href="/login" className="text-cyan-400 hover:underline">
            Entrar no sistema →
          </Link>
        </div>
      </footer>
    </div>
  );
}
