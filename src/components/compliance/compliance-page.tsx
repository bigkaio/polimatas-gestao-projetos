"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import clsx from "clsx";
import {
  saveComplianceRuleAction,
  toggleComplianceRuleAction,
} from "@/app/actions/compliance";
import {
  COMPLIANCE_SCOPES,
  CONDITION_FIELDS,
  OPERATORS,
  type ConditionRule,
} from "@/core/rules";
import { fieldLabel, humanizeConditions, operatorLabel, type ListRef } from "@/lib/humanize";
import { relativeTime } from "@/lib/format";
import { useToast } from "@/components/toast";

type RuleDTO = {
  id: string;
  name: string;
  scope: string;
  condition: unknown;
  message: string;
  severity: "block" | "warn";
  enabled: boolean;
  isSystem: boolean;
  violationCount: number;
};

type ViolationDTO = {
  id: string;
  ruleName: string;
  actorName: string | null;
  card: { id: string; title: string; boardKey: string } | null;
  createdAt: string;
};

const SCOPE_LABELS: Record<string, string> = {
  "task.create": "ao criar tarefa",
  "task.update": "ao editar tarefa",
  "card.create": "ao criar card",
  "card.move": "ao mover card",
  "card.update": "ao editar card",
  "opportunity.close": "ao fechar venda",
};

const inputCls =
  "rounded-lg border border-white/15 px-2 py-1.5 text-sm focus:border-cyan-400 focus:outline-none";

