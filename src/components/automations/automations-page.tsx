"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import clsx from "clsx";
import {
  deleteAutomationAction,
  duplicateAutomationAction,
  saveAutomationAction,
  testAutomationAction,
  toggleAutomationAction,
} from "@/app/actions/automations";
import { automationSchema, type AutomationInput } from "@/core/rules";
import { humanizeRule, type ListRef } from "@/lib/humanize";
import { useToast } from "@/components/toast";
import { AutomationBuilder } from "./builder";

export type AutomationDTO = {
  id: string;
  name: string;
  enabled: boolean;
  isSystem: boolean;
  trigger: unknown;
  conditions: unknown;
  actions: unknown;
  runCount: number;
};

type CardRef = { id: string; title: string; type: string };
type UserRef = { id: string; name: string };

export function AutomationsPage({
  automations,
  lists,
  users,
  cards,
  canManage,
}: {
  automations: AutomationDTO[];
  lists: ListRef[];
  users: UserRef[];
  cards: CardRef[];
  canManage: boolean;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [, startTransition] = useTransition();
  const [editing, setEditing] = useState<{ id: string | null; initial: AutomationInput | null } | null>(null);
  const [testing, setTesting] = useState<AutomationDTO | null>(null);
  const [testCard, setTestCard] = useState("");
  const [testResult, setTestResult] = useState<{ matched: boolean; lines: string[] } | null>(null);

  const refresh = () => startTransition(() => router.refresh());

  const describe = (a: AutomationDTO): string => {
    const parsed = automationSchema
      .pick({ trigger: true, conditions: true, actions: true })
      .safeParse({ trigger: a.trigger, conditions: a.conditions, actions: a.actions });
    if (!parsed.success) return "Regra com formato inválido.";
    return humanizeRule(parsed.data.trigger, parsed.data.conditions, parsed.data.actions, lists, users);
  };

  const openEdit = (a: AutomationDTO | null) => {
    if (!a) {
      setEditing({ id: null, initial: null });
      return;
    }
    const parsed = automationSchema.safeParse({
      name: a.name,
      enabled: a.enabled,
      trigger: a.trigger,
      conditions: a.conditions,
      actions: a.actions,
    });
    setEditing({ id: a.id, initial: parsed.success ? parsed.data : null });
  };

  if (editing) {
    return (
      <AutomationBuilder
        lists={lists}
        users={users}
        initial={editing.initial}
        isSystem={automations.find((a) => a.id === editing.id)?.isSystem ?? false}
        onCancel={() => setEditing(null)}
        onSave={async (rule) => {
          const result = await saveAutomationAction({ id: editing.id, rule });
          if (!result.ok) {
            toast(result.error, "error");
            return;
          }
          toast("Automação salva.", "success");
          setEditing(null);
          refresh();
        }}
      />
    );
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-light tracking-tight text-white">Automações</h1>
          <p className="text-sm text-gray-400">
            O que o sistema faz sozinho — regras criadas aqui, sem escrever código.
          </p>
        </div>
        <div className="flex gap-2">
          <a
            href="/automations/runs"
            className="rounded-full border border-white/15 px-4 py-2 text-sm font-medium text-gray-200 hover:bg-[#141413]/5"
          >
            Histórico de execuções
          </a>
          {canManage ? (
            <button
              type="button"
              onClick={() => openEdit(null)}
              className="rounded-full bg-cyan-500 px-4 py-2 text-sm font-medium text-white hover:bg-cyan-400"
            >
              + Nova automação
            </button>
          ) : null}
        </div>
      </div>

      <ul className="mt-6 space-y-3">
        {automations.map((a) => (
          <li key={a.id} className="rounded-2xl border border-white/10 bg-[#141413] p-4 shadow-sm">
            <div className="flex flex-wrap items-start gap-3">
              <div className="min-w-0 flex-1">
                <p className="font-semibold">
                  {a.name}
                  {a.isSystem ? (
                    <span className="ml-2 rounded-full bg-cyan-400/15 px-2 py-0.5 text-xs font-medium text-cyan-300">
                      nativa
                    </span>
                  ) : null}
                </p>
                <p className="mt-1 text-sm text-gray-300">{describe(a)}</p>
                <p className="mt-1 text-xs text-gray-500">{a.runCount} execução(ões)</p>
              </div>
              {canManage ? (
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    role="switch"
                    aria-checked={a.enabled}
                    aria-label={`${a.enabled ? "Desativar" : "Ativar"} ${a.name}`}
                    onClick={async () => {
                      const r = await toggleAutomationAction({ id: a.id, enabled: !a.enabled });
                      if (!r.ok) toast(r.error, "error");
                      refresh();
                    }}
                    className={clsx(
                      "relative h-6 w-11 rounded-full transition",
                      a.enabled ? "bg-emerald-500" : "bg-white/20"
                    )}
                  >
                    <span
                      className={clsx(
                        "absolute top-0.5 h-5 w-5 rounded-full bg-[#141413] shadow transition-all",
                        a.enabled ? "left-[22px]" : "left-0.5"
                      )}
                    />
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setTesting(a);
                      setTestCard("");
                      setTestResult(null);
                    }}
                    className="rounded-lg px-2 py-1 text-sm text-gray-400 hover:bg-white/10"
                  >
                    Testar
                  </button>
                  <button
                    type="button"
                    onClick={() => openEdit(a)}
                    className="rounded-lg px-2 py-1 text-sm text-gray-400 hover:bg-white/10"
                  >
                    Editar
                  </button>
                  <button
                    type="button"
                    onClick={async () => {
                      const r = await duplicateAutomationAction({ id: a.id });
                      if (!r.ok) toast(r.error, "error");
                      refresh();
                    }}
                    className="rounded-lg px-2 py-1 text-sm text-gray-400 hover:bg-white/10"
                  >
                    Duplicar
                  </button>
                  {!a.isSystem ? (
                    <button
                      type="button"
                      onClick={async () => {
                        const r = await deleteAutomationAction({ id: a.id });
                        if (!r.ok) toast(r.error, "error");
                        refresh();
                      }}
                      className="rounded-lg px-2 py-1 text-sm text-red-400 hover:bg-red-500/10"
                    >
                      Excluir
                    </button>
                  ) : null}
                </div>
              ) : null}
            </div>
          </li>
        ))}
      </ul>

      {testing ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="w-full max-w-lg rounded-2xl border border-white/10 bg-[#141420] p-6 shadow-2xl">
            <h2 className="text-xl font-light text-white">Testar “{testing.name}”</h2>
            <p className="mt-1 text-sm text-gray-400">
              Simulação: mostra o que a regra <strong>faria</strong> com o card escolhido — nada é executado.
            </p>
            <select
              value={testCard}
              onChange={(e) => setTestCard(e.target.value)}
              className="mt-4 w-full rounded-lg border border-white/15 px-3 py-2 text-sm"
            >
              <option value="">Escolha um card…</option>
              {cards.map((c) => (
                <option key={c.id} value={c.id}>
                  [{c.type === "opportunity" ? "venda" : "projeto"}] {c.title}
                </option>
              ))}
            </select>
            {testResult ? (
              <div
                className={clsx(
                  "mt-4 rounded-lg p-3 text-sm",
                  testResult.matched ? "bg-emerald-400/10 text-emerald-300" : "bg-amber-400/10 text-amber-300"
                )}
              >
                {testResult.matched ? (
                  <>
                    <p className="font-medium">As condições passam. A regra faria:</p>
                    <ul className="mt-1 list-inside list-disc">
                      {testResult.lines.map((l, i) => (
                        <li key={i}>{l}</li>
                      ))}
                    </ul>
                  </>
                ) : (
                  <p>As condições da regra não passam para este card — nada seria feito.</p>
                )}
              </div>
            ) : null}
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setTesting(null)}
                className="rounded-full px-4 py-2 text-sm text-gray-300 hover:bg-[#141413]/10"
              >
                Fechar
              </button>
              <button
                type="button"
                disabled={!testCard}
                onClick={async () => {
                  const r = await testAutomationAction({ id: testing.id, cardId: testCard });
                  if (!r.ok) {
                    toast(r.error, "error");
                    return;
                  }
                  setTestResult({
                    matched: r.data!.matched,
                    lines: r.data!.outcomes.map((o) => o.detail ?? o.action),
                  });
                }}
                className="rounded-full bg-cyan-500 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
              >
                Simular
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
