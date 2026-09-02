"use client";

import { useMemo, useState } from "react";
import clsx from "clsx";
import {
  CONDITION_FIELDS,
  OPERATORS,
  TRIGGER_TYPES,
  type AutomationAction,
  type AutomationInput,
  type ConditionRule,
  type Trigger,
} from "@/core/rules";
import { fieldLabel, humanizeRule, operatorLabel, type ListRef } from "@/lib/humanize";

const TRIGGER_LABELS: Record<(typeof TRIGGER_TYPES)[number], string> = {
  "card.created": "Um card for criado",
  "card.moved": "Um card entrar em uma lista",
  "card.field_changed": "Um campo do card mudar",
  "task.created": "Uma tarefa for adicionada",
  "task.completed": "Uma tarefa for concluída",
  "card.due_soon": "Faltarem N dias para o prazo do card (temporal)",
  "card.overdue": "O prazo do card passar (temporal)",
  "task.overdue": "O prazo de uma tarefa passar (temporal)",
};

const ACTION_LABELS: Record<AutomationAction["type"], string> = {
  notify_user: "Notificar alguém",
  move_card: "Mover o card",
  assign_user: "Definir o responsável",
  set_due_date: "Definir o prazo",
  add_task: "Adicionar tarefa ao checklist",
  add_comment: "Registrar comentário",
  create_project_card: "Criar card no Pipeline de Projetos",
  set_field: "Alterar um campo",
};

function defaultAction(type: AutomationAction["type"], lists: ListRef[]): AutomationAction {
  switch (type) {
    case "notify_user":
      return { type, target: "assignee", message: "O card {{card.title}} precisa da sua atenção." };
    case "move_card":
      return { type, target_list: lists[0]?.stageKey ?? "" };
    case "assign_user":
      return { type, user_id: "" as never };
    case "set_due_date":
      return { type, mode: "relative", days: 3 };
    case "add_task":
      return { type, title: "Nova tarefa", due_in_days: 3, assignee: "none" };
    case "add_comment":
      return { type, text: "Atualização automática no card {{card.title}}." };
    case "create_project_card":
      return {
        type,
        target_board: "projects",
        target_list: "backlog",
        inherit: ["client_name", "client_email", "client_phone", "amount", "description", "assignee_id"],
        title_template: "{{client_name}} — {{card.title}}",
        link_back: true,
      };
    case "set_field":
      return { type, field: "description", value: "" };
  }
}

const inputCls =
  "rounded-lg border border-slate-300 px-2 py-1.5 text-sm focus:border-indigo-500 focus:outline-none";

