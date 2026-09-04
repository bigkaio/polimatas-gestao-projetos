import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/auth";
import { dateBR, relativeTime } from "@/lib/format";
import clsx from "clsx";

export const dynamic = "force-dynamic";

const STATUS_LABEL: Record<string, { label: string; cls: string }> = {
  success: { label: "sucesso", cls: "bg-emerald-400/15 text-emerald-300" },
  skipped: { label: "ignorada", cls: "bg-white/10 text-gray-300" },
  error: { label: "erro", cls: "bg-red-500/15 text-red-300" },
  blocked_by_compliance: { label: "bloqueada pelo compliance", cls: "bg-amber-400/15 text-amber-300" },
};

/** Histórico de execuções (US-28), com filtro por regra e por status. */
export default async function RunsPage({
  searchParams,
}: {
  searchParams: { automation?: string; status?: string };
}) {
  await requireSession();

  const [runs, automations] = await Promise.all([
    prisma.automationRun.findMany({
      where: {
        automationId: searchParams.automation || undefined,
        status: (searchParams.status as never) || undefined,
      },
      orderBy: { createdAt: "desc" },
      take: 100,
      include: {
        automation: { select: { name: true } },
        card: { select: { id: true, title: true, board: { select: { key: true } } } },
      },
    }),
    prisma.automation.findMany({ select: { id: true, name: true }, orderBy: { name: "asc" } }),
  ]);

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-light tracking-tight text-white">Execuções de automações</h1>
          <p className="text-sm text-gray-400">Tudo o que o motor fez — auditável, para confiar (ou depurar).</p>
        </div>
        <Link href="/automations" className="text-sm text-cyan-400 hover:underline">
          ← Automações
        </Link>
      </div>

      <form method="get" className="mt-4 flex flex-wrap gap-2">
        <select name="automation" defaultValue={searchParams.automation ?? ""} className="rounded-lg border border-white/15 px-2 py-1.5 text-sm">
          <option value="">Todas as regras</option>
          {automations.map((a) => (
            <option key={a.id} value={a.id}>{a.name}</option>
          ))}
        </select>
        <select name="status" defaultValue={searchParams.status ?? ""} className="rounded-lg border border-white/15 px-2 py-1.5 text-sm">
          <option value="">Todos os status</option>
          {Object.entries(STATUS_LABEL).map(([k, v]) => (
            <option key={k} value={k}>{v.label}</option>
          ))}
        </select>
        <button type="submit" className="rounded-full bg-[#141413] px-4 py-1.5 text-sm font-semibold text-black hover:bg-gray-200">
          Filtrar
        </button>
      </form>

      <div className="mt-4 overflow-x-auto rounded-2xl border border-white/10 bg-[#141413]">
        <table className="w-full text-sm">
          <thead className="bg-[#141413]/5 text-left text-xs uppercase tracking-wide text-gray-400">
            <tr>
              <th className="px-4 py-3">Quando</th>
              <th className="px-4 py-3">Regra</th>
              <th className="px-4 py-3">Card</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Detalhe</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {runs.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-10 text-center text-gray-500">
                  Nenhuma execução ainda — mova um card ou espere o próximo tick temporal.
                </td>
              </tr>
            ) : (
              runs.map((run) => {
                const status = STATUS_LABEL[run.status] ?? STATUS_LABEL.success!;
                return (
                  <tr key={run.id}>
                    <td className="whitespace-nowrap px-4 py-3 text-gray-400" title={dateBR(run.createdAt)}>
                      {relativeTime(run.createdAt)}
                    </td>
                    <td className="px-4 py-3 font-medium">{run.automation.name}</td>
                    <td className="px-4 py-3">
                      {run.card ? (
                        <Link
                          href={`/board/${run.card.board.key}/card/${run.card.id}`}
                          className="text-cyan-400 hover:underline"
                        >
                          {run.card.title}
                        </Link>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span className={clsx("rounded-full px-2 py-0.5 text-xs font-medium", status.cls)}>
                        {status.label}
                      </span>
                    </td>
                    <td className="max-w-md px-4 py-3 text-xs text-gray-400">{run.error ?? "—"}</td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
