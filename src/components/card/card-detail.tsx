"use client";

import Link from "next/link";
import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import clsx from "clsx";
import { updateCardAction } from "@/app/actions/cards";
import {
  createTaskAction,
  deleteTaskAction,
  reorderTasksAction,
  toggleTaskAction,
  updateTaskAction,
} from "@/app/actions/tasks";
import { useToast } from "@/components/toast";
import { brl, dateBR, dueStatus, relativeTime } from "@/lib/format";

export type CardFullDTO = {
  id: string;
  boardKey: string;
  listName: string;
  type: "opportunity" | "project";
  title: string;
  description: string | null;
  assigneeId: string | null;
  dueDate: string | null;
  clientName: string | null;
  clientEmail: string | null;
  clientPhone: string | null;
  amount: string | null;
  lossReason: string | null;
  source: { id: string; title: string; boardKey: string } | null;
  spawned: { id: string; title: string; boardKey: string } | null;
};

export type TaskDTO = {
  id: string;
  title: string;
  done: boolean;
  dueDate: string;
  assignee: { id: string; name: string } | null;
};

export type ActivityDTO = {
  id: string;
  action: string;
  actorName: string | null;
  automationName: string | null;
  detail: string | null;
  createdAt: string;
};

const ACTION_LABEL: Record<string, string> = {
  "card.created": "criou o card",
  "card.moved": "moveu o card",
  "card.updated": "atualizou o card",
  "task.created": "adicionou uma tarefa",
  "task.completed": "concluiu uma tarefa",
  "task.reopened": "reabriu uma tarefa",
  "task.updated": "editou uma tarefa",
  "task.deleted": "removeu uma tarefa",
  comment: "comentou",
};

