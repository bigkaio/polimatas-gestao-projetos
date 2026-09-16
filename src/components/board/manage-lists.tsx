"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import clsx from "clsx";
import {
  createListAction,
  deleteListAction,
  reorderListsAction,
  updateListAction,
} from "@/app/actions/lists";
import { LIST_COLORS, LIST_COLOR_KEYS, listColor, type ListColor } from "@/lib/colors";
import type { ListDTO } from "@/lib/dto";
import { useToast } from "@/components/toast";

type Counts = Record<string, number>;

/** Escolha de cor: paleta fixa, para nada sumir no tema escuro. */
function Palette({
  value,
  onPick,
  disabled,
}: {
  value: ListColor;
  onPick: (c: ListColor) => void;
  disabled?: boolean;
}) {
  return (
    <div className="flex flex-wrap gap-1">
      {LIST_COLOR_KEYS.map((c) => (
        <button
          key={c}
          type="button"
          disabled={disabled}
          aria-label={LIST_COLORS[c].label}
          aria-pressed={value === c}
          title={LIST_COLORS[c].label}
          onClick={() => onPick(c)}
          className={clsx(
            "h-6 w-6 rounded-full border-2 transition disabled:opacity-40",
            LIST_COLORS[c].dot,
            value === c ? "border-white" : "border-transparent hover:border-white/40"
          )}
        />
      ))}
    </div>
  );
}

/**
 * Personalização das colunas do quadro (US-16). Colunas com função no fluxo
 * — Fechado, Perdido, Concluído, Atrasados — podem ser renomeadas e
 * recoloridas, mas não excluídas: o motor de automações e o compliance
 * dependem delas.
 */