export function CompliancePage({
  rules,
  violations,
  lists,
  users,
  canManage,
}: {
  rules: RuleDTO[];
  violations: ViolationDTO[];
  lists: ListRef[];
  users: { id: string; name: string }[];
  canManage: boolean;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [, startTransition] = useTransition();
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({
    name: "",
    scope: "card.move" as string,
    message: "",
    severity: "block" as "block" | "warn",
    conditionRules: [] as ConditionRule[],
  });

  const refresh = () => startTransition(() => router.refresh());

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <h1 className="text-3xl font-light tracking-tight text-white">Compliance</h1>
      <p className="text-sm text-gray-400">
        Regras que o sistema <strong>impõe no servidor</strong> — não são avisos: a ação fora do
        padrão é recusada e nada é gravado.
      </p>

      <ul className="mt-6 space-y-3">
        {rules.map((rule) => (
          <li key={rule.id} className="rounded-2xl border border-white/10 bg-[#141413] p-4 shadow-sm">
            <div className="flex flex-wrap items-start gap-3">
              <div className="min-w-0 flex-1">
                <p className="font-semibold">
                  {rule.name}
                  {rule.isSystem ? (
                    <span className="ml-2 rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700">
                      obrigatória
                    </span>
                  ) : null}
                  <span
                    className={clsx(
                      "ml-2 rounded-full px-2 py-0.5 text-xs font-medium",
                      rule.severity === "block"
                        ? "bg-white text-black"
                        : "bg-amber-400/15 text-amber-300"
                    )}
                  >
                    {rule.severity === "block" ? "bloqueia" : "avisa"}
                  </span>
                </p>
                <p className="mt-1 text-sm text-gray-300">
                  {rule.scope
                    .split(",")
                    .map((s) => SCOPE_LABELS[s.trim()] ?? s)
                    .join(" e ")}
                  {(() => {
                    const c = rule.condition as { op?: "AND" | "OR"; rules?: ConditionRule[] };
                    return c?.rules?.length
                      ? `, ${humanizeConditions({ op: c.op ?? "AND", rules: c.rules }, lists, users)}`
                      : "";
                  })()}
                </p>
                <p className="mt-1 text-xs text-gray-500">
                  Mensagem: “{rule.message}” · {rule.violationCount} bloqueio(s)/aviso(s)
                </p>
              </div>
              {canManage ? (
                <button
                  type="button"
                  role="switch"
                  aria-checked={rule.enabled}
                  disabled={rule.isSystem}
                  title={rule.isSystem ? "Regra do briefing: não pode ser desligada" : undefined}
                  aria-label={`${rule.enabled ? "Desativar" : "Ativar"} ${rule.name}`}
                  onClick={async () => {
                    const r = await toggleComplianceRuleAction({ id: rule.id, enabled: !rule.enabled });
                    if (!r.ok) toast(r.error, "error");
                    refresh();
                  }}
                  className={clsx(
                    "relative h-6 w-11 rounded-full transition",
                    rule.enabled ? "bg-emerald-500" : "bg-white/20",
                    rule.isSystem && "cursor-not-allowed opacity-60"
                  )}
                >
                  <span
                    className={clsx(
                      "absolute top-0.5 h-5 w-5 rounded-full bg-[#141413] shadow transition-all",
                      rule.enabled ? "left-[22px]" : "left-0.5"
                    )}
                  />
                </button>
              ) : null}
            </div>
          </li>
        ))}
      </ul>

      {canManage ? (
        creating ? (
          <div className="mt-6 rounded-2xl border border-white/10 bg-[#141413] p-5 shadow-sm">
            <h2 className="font-bold">Nova regra de compliance</h2>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <input
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="Nome da regra"
                className={inputCls}
              />
              <select
                value={form.scope}
                onChange={(e) => setForm((f) => ({ ...f, scope: e.target.value }))}
                className={inputCls}
              >
                {COMPLIANCE_SCOPES.map((s) => (
                  <option key={s} value={s}>
                    Avaliar {SCOPE_LABELS[s]}
                  </option>
                ))}
              </select>
              <input
                value={form.message}
                onChange={(e) => setForm((f) => ({ ...f, message: e.target.value }))}
                placeholder="Mensagem mostrada ao usuário (diga a ação corretiva)"
                className={clsx(inputCls, "sm:col-span-2")}
              />
              <select
                value={form.severity}
                onChange={(e) => setForm((f) => ({ ...f, severity: e.target.value as "block" | "warn" }))}
                className={inputCls}
              >
                <option value="block">Bloquear a ação</option>
                <option value="warn">Somente avisar e registrar</option>
              </select>
            </div>

            <p className="mt-4 text-sm font-medium text-gray-200">Quando estas condições valerem:</p>
            <ul className="mt-2 space-y-2">
              {form.conditionRules.map((rule, i) => (
                <li key={i} className="flex flex-wrap items-center gap-2">
                  <select
                    value={rule.field}
                    onChange={(e) =>
                      setForm((f) => ({
                        ...f,
                        conditionRules: f.conditionRules.map((r, j) =>
                          j === i ? { ...r, field: e.target.value as ConditionRule["field"] } : r
                        ),
                      }))
                    }
                    className={inputCls}
                  >
                    {CONDITION_FIELDS.map((field) => (
                      <option key={field} value={field}>
                        {fieldLabel(field)}
                      </option>
                    ))}
                  </select>
                  <select
                    value={rule.operator}
                    onChange={(e) =>
                      setForm((f) => ({
                        ...f,
                        conditionRules: f.conditionRules.map((r, j) =>
                          j === i ? { ...r, operator: e.target.value as ConditionRule["operator"] } : r
                        ),
                      }))
                    }
                    className={inputCls}
                  >
                    {OPERATORS.map((op) => (
                      <option key={op} value={op}>
                        {operatorLabel(op)}
                      </option>
                    ))}
                  </select>
                  {rule.operator !== "is_empty" && rule.operator !== "is_filled" ? (
                    <input
                      value={String(rule.value ?? "")}
                      onChange={(e) =>
                        setForm((f) => ({
                          ...f,
                          conditionRules: f.conditionRules.map((r, j) =>
                            j === i ? { ...r, value: e.target.value } : r
                          ),
                        }))
                      }
                      placeholder="valor"
                      className={clsx(inputCls, "w-36")}
                    />
                  ) : null}
                  <button
                    type="button"
                    aria-label="Remover condição"
                    onClick={() =>
                      setForm((f) => ({
                        ...f,
                        conditionRules: f.conditionRules.filter((_, j) => j !== i),
                      }))
                    }
                    className="text-gray-500 hover:text-red-400"
                  >
                    ✕
                  </button>
                </li>
              ))}
            </ul>
            <button
              type="button"
              onClick={() =>
                setForm((f) => ({
                  ...f,
                  conditionRules: [...f.conditionRules, { field: "card.type", operator: "is", value: "" }],
                }))
              }
              className="mt-2 text-sm font-medium text-cyan-400 hover:underline"
            >
              + Adicionar condição
            </button>

            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setCreating(false)}
                className="rounded-full px-4 py-2 text-sm text-gray-300 hover:bg-[#141413]/10"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={!form.name.trim() || !form.message.trim() || form.conditionRules.length === 0}
                onClick={async () => {
                  const r = await saveComplianceRuleAction({
                    id: null,
                    rule: {
                      name: form.name.trim(),
                      scope: form.scope,
                      condition: { op: "AND", rules: form.conditionRules },
                      message: form.message.trim(),
                      severity: form.severity,
                      enabled: true,
                    },
                  });
                  if (!r.ok) {
                    toast(r.error, "error");
                    return;
                  }
                  toast("Regra criada.", "success");
                  setCreating(false);
                  setForm({ name: "", scope: "card.move", message: "", severity: "block", conditionRules: [] });
                  refresh();
                }}
                className="rounded-full bg-cyan-500 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
              >
                Criar regra
              </button>
            </div>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setCreating(true)}
            className="mt-6 rounded-full bg-cyan-500 px-4 py-2 text-sm font-medium text-white hover:bg-cyan-400"
          >
            + Nova regra de compliance
          </button>
        )
      ) : null}

      {/* Log de bloqueios (US-34) */}
      <h2 className="mt-10 text-xl font-light text-white">O que o sistema impediu</h2>
      <p className="text-sm text-gray-400">Prova viva de que as regras bloqueiam — quem tentou, o quê e quando.</p>
      <ul className="mt-3 divide-y divide-white/5 rounded-2xl border border-white/10 bg-[#141413]">
        {violations.length === 0 ? (
          <li className="px-4 py-8 text-center text-sm text-gray-500">
            Nenhum bloqueio registrado ainda — tente criar uma tarefa sem prazo. 😉
          </li>
        ) : (
          violations.map((v) => (
            <li key={v.id} className="flex flex-wrap items-center gap-2 px-4 py-3 text-sm">
              <span className="font-medium text-gray-100">{v.ruleName}</span>
              <span className="text-gray-400">
                — {v.actorName ?? "automação"} em{" "}
                {v.card ? (
                  <Link
                    href={`/board/${v.card.boardKey}/card/${v.card.id}`}
                    className="text-cyan-400 hover:underline"
                  >
                    {v.card.title}
                  </Link>
                ) : (
                  "card removido"
                )}
              </span>
              <span className="ml-auto text-xs text-gray-500">{relativeTime(v.createdAt)}</span>
            </li>
          ))
        )}
      </ul>
    </div>
  );
}
