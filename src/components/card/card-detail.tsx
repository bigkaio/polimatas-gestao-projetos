"use client";

import Link from "next/link";
import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import clsx from "clsx";
import { deleteCardAction, moveCardAction, updateCardAction } from "@/app/actions/cards";
import {
  createTaskAction,
  deleteTaskAction,
  reorderTasksAction,
  toggleTaskAction,
  updateTaskAction,
} from "@/app/actions/tasks";
import { useToast } from "@/components/toast";
import { brl, dateBR, dueStatus } from "@/lib/format";
import { LEAD_SOURCES, OTHER_LEAD_SOURCE, isKnownLeadSource } from "@/lib/lead-sources";
import { Comments, type CommentDTO } from "./comments";

export type { CommentDTO };

export type ListOptionDTO = {
  id: string;
  name: string;
  stageKey: string;
  semantics: "won" | "lost" | "done" | "late" | null;
};

export type CardFullDTO = {
  id: string;
  boardKey: string;
  listId: string;
  listName: string;
  type: "opportunity" | "project";
  title: string;
  description: string | null;
  assigneeId: string | null;
  dueDate: string | null;
  clientName: string | null;
  clientEmail: string | null;
  clientPhone: string | null;
  leadSource: string | null;
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

export function CardDetail({
  card,
  tasks,
  comments,
  users,
  lists,
  currentUser,
  canMove,
  canComment,
  canDelete,
}: {
  card: CardFullDTO;
  tasks: TaskDTO[];
  comments: CommentDTO[];
  users: { id: string; name: string }[];
  lists: ListOptionDTO[];
  currentUser: { id: string; isAdmin: boolean };
  canMove: boolean;
  canComment: boolean;
  canDelete: boolean;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [, startTransition] = useTransition();
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  // Origem fora da lista sugerida abre o campo livre já preenchido.
  const [otherSource, setOtherSource] = useState(
    card.leadSource !== null && !isKnownLeadSource(card.leadSource)
  );

  const remove = async () => {
    setDeleting(true);
    const result = await deleteCardAction({ cardId: card.id });
    if (!result.ok) {
      setDeleting(false);
      toast(result.error, "error");
      return;
    }
    toast(`"${result.data?.title ?? card.title}" foi excluído.`, "success");
    router.replace(`/board/${card.boardKey}`);
    router.refresh();
  };
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

  /**
   * Troca de lista pelo card (US-08 pelo caminho do detalhe). O compliance
   * continua valendo: mover para Perdido sem motivo, por exemplo, é recusado
   * no servidor — por isso pedimos o motivo antes de tentar.
   */
  const changeList = async (toListId: string) => {
    const target = lists.find((l) => l.id === toListId);
    if (!target || toListId === card.listId) return;

    let lossReason: string | undefined;
    if (target.semantics === "lost" && !card.lossReason) {
      const answer = window.prompt("Qual o motivo da perda?")?.trim();
      if (!answer) return;
      lossReason = answer;
    }
    if (target.semantics === "won") {
      const ok = window.confirm(
        `Fechar a venda "${card.title}"? O sistema cria automaticamente o card no Backlog do Pipeline de Projetos.`,
      );
      if (!ok) return;
    }

    const result = await moveCardAction({ cardId: card.id, toListId, index: 0, lossReason });
    if (!result.ok) {
      toast(result.error, "error");
      return;
    }
    toast(`Card movido para ${target.name}.`, "success");
    startTransition(() => router.refresh());
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
    <div className="mx-auto w-full max-w-3xl rounded-2xl border border-line/10 bg-surface-2 shadow-2xl">
      <div className="flex items-start justify-between gap-4 border-b border-line/5 p-6 pb-4">
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold uppercase tracking-widest text-accent">
            {isOpp ? "Oportunidade" : "Projeto"} · {card.listName}
          </p>
          <input
            defaultValue={card.title}
            aria-label="Título"
            onBlur={(e) => {
              if (e.target.value !== card.title) void save({ title: e.target.value });
            }}
            className="mt-1 w-full rounded-md border border-transparent px-1 py-0.5 text-xl font-bold hover:border-line/10 focus:border-accent focus:outline-none"
          />
        </div>
        <Link
          href={`/board/${card.boardKey}`}
          aria-label="Fechar"
          className="rounded-lg p-2 text-fg-4 hover:bg-tint/10 hover:text-fg-2"
        >
          ✕
        </Link>
      </div>

      <div className="grid gap-6 p-6 md:grid-cols-[minmax(0,1fr)_240px]">
        <div className="min-w-0 space-y-6">
          {/* Rastreabilidade venda ⇄ projeto (US-22) */}
          {card.source ? (
            <Link
              href={`/board/${card.source.boardKey}/card/${card.source.id}`}
              className="block rounded-xl border border-accent/25 bg-accent/10 px-4 py-3 text-sm text-accent hover:bg-accent-solid-hover/15"
            >
              ⚡ Origem: venda <strong>{card.source.title}</strong> — clique para abrir a negociação
            </Link>
          ) : null}
          {card.spawned ? (
            <Link
              href={`/board/${card.spawned.boardKey}/card/${card.spawned.id}`}
              className="block rounded-xl border border-success/30 bg-success/10 px-4 py-3 text-sm text-success hover:bg-success-solid-hover/20"
            >
              🚀 Projeto gerado: <strong>{card.spawned.title}</strong> — acompanhar a execução
            </Link>
          ) : null}

          {/* Dados do cliente (US-12/US-17) */}
          <section className="rounded-xl border border-line/10 p-4">
            <h3 className="text-sm font-semibold text-fg-2">Cliente</h3>
            <div className="mt-2 grid gap-3 sm:grid-cols-2">
              <label className="text-xs font-medium text-fg-3">
                Nome
                <input
                  defaultValue={card.clientName ?? ""}
                  onBlur={(e) => {
                    if (e.target.value !== (card.clientName ?? ""))
                      void save({ clientName: e.target.value || null });
                  }}
                  className="mt-1 w-full rounded-md border border-line/15 px-2 py-1.5 text-sm text-fg focus:border-accent focus:outline-none"
                />
              </label>
              <label className="text-xs font-medium text-fg-3">
                E-mail
                <input
                  defaultValue={card.clientEmail ?? ""}
                  onBlur={(e) => {
                    if (e.target.value !== (card.clientEmail ?? ""))
                      void save({ clientEmail: e.target.value || null });
                  }}
                  className="mt-1 w-full rounded-md border border-line/15 px-2 py-1.5 text-sm text-fg focus:border-accent focus:outline-none"
                />
              </label>
              <label className="text-xs font-medium text-fg-3">
                Telefone
                <input
                  defaultValue={card.clientPhone ?? ""}
                  onBlur={(e) => {
                    if (e.target.value !== (card.clientPhone ?? ""))
                      void save({ clientPhone: e.target.value || null });
                  }}
                  className="mt-1 w-full rounded-md border border-line/15 px-2 py-1.5 text-sm text-fg focus:border-accent focus:outline-none"
                />
              </label>
              {isOpp ? (
                <label className="text-xs font-medium text-fg-3">
                  Origem do lead
                  <div className="mt-1 flex gap-2">
                    <select
                      value={otherSource ? OTHER_LEAD_SOURCE : (card.leadSource ?? "")}
                      onChange={(e) => {
                        if (e.target.value === OTHER_LEAD_SOURCE) {
                          setOtherSource(true);
                          return;
                        }
                        setOtherSource(false);
                        void save({ leadSource: e.target.value || null });
                      }}
                      className="w-full rounded-md border border-line/15 bg-field px-2 py-1.5 text-sm text-fg focus:border-accent focus:outline-none"
                    >
                      <option value="">Não informada</option>
                      {LEAD_SOURCES.map((s) => (
                        <option key={s} value={s}>
                          {s}
                        </option>
                      ))}
                      <option value={OTHER_LEAD_SOURCE}>Outra…</option>
                    </select>
                    {otherSource ? (
                      <input
                        autoFocus={card.leadSource === null || isKnownLeadSource(card.leadSource)}
                        defaultValue={isKnownLeadSource(card.leadSource) ? "" : (card.leadSource ?? "")}
                        placeholder="Qual?"
                        aria-label="Outra origem"
                        onBlur={(e) => {
                          if (e.target.value.trim() !== (card.leadSource ?? ""))
                            void save({ leadSource: e.target.value || null });
                        }}
                        className="w-full rounded-md border border-line/15 px-2 py-1.5 text-sm text-fg focus:border-accent focus:outline-none"
                      />
                    ) : null}
                  </div>
                </label>
              ) : null}
              <label className="text-xs font-medium text-fg-3">
                Valor {isOpp ? "estimado" : "do contrato"} (R$)
                <input
                  defaultValue={
                    card.amount
                      ? Number(card.amount).toLocaleString("pt-BR", { minimumFractionDigits: 2 })
                      : ""
                  }
                  placeholder="12.500,00"
                  onBlur={(e) => {
                    // "12.500,00" → 12500; só salva se o valor mudou de fato
                    const typed = e.target.value.trim().replace(/\./g, "").replace(",", ".");
                    const next = typed === "" ? null : Number(typed);
                    const prev = card.amount === null ? null : Number(card.amount);
                    if (next !== prev) void save({ amount: e.target.value || null });
                  }}
                  className="mt-1 w-full rounded-md border border-line/15 px-2 py-1.5 text-sm text-fg focus:border-accent focus:outline-none"
                />
              </label>
            </div>
          </section>

          <section>
            <h3 className="text-sm font-semibold text-fg-2">Descrição</h3>
            <textarea
              defaultValue={card.description ?? ""}
              rows={3}
              placeholder="Sem descrição — clique para adicionar o contexto do trabalho."
              onBlur={(e) => {
                if (e.target.value !== (card.description ?? ""))
                  void save({ description: e.target.value || null });
              }}
              className="mt-2 w-full rounded-xl border border-line/10 px-3 py-2 text-sm focus:border-accent focus:outline-none"
            />
          </section>

          {card.lossReason ? (
            <p className="rounded-xl bg-danger/10 px-4 py-3 text-sm text-danger">
              <strong>Motivo da perda:</strong> {card.lossReason}
            </p>
          ) : null}

          {/* Checklist de tarefas (US-18/US-19) */}
          <section>
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-fg-2">
                Checklist{" "}
                {tasks.length > 0 ? (
                  <span className="font-normal text-fg-4">
                    {doneCount}/{tasks.length}
                  </span>
                ) : null}
              </h3>
            </div>
            {tasks.length > 0 ? (
              <div className="mt-2 h-2 overflow-hidden rounded-full bg-tint/10">
                <div
                  className="h-full rounded-full bg-success-solid transition-all"
                  style={{ width: `${progress}%` }}
                />
              </div>
            ) : null}
            <ul className="mt-3 space-y-2">
              {tasks.map((task, i) => {
                const status = dueStatus(task.dueDate, task.done);
                return (
                  <li key={task.id} className="group rounded-lg border border-line/10 px-3 py-2">
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={task.done}
                        aria-label={`Concluir ${task.title}`}
                        onChange={async (e) => {
                          const result = await toggleTaskAction({
                            taskId: task.id,
                            done: e.target.checked,
                          });
                          if (!result.ok) toast(result.error, "error");
                          startTransition(() => router.refresh());
                        }}
                        className="h-4 w-4 accent-emerald-600"
                      />
                      <input
                        defaultValue={task.title}
                        onBlur={async (e) => {
                          if (e.target.value !== task.title && e.target.value.trim()) {
                            const r = await updateTaskAction({
                              taskId: task.id,
                              title: e.target.value,
                            });
                            if (!r.ok) toast(r.error, "error");
                          }
                        }}
                        className={clsx(
                          "min-w-0 flex-1 rounded border border-transparent px-1 py-0.5 text-sm hover:border-line/10 focus:border-accent focus:outline-none",
                          task.done && "text-fg-4 line-through",
                        )}
                      />
                      <span className="flex shrink-0 opacity-0 transition group-focus-within:opacity-100 group-hover:opacity-100">
                        <button
                          type="button"
                          aria-label="Subir"
                          onClick={() => void moveTask(i, -1)}
                          className="px-1 text-fg-4 hover:text-fg-2"
                        >
                          ↑
                        </button>
                        <button
                          type="button"
                          aria-label="Descer"
                          onClick={() => void moveTask(i, 1)}
                          className="px-1 text-fg-4 hover:text-fg-2"
                        >
                          ↓
                        </button>
                        <button
                          type="button"
                          aria-label="Remover tarefa"
                          onClick={async () => {
                            const r = await deleteTaskAction({ taskId: task.id });
                            if (!r.ok) toast(r.error, "error");
                            startTransition(() => router.refresh());
                          }}
                          className="px-1 text-fg-4 hover:text-danger"
                        >
                          ✕
                        </button>
                      </span>
                    </div>

                    <div className="mt-1 flex flex-wrap items-center gap-2 pl-6">
                      <input
                        type="date"
                        defaultValue={task.dueDate}
                        aria-label="Prazo da tarefa"
                        onChange={async (e) => {
                          if (!e.target.value) return;
                          const r = await updateTaskAction({
                            taskId: task.id,
                            dueDate: e.target.value,
                          });
                          if (!r.ok) toast(r.error, "error");
                          startTransition(() => router.refresh());
                        }}
                        className={clsx(
                          "shrink-0 rounded border border-line/10 px-1.5 py-1 text-xs",
                          status === "late" && "border-danger/40 text-danger",
                          status === "soon" && "border-warning/40 text-warning",
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
                        className="min-w-0 max-w-[10rem] flex-1 truncate rounded border border-line/10 px-1.5 py-1 text-xs"
                      >
                        <option value="">Ninguém</option>
                        {users.map((u) => (
                          <option key={u.id} value={u.id}>
                            {u.name.split(" ")[0]}
                          </option>
                        ))}
                      </select>
                    </div>
                  </li>
                );
              })}
            </ul>

            <div className="mt-3 flex flex-wrap items-end gap-2 rounded-xl bg-tint/5 p-3">
              <label className="min-w-40 flex-1 text-xs font-medium text-fg-3">
                Nova tarefa
                <input
                  value={newTask.title}
                  onChange={(e) => setNewTask((t) => ({ ...t, title: e.target.value }))}
                  onKeyDown={(e) => e.key === "Enter" && void addTask()}
                  placeholder="O que precisa ser feito?"
                  className="mt-1 w-full rounded-md border border-line/15 px-2 py-1.5 text-sm text-fg focus:border-accent focus:outline-none"
                />
              </label>
              <label className="text-xs font-medium text-fg-3">
                Prazo (obrigatório)
                <input
                  ref={taskDueRef}
                  type="date"
                  value={newTask.dueDate}
                  onChange={(e) => setNewTask((t) => ({ ...t, dueDate: e.target.value }))}
                  className={clsx(
                    "mt-1 w-full rounded-md border px-2 py-1.5 text-sm text-fg focus:outline-none",
                    highlightDue
                      ? "border-danger ring-2 ring-red-500/30"
                      : "border-line/15 focus:border-accent",
                  )}
                />
              </label>
              <label className="text-xs font-medium text-fg-3">
                Responsável
                <select
                  value={newTask.assigneeId}
                  onChange={(e) => setNewTask((t) => ({ ...t, assigneeId: e.target.value }))}
                  className="mt-1 w-full min-w-0 max-w-full truncate rounded-md border border-line/15 px-2 py-1.5 text-sm text-fg"
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
                className="rounded-full bg-accent-solid px-3 py-1.5 text-sm font-medium text-accent-fg hover:bg-accent-solid-hover"
              >
                Adicionar
              </button>
            </div>
          </section>

          <Comments
            cardId={card.id}
            comments={comments}
            currentUser={currentUser}
            canComment={canComment}
          />
        </div>

        {/* Coluna lateral */}
        <aside className="min-w-0 space-y-4">
          <label className="block text-xs font-medium text-fg-3">
            Status
            <select
              value={card.listId}
              disabled={!canMove}
              onChange={(e) => void changeList(e.target.value)}
              title={canMove ? undefined : "Seu papel não move cards neste quadro."}
              className="mt-1 w-full min-w-0 max-w-full truncate rounded-lg border border-line/15 bg-field px-2 py-1.5 text-sm text-fg focus:border-accent focus:outline-none disabled:opacity-40"
            >
              {lists.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-xs font-medium text-fg-3">
            Responsável
            <select
              defaultValue={card.assigneeId ?? ""}
              onChange={(e) => void save({ assigneeId: e.target.value || null })}
              className="mt-1 w-full min-w-0 max-w-full truncate rounded-lg border border-line/15 px-2 py-2 text-sm text-fg"
            >
              <option value="">Sem responsável</option>
              {users.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-xs font-medium text-fg-3">
            Prazo
            <input
              type="date"
              defaultValue={card.dueDate ?? ""}
              lang="pt-BR"
              onChange={(e) => void save({ dueDate: e.target.value || null })}
              className="mt-1 w-full rounded-lg border border-line/15 px-2 py-2 text-sm text-fg"
            />
          </label>
          {card.dueDate ? (
            <p
              className={clsx(
                "rounded-lg px-3 py-2 text-xs font-medium",
                dueStatus(card.dueDate) === "late" && "bg-danger/15 text-danger",
                dueStatus(card.dueDate) === "soon" && "bg-warning/15 text-warning",
                dueStatus(card.dueDate) === "ok" && "bg-tint/10 text-fg-2",
              )}
            >
              {dueStatus(card.dueDate) === "late"
                ? `Venceu em ${dateBR(card.dueDate)}`
                : `Vence em ${dateBR(card.dueDate)}`}
            </p>
          ) : null}
          {card.amount ? (
            <p className="rounded-lg bg-success/10 px-3 py-2 text-sm font-semibold text-success">
              {brl(card.amount)}
            </p>
          ) : null}

          {canDelete ? (
            <div className="border-t border-line/10 pt-4">
              {confirmingDelete ? (
                <div className="space-y-2 rounded-lg border border-danger/30 bg-danger/5 p-3">
                  <p className="text-xs text-danger">
                    Excluir <strong>{card.title}</strong> de vez? Tarefas, comentários e histórico
                    vão junto. Isso não tem volta.
                    {card.spawned ? " O projeto gerado continua existindo." : ""}
                  </p>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      disabled={deleting}
                      onClick={() => void remove()}
                      className="rounded-full bg-danger-solid px-3 py-1.5 text-xs font-semibold text-danger-fg hover:bg-danger-solid-hover disabled:opacity-50"
                    >
                      {deleting ? "Excluindo…" : "Excluir de vez"}
                    </button>
                    <button
                      type="button"
                      disabled={deleting}
                      onClick={() => setConfirmingDelete(false)}
                      className="rounded-full px-3 py-1.5 text-xs text-fg-2 hover:bg-tint/10"
                    >
                      Cancelar
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setConfirmingDelete(true)}
                  className="w-full rounded-lg px-3 py-2 text-left text-xs text-danger hover:bg-danger/10"
                >
                  🗑 Excluir card
                </button>
              )}
            </div>
          ) : null}
        </aside>
      </div>
    </div>
  );
}