export function ManageLists({
  boardId,
  lists,
  counts,
}: {
  boardId: string;
  lists: ListDTO[];
  counts: Counts;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [pending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);
  const [novo, setNovo] = useState<{ name: string; color: ListColor }>({
    name: "",
    color: "slate",
  });
  const [confirmDelete, setConfirmDelete] = useState<{ id: string; moveTo: string } | null>(null);

  const run = (fn: () => Promise<{ ok: boolean; error?: string }>, okMsg?: string) =>
    startTransition(async () => {
      const res = await fn();
      if (!res.ok) return toast(res.error ?? "Algo deu errado.", "error");
      if (okMsg) toast(okMsg, "success");
      router.refresh();
    });

  const rename = (list: ListDTO, name: string) => {
    if (name.trim() === list.name || !name.trim()) return;
    run(() => updateListAction({ listId: list.id, name }), "Coluna renomeada.");
  };

  const recolor = (list: ListDTO, color: ListColor) =>
    run(() => updateListAction({ listId: list.id, color }));

  const move = (index: number, dir: -1 | 1) => {
    const ids = lists.map((l) => l.id);
    const target = index + dir;
    if (target < 0 || target >= ids.length) return;
    [ids[index], ids[target]] = [ids[target]!, ids[index]!];
    run(() => reorderListsAction({ boardId, orderedIds: ids }));
  };

  const remove = (list: ListDTO) => {
    const count = counts[list.id] ?? 0;
    if (count === 0) {
      run(() => deleteListAction({ listId: list.id }), "Coluna excluída.");
      return;
    }
    const outros = lists.filter((l) => l.id !== list.id);
    setConfirmDelete({ id: list.id, moveTo: outros[0]?.id ?? "" });
  };

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-full border border-white/15 px-3 py-1.5 text-sm text-gray-300 transition hover:bg-white/10 hover:text-white"
      >
        Personalizar colunas
      </button>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/70 p-4 md:p-8">
      <div className="w-full max-w-2xl rounded-2xl border border-white/10 bg-[#0f1016] p-6 shadow-2xl">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-xl font-light text-white">Colunas do quadro</h2>
            <p className="text-sm text-gray-400">
              Renomeie, recolora, reordene e crie colunas. As de função especial não podem ser
              excluídas.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setOpen(false)}
            aria-label="Fechar"
            className="rounded-lg p-2 text-gray-500 hover:bg-white/10 hover:text-gray-300"
          >
            ✕
          </button>
        </div>

        <ul className="mt-5 space-y-2">
          {lists.map((list, i) => {
            const cor = listColor(list.color, list.semantics);
            const count = counts[list.id] ?? 0;
            const protegida = list.semantics !== null;
            return (
              <li
                key={list.id}
                className="rounded-xl border border-white/10 bg-[#141413] p-3"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <span className={clsx("h-3 w-3 shrink-0 rounded-full", LIST_COLORS[cor].dot)} />
                  <input
                    defaultValue={list.name}
                    disabled={pending}
                    aria-label={`Nome da coluna ${list.name}`}
                    onBlur={(e) => rename(list, e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
                    className="min-w-0 flex-1 rounded-md border border-transparent bg-transparent px-2 py-1 text-sm text-gray-100 hover:border-white/10 focus:border-cyan-400 focus:outline-none"
                  />
                  <span className="shrink-0 text-xs text-gray-500">{count} card(s)</span>
                  <span className="flex shrink-0">
                    <button
                      type="button"
                      aria-label="Mover para a esquerda"
                      onClick={() => move(i, -1)}
                      disabled={pending || i === 0}
                      className="px-1 text-gray-500 hover:text-gray-200 disabled:opacity-30"
                    >
                      ←
                    </button>
                    <button
                      type="button"
                      aria-label="Mover para a direita"
                      onClick={() => move(i, 1)}
                      disabled={pending || i === lists.length - 1}
                      className="px-1 text-gray-500 hover:text-gray-200 disabled:opacity-30"
                    >
                      →
                    </button>
                  </span>
                  <button
                    type="button"
                    disabled={pending || protegida}
                    onClick={() => remove(list)}
                    title={
                      protegida
                        ? "Coluna com função no fluxo — pode ser renomeada, mas não excluída."
                        : undefined
                    }
                    className={clsx(
                      "shrink-0 rounded-lg px-2 py-1 text-sm",
                      protegida
                        ? "cursor-not-allowed text-gray-600"
                        : "text-red-400 hover:bg-red-500/10"
                    )}
                  >
                    Excluir
                  </button>
                </div>

                <div className="mt-2 flex flex-wrap items-center gap-3 pl-5">
                  <Palette value={cor} onPick={(c) => recolor(list, c)} disabled={pending} />
                  {protegida ? (
                    <span className="text-xs text-gray-500">
                      função no fluxo: <strong className="text-gray-400">{list.semantics}</strong>
                    </span>
                  ) : null}
                </div>

                {confirmDelete?.id === list.id ? (
                  <div className="mt-3 rounded-lg border border-amber-400/30 bg-amber-400/5 p-3">
                    <p className="text-sm text-amber-200">
                      Esta coluna tem {count} card(s). Para onde mover antes de excluir?
                    </p>
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      <select
                        value={confirmDelete.moveTo}
                        onChange={(e) =>
                          setConfirmDelete({ id: list.id, moveTo: e.target.value })
                        }
                        className="min-w-0 max-w-[14rem] flex-1 truncate rounded-lg border border-white/15 bg-[#0b0f19] px-2 py-1.5 text-sm text-gray-100"
                      >
                        {lists
                          .filter((l) => l.id !== list.id)
                          .map((l) => (
                            <option key={l.id} value={l.id}>
                              {l.name}
                            </option>
                          ))}
                      </select>
                      <button
                        type="button"
                        disabled={pending || !confirmDelete.moveTo}
                        onClick={() =>
                          run(
                            () =>
                              deleteListAction({
                                listId: list.id,
                                moveToListId: confirmDelete.moveTo,
                              }),
                            "Coluna excluída e cards movidos."
                          )
                        }
                        className="rounded-full bg-red-500 px-4 py-1.5 text-sm font-semibold text-white hover:bg-red-400 disabled:opacity-50"
                      >
                        Mover e excluir
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfirmDelete(null)}
                        className="rounded-full px-3 py-1.5 text-sm text-gray-400 hover:bg-white/10"
                      >
                        Cancelar
                      </button>
                    </div>
                  </div>
                ) : null}
              </li>
            );
          })}
        </ul>

        <div className="mt-5 rounded-xl border border-white/10 bg-[#141413] p-3">
          <p className="text-sm font-medium text-gray-200">Nova coluna</p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <input
              value={novo.name}
              onChange={(e) => setNovo({ ...novo, name: e.target.value })}
              placeholder="Nome da coluna"
              className="min-w-0 flex-1 rounded-lg border border-white/15 bg-[#0b0f19] px-3 py-1.5 text-sm text-gray-100 focus:border-cyan-400 focus:outline-none"
            />
            <Palette value={novo.color} onPick={(c) => setNovo({ ...novo, color: c })} />
            <button
              type="button"
              disabled={pending || !novo.name.trim()}
              onClick={() =>
                run(() => {
                  const p = createListAction({ boardId, name: novo.name, color: novo.color });
                  setNovo({ name: "", color: "slate" });
                  return p;
                }, "Coluna criada.")
              }
              className="rounded-full bg-cyan-500 px-4 py-1.5 text-sm font-semibold text-black hover:bg-cyan-400 disabled:opacity-40"
            >
              Criar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