export function CardDetail({
  card,
  tasks,
  activities,
  users,
}: {
  card: CardFullDTO;
  tasks: TaskDTO[];
  activities: ActivityDTO[];
  users: { id: string; name: string }[];
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [, startTransition] = useTransition();
  const [newTask, setNewTask] = useState({ title: "", dueDate: "", assigneeId: "" });
  const taskDueRef = useRef<HTMLInputElement>(null);
  const [highlightDue, setHighlightDue] = useState(false);

  const save = async (patch: Record<string, unknown>, successMsg = "Salvo.") => {
    const result = await updateCardAction({ cardId: card.id, patch });
    if (!result.ok) {
      toast(result.error, "error");
      return false;
    }
    toast(successMsg, "success");
    startTransition(() => router.refresh());
    return true;
  };

  const addTask = async () => {
    if (!newTask.title.trim()) return;
    const result = await createTaskAction({
      cardId: card.id,
      title: newTask.title,
      dueDate: newTask.dueDate || null,
      assigneeId: newTask.assigneeId || null,
    });
    if (!result.ok) {
      toast(result.error, "error");
      if (result.blocked) {
        // US-32: o campo pendente recebe foco e destaque.
        setHighlightDue(true);
        taskDueRef.current?.focus();
        setTimeout(() => setHighlightDue(false), 3000);
      }
      return;
    }
    setNewTask({ title: "", dueDate: "", assigneeId: "" });
    startTransition(() => router.refresh());
  };

  const moveTask = async (index: number, dir: -1 | 1) => {
    const ids = tasks.map((t) => t.id);
    const target = index + dir;
    if (target < 0 || target >= ids.length) return;
    [ids[index], ids[target]] = [ids[target]!, ids[index]!];
    await reorderTasksAction({ cardId: card.id, orderedIds: ids });
    startTransition(() => router.refresh());
  };

  const doneCount = tasks.filter((t) => t.done).length;
  const progress = tasks.length > 0 ? Math.round((doneCount / tasks.length) * 100) : 0;
  const isOpp = card.type === "opportunity";

  return (
    <div className="mx-auto w-full max-w-3xl rounded-2xl bg-white shadow-2xl">
      <div className="flex items-start justify-between gap-4 border-b border-slate-100 p-6 pb-4">
        <div className="min-w-0 flex-1">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
            {isOpp ? "Oportunidade" : "Projeto"} · {card.listName}
          </p>
          <input
            defaultValue={card.title}
            aria-label="Título"
            onBlur={(e) => {
              if (e.target.value !== card.title) void save({ title: e.target.value });
            }}
            className="mt-1 w-full rounded-md border border-transparent px-1 py-0.5 text-xl font-bold hover:border-slate-200 focus:border-indigo-500 focus:outline-none"
          />
        </div>
        <Link
          href={`/board/${card.boardKey}`}
          aria-label="Fechar"
          className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
        >
          ✕
        </Link>
      </div>

      <div className="grid gap-6 p-6 md:grid-cols-[1fr_240px]">
        <div className="space-y-6">
          {/* Rastreabilidade venda ⇄ projeto (US-22) */}
          {card.source ? (
            <Link
              href={`/board/${card.source.boardKey}/card/${card.source.id}`}
              className="block rounded-xl border border-indigo-200 bg-indigo-50 px-4 py-3 text-sm text-indigo-800 hover:bg-indigo-100"
            >
              ⚡ Origem: venda <strong>{card.source.title}</strong> — clique para abrir a negociação
            </Link>
          ) : null}
          {card.spawned ? (
            <Link
              href={`/board/${card.spawned.boardKey}/card/${card.spawned.id}`}
              className="block rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800 hover:bg-emerald-100"
            >
              🚀 Projeto gerado: <strong>{card.spawned.title}</strong> — acompanhar a execução
            </Link>
          ) : null}

          {/* Dados do cliente (US-12/US-17) */}
          <section className="rounded-xl border border-slate-200 p-4">
            <h3 className="text-sm font-semibold text-slate-700">Cliente</h3>
            <div className="mt-2 grid gap-3 sm:grid-cols-2">
              <label className="text-xs font-medium text-slate-500">
                Nome
                <input
                  defaultValue={card.clientName ?? ""}
                  onBlur={(e) => {
                    if (e.target.value !== (card.clientName ?? ""))
                      void save({ clientName: e.target.value || null });
                  }}
                  className="mt-1 w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm text-slate-900 focus:border-indigo-500 focus:outline-none"
                />
              </label>
              <label className="text-xs font-medium text-slate-500">
                E-mail
                <input
                  defaultValue={card.clientEmail ?? ""}
                  onBlur={(e) => {
                    if (e.target.value !== (card.clientEmail ?? ""))
                      void save({ clientEmail: e.target.value || null });
                  }}
                  className="mt-1 w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm text-slate-900 focus:border-indigo-500 focus:outline-none"
                />
              </label>
              <label className="text-xs font-medium text-slate-500">
                Telefone
                <input
                  defaultValue={card.clientPhone ?? ""}
                  onBlur={(e) => {
                    if (e.target.value !== (card.clientPhone ?? ""))
                      void save({ clientPhone: e.target.value || null });
                  }}
                  className="mt-1 w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm text-slate-900 focus:border-indigo-500 focus:outline-none"
                />
              </label>
              <label className="text-xs font-medium text-slate-500">
                Valor {isOpp ? "estimado" : "do contrato"} (R$)
                <input
                  defaultValue={card.amount ? Number(card.amount).toLocaleString("pt-BR", { minimumFractionDigits: 2 }) : ""}
                  placeholder="12.500,00"
                  onBlur={(e) => {
                    void save({ amount: e.target.value || null });
                  }}
                  className="mt-1 w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm text-slate-900 focus:border-indigo-500 focus:outline-none"
                />
              </label>
            </div>
          </section>

          <section>
            <h3 className="text-sm font-semibold text-slate-700">Descrição</h3>
            <textarea
              defaultValue={card.description ?? ""}
              rows={3}
              placeholder="Sem descrição — clique para adicionar o contexto do trabalho."
              onBlur={(e) => {
                if (e.target.value !== (card.description ?? ""))
                  void save({ description: e.target.value || null });
              }}
              className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
            />
          </section>

          {card.lossReason ? (
            <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-800">
              <strong>Motivo da perda:</strong> {card.lossReason}
            </p>
          ) : null}

          {/* Checklist de tarefas (US-18/US-19) */}
          <section>
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-slate-700">
                Checklist{" "}
                {tasks.length > 0 ? (
                  <span className="font-normal text-slate-400">
                    {doneCount}/{tasks.length}
                  </span>
                ) : null}
              </h3>
            </div>
            {tasks.length > 0 ? (
              <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-100">
                <div
                  className="h-full rounded-full bg-emerald-500 transition-all"
                  style={{ width: `${progress}%` }}
                />
              </div>
            ) : null}
            <ul className="mt-3 space-y-2">
              {tasks.map((task, i) => {
                const status = dueStatus(task.dueDate, task.done);
                return (
                  <li key={task.id} className="group flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2">
                    <input
                      type="checkbox"
                      checked={task.done}
                      aria-label={`Concluir ${task.title}`}
                      onChange={async (e) => {
                        const result = await toggleTaskAction({ taskId: task.id, done: e.target.checked });
                        if (!result.ok) toast(result.error, "error");
                        startTransition(() => router.refresh());
                      }}
                      className="h-4 w-4 accent-emerald-600"
                    />
                    <input
                      defaultValue={task.title}
                      onBlur={async (e) => {
                        if (e.target.value !== task.title && e.target.value.trim()) {
                          const r = await updateTaskAction({ taskId: task.id, title: e.target.value });
                          if (!r.ok) toast(r.error, "error");
                        }
                      }}
                      className={clsx(
                        "min-w-0 flex-1 rounded border border-transparent px-1 text-sm focus:border-indigo-400 focus:outline-none",
                        task.done && "text-slate-400 line-through"
                      )}
                    />
                    <input
                      type="date"
                      defaultValue={task.dueDate}
                      aria-label="Prazo da tarefa"
                      onChange={async (e) => {
                        if (!e.target.value) return;
                        const r = await updateTaskAction({ taskId: task.id, dueDate: e.target.value });
                        if (!r.ok) toast(r.error, "error");
                        startTransition(() => router.refresh());
                      }}
                      className={clsx(
                        "rounded border border-slate-200 px-1 py-0.5 text-xs",
                        status === "late" && "border-red-300 text-red-600",
                        status === "soon" && "border-amber-300 text-amber-700"
                      )}
                    />
                    <select
                      defaultValue={task.assignee?.id ?? ""}
                      aria-label="Responsável da tarefa"
                      onChange={async (e) => {
                        const r = await updateTaskAction({
                          taskId: task.id,
                          assigneeId: e.target.value || null,
                        });
                        if (!r.ok) toast(r.error, "error");
                      }}
                      className="w-24 truncate rounded border border-slate-200 px-1 py-0.5 text-xs"
                    >
                      <option value="">Ninguém</option>
                      {users.map((u) => (
                        <option key={u.id} value={u.id}>
                          {u.name.split(" ")[0]}
                        </option>
                      ))}
                    </select>
                    <span className="flex opacity-0 transition group-hover:opacity-100">
                      <button type="button" aria-label="Subir" onClick={() => void moveTask(i, -1)} className="px-1 text-slate-400 hover:text-slate-700">↑</button>
                      <button type="button" aria-label="Descer" onClick={() => void moveTask(i, 1)} className="px-1 text-slate-400 hover:text-slate-700">↓</button>
                      <button
                        type="button"
                        aria-label="Remover tarefa"
                        onClick={async () => {
                          const r = await deleteTaskAction({ taskId: task.id });
                          if (!r.ok) toast(r.error, "error");
                          startTransition(() => router.refresh());
                        }}
                        className="px-1 text-slate-400 hover:text-red-600"
                      >
                        ✕
                      </button>
                    </span>
                  </li>
                );
              })}
            </ul>

            <div className="mt-3 flex flex-wrap items-end gap-2 rounded-xl bg-slate-50 p-3">
              <label className="min-w-40 flex-1 text-xs font-medium text-slate-500">
                Nova tarefa
                <input
                  value={newTask.title}
                  onChange={(e) => setNewTask((t) => ({ ...t, title: e.target.value }))}
                  onKeyDown={(e) => e.key === "Enter" && void addTask()}
                  placeholder="O que precisa ser feito?"
                  className="mt-1 w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm text-slate-900 focus:border-indigo-500 focus:outline-none"
                />
              </label>
              <label className="text-xs font-medium text-slate-500">
                Prazo (obrigatório)
                <input
                  ref={taskDueRef}
                  type="date"
                  value={newTask.dueDate}
                  onChange={(e) => setNewTask((t) => ({ ...t, dueDate: e.target.value }))}
                  className={clsx(
                    "mt-1 w-full rounded-md border px-2 py-1.5 text-sm text-slate-900 focus:outline-none",
                    highlightDue
                      ? "border-red-500 ring-2 ring-red-200"
                      : "border-slate-300 focus:border-indigo-500"
                  )}
                />
              </label>
              <label className="text-xs font-medium text-slate-500">
                Responsável
                <select
                  value={newTask.assigneeId}
                  onChange={(e) => setNewTask((t) => ({ ...t, assigneeId: e.target.value }))}
                  className="mt-1 w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm text-slate-900"
                >
                  <option value="">Ninguém</option>
                  {users.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.name}
                    </option>
                  ))}
                </select>
              </label>
              <button
                type="button"
                onClick={() => void addTask()}
                className="rounded-md bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-700"
              >
                Adicionar
              </button>
            </div>
          </section>

          {/* Histórico (US-10) */}
          <section>
            <h3 className="text-sm font-semibold text-slate-700">Histórico</h3>
            <ul className="mt-2 space-y-2">
              {activities.length === 0 ? (
                <li className="text-sm text-slate-400">Nenhuma atividade registrada ainda.</li>
              ) : (
                activities.map((a) => (
                  <li key={a.id} className="flex gap-2 text-sm">
                    <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-slate-300" />
                    <div>
                      <p className="text-slate-700">
                        <strong>
                          {a.automationName ? `Automação: ${a.automationName}` : (a.actorName ?? "Sistema")}
                        </strong>{" "}
                        {ACTION_LABEL[a.action] ?? a.action}
                        <span className="ml-2 text-xs text-slate-400">{relativeTime(a.createdAt)}</span>
                      </p>
                      {a.detail && a.action !== "card.updated" ? (
                        <p className="break-all text-xs text-slate-400">{a.detail}</p>
                      ) : null}
                    </div>
                  </li>
                ))
              )}
            </ul>
          </section>
        </div>

        {/* Coluna lateral */}
        <aside className="space-y-4">
          <label className="block text-xs font-medium text-slate-500">
            Responsável
            <select
              defaultValue={card.assigneeId ?? ""}
              onChange={(e) => void save({ assigneeId: e.target.value || null })}
              className="mt-1 w-full rounded-lg border border-slate-300 px-2 py-2 text-sm text-slate-900"
            >
              <option value="">Sem responsável</option>
              {users.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-xs font-medium text-slate-500">
            Prazo
            <input
              type="date"
              defaultValue={card.dueDate ?? ""}
              lang="pt-BR"
              onChange={(e) => void save({ dueDate: e.target.value || null })}
              className="mt-1 w-full rounded-lg border border-slate-300 px-2 py-2 text-sm text-slate-900"
            />
          </label>
          {card.dueDate ? (
            <p
              className={clsx(
                "rounded-lg px-3 py-2 text-xs font-medium",
                dueStatus(card.dueDate) === "late" && "bg-red-100 text-red-700",
                dueStatus(card.dueDate) === "soon" && "bg-amber-100 text-amber-700",
                dueStatus(card.dueDate) === "ok" && "bg-slate-100 text-slate-600"
              )}
            >
              {dueStatus(card.dueDate) === "late"
                ? `Venceu em ${dateBR(card.dueDate)}`
                : `Vence em ${dateBR(card.dueDate)}`}
            </p>
          ) : null}
          {card.amount ? (
            <p className="rounded-lg bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-700">
              {brl(card.amount)}
            </p>
          ) : null}
        </aside>
      </div>
    </div>
  );
}
