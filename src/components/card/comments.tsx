"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  createCommentAction,
  deleteCommentAction,
  updateCommentAction,
} from "@/app/actions/comments";
import { relativeTime } from "@/lib/format";
import { initials } from "@/lib/format";
import { useToast } from "@/components/toast";

export type CommentDTO = {
  id: string;
  text: string;
  authorId: string;
  authorName: string;
  createdAt: string;
  editedAt: string | null;
};

const boxCls =
  "w-full rounded-lg border border-line/15 bg-field px-3 py-2 text-sm text-fg focus:border-accent focus:outline-none";

/** Comentários do card: escrever, editar e remover os próprios (admin remove qualquer um). */
export function Comments({
  cardId,
  comments,
  currentUser,
  canComment,
}: {
  cardId: string;
  comments: CommentDTO[];
  currentUser: { id: string; isAdmin: boolean };
  canComment: boolean;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [pending, startTransition] = useTransition();
  const [draft, setDraft] = useState("");
  const [editing, setEditing] = useState<{ id: string; text: string } | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  const submit = () => {
    if (!draft.trim()) return;
    startTransition(async () => {
      const res = await createCommentAction({ cardId, text: draft });
      if (!res.ok) return toast(res.error, "error");
      setDraft("");
      router.refresh();
    });
  };

  const saveEdit = () => {
    if (!editing) return;
    startTransition(async () => {
      const res = await updateCommentAction({ commentId: editing.id, text: editing.text });
      if (!res.ok) return toast(res.error, "error");
      setEditing(null);
      router.refresh();
    });
  };

  const remove = (id: string) => {
    startTransition(async () => {
      const res = await deleteCommentAction({ commentId: id });
      if (!res.ok) return toast(res.error, "error");
      setConfirmDelete(null);
      toast("Comentário removido.", "success");
      router.refresh();
    });
  };

  return (
    <section>
      <h3 className="text-sm font-semibold text-fg-2">
        Comentários{" "}
        {comments.length > 0 && <span className="text-fg-4">({comments.length})</span>}
      </h3>

      <ul className="mt-2 space-y-3">
        {comments.length === 0 ? (
          <li className="text-sm text-fg-4">
            Nenhum comentário ainda. Use este espaço para combinar o próximo passo.
          </li>
        ) : (
          comments.map((c) => {
            const mine = c.authorId === currentUser.id;
            return (
              <li key={c.id} className="flex gap-2">
                <span
                  aria-hidden
                  className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-accent-solid text-[11px] font-bold text-accent-fg"
                >
                  {initials(c.authorName)}
                </span>
                <div className="min-w-0 flex-1 rounded-lg border border-line/10 bg-surface px-3 py-2">
                  <p className="text-sm">
                    <strong className="text-fg-2">{c.authorName}</strong>
                    <span className="ml-2 text-xs text-fg-4">
                      {relativeTime(c.createdAt)}
                      {c.editedAt ? " · editado" : ""}
                    </span>
                  </p>

                  {editing?.id === c.id ? (
                    <div className="mt-2">
                      <textarea
                        autoFocus
                        rows={3}
                        value={editing.text}
                        onChange={(e) => setEditing({ id: c.id, text: e.target.value })}
                        className={boxCls}
                      />
                      <div className="mt-2 flex gap-2">
                        <button
                          type="button"
                          onClick={saveEdit}
                          disabled={pending}
                          className="rounded-full bg-accent-solid px-3 py-1 text-xs font-semibold text-accent-fg hover:bg-accent-solid-hover disabled:opacity-50"
                        >
                          Salvar
                        </button>
                        <button
                          type="button"
                          onClick={() => setEditing(null)}
                          className="rounded-full px-3 py-1 text-xs text-fg-3 hover:bg-tint/10"
                        >
                          Cancelar
                        </button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <p className="mt-1 whitespace-pre-wrap break-words text-sm text-fg-2">
                        {c.text}
                      </p>
                      {(mine || currentUser.isAdmin) && (
                        <div className="mt-1 flex gap-3 text-xs">
                          {mine && (
                            <button
                              type="button"
                              onClick={() => setEditing({ id: c.id, text: c.text })}
                              className="text-fg-4 hover:text-accent"
                            >
                              Editar
                            </button>
                          )}
                          {confirmDelete === c.id ? (
                            <>
                              <span className="text-fg-3">Remover?</span>
                              <button
                                type="button"
                                onClick={() => remove(c.id)}
                                disabled={pending}
                                className="font-medium text-danger hover:underline disabled:opacity-50"
                              >
                                Sim
                              </button>
                              <button
                                type="button"
                                onClick={() => setConfirmDelete(null)}
                                className="text-fg-4 hover:text-fg-2"
                              >
                                Não
                              </button>
                            </>
                          ) : (
                            <button
                              type="button"
                              onClick={() => setConfirmDelete(c.id)}
                              className="text-fg-4 hover:text-danger"
                            >
                              {mine ? "Remover" : "Remover (admin)"}
                            </button>
                          )}
                        </div>
                      )}
                    </>
                  )}
                </div>
              </li>
            );
          })
        )}
      </ul>

      {canComment ? (
        <div className="mt-3">
          <textarea
            rows={2}
            value={draft}
            placeholder="Escreva um comentário…  (Ctrl+Enter envia)"
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
                e.preventDefault();
                submit();
              }
            }}
            className={boxCls}
          />
          <button
            type="button"
            onClick={submit}
            disabled={pending || !draft.trim()}
            className="mt-2 rounded-full bg-accent-solid px-4 py-1.5 text-sm font-semibold text-accent-fg hover:bg-accent-solid-hover disabled:opacity-40"
          >
            {pending ? "Enviando…" : "Comentar"}
          </button>
        </div>
      ) : (
        <p className="mt-3 text-xs text-fg-4">Seu papel não pode comentar neste card.</p>
      )}
    </section>
  );
}
