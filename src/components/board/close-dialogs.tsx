"use client";

import { useState } from "react";
import type { CardDTO } from "@/lib/dto";
import { brl } from "@/lib/format";

export type PendingMove = {
  kind: "won" | "lost";
  card: CardDTO;
  toListId: string;
  index: number;
};

/** Confirmações de encerramento da venda (US-14). */
export function CloseDialogs({
  pending,
  onCancel,
  onConfirm,
}: {
  pending: PendingMove | null;
  onCancel: () => void;
  onConfirm: (lossReason?: string) => void;
}) {
  const [reason, setReason] = useState("");
  if (!pending) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <div className="w-full max-w-md rounded-2xl border border-white/10 bg-[#141420] p-6 shadow-2xl">
        {pending.kind === "won" ? (
          <>
            <h2 className="text-xl font-light text-white">Fechar a venda “{pending.card.title}”?</h2>
            <p className="mt-2 text-sm text-gray-300">
              Ao confirmar, o sistema cria <strong>automaticamente</strong> um card no Backlog do
              Pipeline de Projetos herdando:
            </p>
            <ul className="mt-3 space-y-1 rounded-lg bg-[#141413]/5 p-3 text-sm text-gray-200">
              <li>👤 Cliente: <strong>{pending.card.clientName ?? "—"}</strong></li>
              <li>💰 Valor: <strong>{brl(pending.card.amount)}</strong></li>
              <li>
                🧑‍💻 Responsável: <strong>{pending.card.assignee?.name ?? "sem responsável"}</strong>
              </li>
            </ul>
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={onCancel}
                className="rounded-full px-4 py-2 text-sm text-gray-300 hover:bg-[#141413]/10"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => onConfirm()}
                className="rounded-full bg-emerald-500 px-4 py-2 text-sm font-semibold text-black hover:bg-emerald-400"
              >
                Fechar venda e criar projeto
              </button>
            </div>
          </>
        ) : (
          <>
            <h2 className="text-xl font-light text-white">Marcar “{pending.card.title}” como perdida</h2>
            <p className="mt-2 text-sm text-gray-300">
              O motivo de perda é obrigatório — é ele que alimenta o aprendizado do funil.
            </p>
            <textarea
              autoFocus
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Ex.: optou pelo concorrente por preço"
              rows={3}
              className="mt-3 w-full rounded-lg border border-white/15 px-3 py-2 text-sm focus:border-cyan-400 focus:outline-none"
            />
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={onCancel}
                className="rounded-full px-4 py-2 text-sm text-gray-300 hover:bg-[#141413]/10"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={!reason.trim()}
                onClick={() => onConfirm(reason.trim())}
                className="rounded-full bg-red-500 px-4 py-2 text-sm font-semibold text-white hover:bg-red-400 disabled:opacity-50"
              >
                Registrar perda
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