/** Construtor de regras sem código, em 3 passos (US-25). */
export function AutomationBuilder({
  lists,
  users,
  initial,
  isSystem,
  onSave,
  onCancel,
}: {
  lists: ListRef[];
  users: { id: string; name: string }[];
  initial: AutomationInput | null;
  isSystem: boolean;
  onSave: (rule: AutomationInput) => Promise<void>;
  onCancel: () => void;
}) {
  const [name, setName] = useState(initial?.name ?? "");
  const [trigger, setTrigger] = useState<Trigger>(initial?.trigger ?? { type: "card.moved" });
  const [conditionOp, setConditionOp] = useState<"AND" | "OR">(initial?.conditions.op ?? "AND");
  const [rules, setRules] = useState<ConditionRule[]>(initial?.conditions.rules ?? []);
  const [actions, setActions] = useState<AutomationAction[]>(initial?.actions ?? []);
  const [saving, setSaving] = useState(false);

  const boardLists = useMemo(
    () => lists.filter((l) => !trigger.board || l.boardKey === trigger.board),
    [lists, trigger.board]
  );

  const preview = useMemo(() => {
    try {
      return humanizeRule(trigger, { op: conditionOp, rules }, actions, lists, users);
    } catch {
      return "…";
    }
  }, [trigger, conditionOp, rules, actions, lists, users]);

  const updateAction = (i: number, patch: Partial<AutomationAction>) =>
    setActions((prev) => prev.map((a, j) => (j === i ? ({ ...a, ...patch } as AutomationAction) : a)));

  const moveAction = (i: number, dir: -1 | 1) =>
    setActions((prev) => {
      const next = [...prev];
      const j = i + dir;
      if (j < 0 || j >= next.length) return prev;
      [next[i], next[j]] = [next[j]!, next[i]!];
      return next;
    });

  const stepCls = "rounded-2xl border border-slate-200 bg-white p-5 shadow-sm";
  const stepTitle = (n: number, label: string) => (
    <h2 className="flex items-center gap-2 text-base font-bold">
      <span className="flex h-7 w-7 items-center justify-center rounded-full bg-indigo-600 text-sm text-white">
        {n}
      </span>
      {label}
    </h2>
  );

  return (
    <div className="mx-auto max-w-3xl space-y-4 px-4 py-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">{initial ? "Editar automação" : "Nova automação"}</h1>
        <button type="button" onClick={onCancel} className="text-sm text-slate-500 hover:underline">
          ← Voltar para a lista
        </button>
      </div>

      <div className="rounded-2xl border border-indigo-200 bg-indigo-50 p-4 text-sm text-indigo-900">
        <p className="text-xs font-semibold uppercase tracking-wide text-indigo-500">Pré-visualização</p>
        <p className="mt-1">{preview}</p>
      </div>

      <label className="block">
        <span className="text-sm font-medium text-slate-700">Nome da regra</span>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder='Ex.: "Card em Revisão avisa o responsável"'
          className={clsx(inputCls, "mt-1 w-full")}
        />
      </label>

      {/* Passo 1 — QUANDO */}
      <section className={stepCls}>
        {stepTitle(1, "Quando… (gatilho)")}
        {isSystem ? (
          <p className="mt-2 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">
            Regra nativa: o gatilho é fixo (venda fechada). Destino, condições e campos herdados
            continuam editáveis.
          </p>
        ) : null}
        <div className="mt-3 flex flex-wrap gap-3">
          <select
            disabled={isSystem}
            value={trigger.type}
            onChange={(e) => setTrigger({ type: e.target.value as Trigger["type"] })}
            className={inputCls}
          >
            {TRIGGER_TYPES.map((t) => (
              <option key={t} value={t}>
                {TRIGGER_LABELS[t]}
              </option>
            ))}
          </select>
          <select
            disabled={isSystem}
            value={trigger.board ?? ""}
            onChange={(e) =>
              setTrigger((t) => ({ ...t, board: (e.target.value || undefined) as Trigger["board"] }))
            }
            className={inputCls}
          >
            <option value="">Em qualquer quadro</option>
            <option value="sales">No Pipeline de Vendas</option>
            <option value="projects">No Pipeline de Projetos</option>
          </select>
          {trigger.type === "card.moved" ? (
            <select
              disabled={isSystem}
              value={trigger.to_list ?? ""}
              onChange={(e) => setTrigger((t) => ({ ...t, to_list: e.target.value || undefined }))}
              className={inputCls}
            >
              <option value="">…entrar em qualquer lista</option>
              {boardLists.map((l) => (
                <option key={`${l.boardKey}:${l.stageKey}`} value={l.stageKey}>
                  …entrar em {l.name} ({l.boardKey === "sales" ? "Vendas" : "Projetos"})
                </option>
              ))}
            </select>
          ) : null}
          {trigger.type === "card.due_soon" ? (
            <label className="flex items-center gap-2 text-sm">
              Dias antes:
              <input
                type="number"
                min={1}
                max={30}
                value={trigger.days ?? 2}
                onChange={(e) => setTrigger((t) => ({ ...t, days: Number(e.target.value) }))}
                className={clsx(inputCls, "w-20")}
              />
            </label>
          ) : null}
        </div>
      </section>

      {/* Passo 2 — SE */}
      <section className={stepCls}>
        {stepTitle(2, "Se… (condições, opcional)")}
        {rules.length > 1 ? (
          <div className="mt-3 flex items-center gap-2 text-sm">
            Combinar com
            <select
              value={conditionOp}
              onChange={(e) => setConditionOp(e.target.value as "AND" | "OR")}
              className={inputCls}
            >
              <option value="AND">E (todas precisam valer)</option>
              <option value="OR">OU (basta uma valer)</option>
            </select>
          </div>
        ) : null}
        <ul className="mt-3 space-y-2">
          {rules.map((rule, i) => (
            <li key={i} className="flex flex-wrap items-center gap-2">
              <select
                value={rule.field}
                onChange={(e) =>
                  setRules((prev) =>
                    prev.map((r, j) => (j === i ? { ...r, field: e.target.value as ConditionRule["field"] } : r))
                  )
                }
                className={inputCls}
              >
                {CONDITION_FIELDS.map((f) => (
                  <option key={f} value={f}>
                    {fieldLabel(f)}
                  </option>
                ))}
              </select>
              <select
                value={rule.operator}
                onChange={(e) =>
                  setRules((prev) =>
                    prev.map((r, j) =>
                      j === i ? { ...r, operator: e.target.value as ConditionRule["operator"] } : r
                    )
                  )
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
                rule.field === "to_list" || rule.field === "from_list" || rule.field === "card.list" ? (
                  <select
                    value={String(rule.value ?? "")}
                    onChange={(e) =>
                      setRules((prev) => prev.map((r, j) => (j === i ? { ...r, value: e.target.value } : r)))
                    }
                    className={inputCls}
                  >
                    <option value="">Escolha a lista…</option>
                    {lists.map((l) => (
                      <option key={`${l.boardKey}:${l.stageKey}`} value={l.stageKey}>
                        {l.name} ({l.boardKey === "sales" ? "Vendas" : "Projetos"})
                      </option>
                    ))}
                  </select>
                ) : rule.field === "card.assignee" || rule.field === "task.assignee" ? (
                  <select
                    value={String(rule.value ?? "")}
                    onChange={(e) =>
                      setRules((prev) => prev.map((r, j) => (j === i ? { ...r, value: e.target.value } : r)))
                    }
                    className={inputCls}
                  >
                    <option value="">Escolha a pessoa…</option>
                    {users.map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.name}
                      </option>
                    ))}
                  </select>
                ) : rule.field === "card.type" ? (
                  <select
                    value={String(rule.value ?? "")}
                    onChange={(e) =>
                      setRules((prev) => prev.map((r, j) => (j === i ? { ...r, value: e.target.value } : r)))
                    }
                    className={inputCls}
                  >
                    <option value="">Escolha…</option>
                    <option value="opportunity">Oportunidade</option>
                    <option value="project">Projeto</option>
                  </select>
                ) : (
                  <input
                    value={String(rule.value ?? "")}
                    onChange={(e) =>
                      setRules((prev) => prev.map((r, j) => (j === i ? { ...r, value: e.target.value } : r)))
                    }
                    placeholder="valor"
                    className={clsx(inputCls, "w-32")}
                  />
                )
              ) : null}
              <button
                type="button"
                aria-label="Remover condição"
                onClick={() => setRules((prev) => prev.filter((_, j) => j !== i))}
                className="text-slate-400 hover:text-red-600"
              >
                ✕
              </button>
            </li>
          ))}
        </ul>
        <button
          type="button"
          onClick={() => setRules((prev) => [...prev, { field: "card.type", operator: "is", value: "" }])}
          className="mt-3 text-sm font-medium text-indigo-600 hover:underline"
        >
          + Adicionar condição
        </button>
      </section>

      {/* Passo 3 — ENTÃO */}
      <section className={stepCls}>
        {stepTitle(3, "Então… (ações, na ordem)")}
        <ul className="mt-3 space-y-3">
          {actions.map((action, i) => (
            <li key={i} className="rounded-xl border border-slate-200 p-3">
              <div className="flex items-center gap-2">
                <select
                  value={action.type}
                  onChange={(e) =>
                    setActions((prev) =>
                      prev.map((a, j) =>
                        j === i ? defaultAction(e.target.value as AutomationAction["type"], lists) : a
                      )
                    )
                  }
                  className={inputCls}
                >
                  {(Object.keys(ACTION_LABELS) as AutomationAction["type"][]).map((t) => (
                    <option key={t} value={t}>
                      {ACTION_LABELS[t]}
                    </option>
                  ))}
                </select>
                <span className="ml-auto flex gap-1">
                  <button type="button" aria-label="Subir ação" onClick={() => moveAction(i, -1)} className="px-1 text-slate-400 hover:text-slate-700">↑</button>
                  <button type="button" aria-label="Descer ação" onClick={() => moveAction(i, 1)} className="px-1 text-slate-400 hover:text-slate-700">↓</button>
                  <button
                    type="button"
                    aria-label="Remover ação"
                    onClick={() => setActions((prev) => prev.filter((_, j) => j !== i))}
                    className="px-1 text-slate-400 hover:text-red-600"
                  >
                    ✕
                  </button>
                </span>
              </div>

              <div className="mt-2 flex flex-wrap items-center gap-2 text-sm">
                {action.type === "notify_user" ? (
                  <>
                    <select
                      value={action.target}
                      onChange={(e) => updateAction(i, { target: e.target.value } as never)}
                      className={inputCls}
                    >
                      <option value="assignee">o responsável do card</option>
                      <option value="creator">quem criou o card</option>
                      <option value="user">uma pessoa específica</option>
                      <option value="all">todos os usuários</option>
                    </select>
                    {action.target === "user" ? (
                      <select
                        value={action.user_id ?? ""}
                        onChange={(e) => updateAction(i, { user_id: e.target.value } as never)}
                        className={inputCls}
                      >
                        <option value="">Escolha…</option>
                        {users.map((u) => (
                          <option key={u.id} value={u.id}>
                            {u.name}
                          </option>
                        ))}
                      </select>
                    ) : null}
                    <input
                      value={action.message}
                      onChange={(e) => updateAction(i, { message: e.target.value } as never)}
                      placeholder="Mensagem — pode usar {{card.title}}"
                      className={clsx(inputCls, "min-w-64 flex-1")}
                    />
                  </>
                ) : null}
                {action.type === "move_card" ? (
                  <select
                    value={action.target_list}
                    onChange={(e) => updateAction(i, { target_list: e.target.value } as never)}
                    className={inputCls}
                  >
                    {lists.map((l) => (
                      <option key={`${l.boardKey}:${l.stageKey}`} value={l.stageKey}>
                        para {l.name} ({l.boardKey === "sales" ? "Vendas" : "Projetos"})
                      </option>
                    ))}
                  </select>
                ) : null}
                {action.type === "assign_user" ? (
                  <select
                    value={action.user_id}
                    onChange={(e) => updateAction(i, { user_id: e.target.value } as never)}
                    className={inputCls}
                  >
                    <option value="">Escolha a pessoa…</option>
                    {users.map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.name}
                      </option>
                    ))}
                  </select>
                ) : null}
                {action.type === "set_due_date" ? (
                  <>
                    <select
                      value={action.mode}
                      onChange={(e) => updateAction(i, { mode: e.target.value } as never)}
                      className={inputCls}
                    >
                      <option value="relative">hoje + N dias</option>
                      <option value="fixed">data fixa</option>
                    </select>
                    {action.mode === "relative" ? (
                      <input
                        type="number"
                        min={0}
                        value={action.days ?? 0}
                        onChange={(e) => updateAction(i, { days: Number(e.target.value) } as never)}
                        className={clsx(inputCls, "w-20")}
                      />
                    ) : (
                      <input
                        type="date"
                        value={action.date ?? ""}
                        onChange={(e) => updateAction(i, { date: e.target.value } as never)}
                        className={inputCls}
                      />
                    )}
                  </>
                ) : null}
                {action.type === "add_task" ? (
                  <>
                    <input
                      value={action.title}
                      onChange={(e) => updateAction(i, { title: e.target.value } as never)}
                      placeholder="Título da tarefa"
                      className={clsx(inputCls, "flex-1")}
                    />
                    <label className="flex items-center gap-1">
                      prazo em
                      <input
                        type="number"
                        min={0}
                        value={action.due_in_days}
                        onChange={(e) => updateAction(i, { due_in_days: Number(e.target.value) } as never)}
                        className={clsx(inputCls, "w-16")}
                      />
                      dia(s)
                    </label>
                  </>
                ) : null}
                {action.type === "add_comment" ? (
                  <input
                    value={action.text}
                    onChange={(e) => updateAction(i, { text: e.target.value } as never)}
                    placeholder="Texto do comentário"
                    className={clsx(inputCls, "flex-1")}
                  />
                ) : null}
                {action.type === "create_project_card" ? (
                  <div className="w-full space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      na lista
                      <select
                        value={action.target_list}
                        onChange={(e) => updateAction(i, { target_list: e.target.value } as never)}
                        className={inputCls}
                      >
                        {lists
                          .filter((l) => l.boardKey === "projects")
                          .map((l) => (
                            <option key={l.stageKey} value={l.stageKey}>
                              {l.name}
                            </option>
                          ))}
                      </select>
                      com o título
                      <input
                        value={action.title_template}
                        onChange={(e) => updateAction(i, { title_template: e.target.value } as never)}
                        className={clsx(inputCls, "min-w-56 flex-1")}
                      />
                    </div>
                    <fieldset className="flex flex-wrap gap-3 text-xs text-slate-600">
                      <legend className="text-xs font-medium text-slate-500">Campos herdados da venda:</legend>
                      {(
                        [
                          ["client_name", "nome do cliente"],
                          ["client_email", "e-mail"],
                          ["client_phone", "telefone"],
                          ["amount", "valor"],
                          ["description", "descrição"],
                          ["assignee_id", "responsável"],
                        ] as const
                      ).map(([key, label]) => (
                        <label key={key} className="flex items-center gap-1">
                          <input
                            type="checkbox"
                            checked={action.inherit.includes(key)}
                            onChange={(e) =>
                              updateAction(i, {
                                inherit: e.target.checked
                                  ? [...action.inherit, key]
                                  : action.inherit.filter((k) => k !== key),
                              } as never)
                            }
                          />
                          {label}
                        </label>
                      ))}
                    </fieldset>
                  </div>
                ) : null}
                {action.type === "set_field" ? (
                  <>
                    <select
                      value={action.field}
                      onChange={(e) => updateAction(i, { field: e.target.value } as never)}
                      className={inputCls}
                    >
                      <option value="title">título</option>
                      <option value="description">descrição</option>
                      <option value="loss_reason">motivo de perda</option>
                      <option value="client_name">nome do cliente</option>
                      <option value="amount">valor</option>
                    </select>
                    <input
                      value={action.value}
                      onChange={(e) => updateAction(i, { value: e.target.value } as never)}
                      placeholder="novo valor"
                      className={clsx(inputCls, "flex-1")}
                    />
                  </>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
        <button
          type="button"
          onClick={() => setActions((prev) => [...prev, defaultAction("notify_user", lists)])}
          className="mt-3 text-sm font-medium text-indigo-600 hover:underline"
        >
          + Adicionar ação
        </button>
      </section>

      <div className="flex justify-end gap-2">
        <button
          type="button"
          onClick={onCancel}
          className="rounded-lg px-4 py-2 text-sm text-slate-600 hover:bg-slate-100"
        >
          Cancelar
        </button>
        <button
          type="button"
          disabled={saving || !name.trim() || actions.length === 0}
          onClick={async () => {
            setSaving(true);
            await onSave({
              name: name.trim(),
              enabled: initial?.enabled ?? true,
              trigger,
              conditions: { op: conditionOp, rules },
              actions,
            });
            setSaving(false);
          }}
          className="rounded-lg bg-indigo-600 px-5 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
        >
          {saving ? "Salvando…" : "Salvar automação"}
        </button>
      </div>
    </div>
  );
}
