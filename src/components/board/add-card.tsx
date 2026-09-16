"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createCardAction } from "@/app/actions/cards";
import { useToast } from "@/components/toast";

const EMPTY = { title: "", client: "", assigneeId: "", dueDate: "", amount: "", description: "" };

const fieldCls =
  "w-full rounded-md border border-white/15 bg-[#0b0f19] px-2 py-1.5 text-sm text-gray-100 focus:border-cyan-400 focus:outline-none";

/**
 * Criação inline no rodapé da lista (US-07/US-12). Abre com o mínimo —
 * título e cliente — e "Mais campos" revela responsável, prazo, valor e
 * descrição, para o card já nascer completo em vez de exigir uma segunda
 * edição.
 */
export function AddCard({
  listId,
  isOpportunity,
  users,
}: {
  listId: string;
  isOpportunity: boolean;
  users: { id: string; name: string }[];
}) {
  const [open, setOpen] = useState(false);
  const [more, setMore] = useState(false);
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);
  const set = (patch: Partial<typeof EMPTY>) => setForm((f) => ({ ...f, ...patch }));
  const { title, client } = form;
  const { toast } = useToast();
  const router = useRouter();

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="w-full rounded-lg px-3 py-2 text-left text-sm text-gray-400 hover:bg-white/10 hover:text-gray-200"
      >
        + Adicionar
      </button>
    );
  }

  const submit = async () => {
    if (!title.trim() || saving) return;
    setSaving(true);
    const result = await createCardAction({
      listId,
      title,
      clientName: isOpportunity ? client : undefined,
      assigneeId: form.assigneeId || null,
      dueDate: form.dueDate || null,
      amount: form.amount || null,
      description: form.description || null,
    });
    setSaving(false);
    if (!result.ok) {
      toast(result.error, "error");
      return;
    }
    setForm(EMPTY);
    setMore(false);
    setOpen(false);
    router.refresh();
  };

  return (
    <div className="space-y-2 rounded-lg border border-white/10 bg-[#1F2937] p-2 shadow">
      <input
        autoFocus
        value={title}
        onChange={(e) => set({ title: e.target.value })}
        onKeyDown={(e) => e.key === "Enter" && void submit()}
        placeholder={isOpportunity ? "Título da oportunidade" : "Título do card"}
        className="w-full rounded-md border border-white/15 px-2 py-1.5 text-sm focus:border-cyan-400 focus:outline-none"
      />
      {isOpportunity ? (
        <input
          value={client}
          onChange={(e) => set({ client: e.target.value })}
          onKeyDown={(e) => e.key === "Enter" && void submit()}
          placeholder="Nome do cliente (obrigatório)"
          className="w-full rounded-md border border-white/15 px-2 py-1.5 text-sm focus:border-cyan-400 focus:outline-none"
        />
      ) : null}
      {more ? (
        <div className="space-y-2 border-t border-white/10 pt-2">
          <select
            value={form.assigneeId}
            onChange={(e) => set({ assigneeId: e.target.value })}
            aria-label="Responsável"
            className={fieldCls}
          >
            <option value="">Sem responsável</option>
            {users.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name}
              </option>
            ))}
          </select>
          <input
            type="date"
            value={form.dueDate}
            onChange={(e) => set({ dueDate: e.target.value })}
            aria-label="Prazo"
            className={fieldCls}
          />
          {isOpportunity ? (
            <input
              value={form.amount}
              onChange={(e) => set({ amount: e.target.value })}
              placeholder="Valor estimado (12.500,00)"
              aria-label="Valor estimado"
              className={fieldCls}
            />
          ) : null}
          <textarea
            rows={2}
            value={form.description}
            onChange={(e) => set({ description: e.target.value })}
            placeholder="Descrição"
            aria-label="Descrição"
            className={fieldCls}
          />
        </div>
      ) : null}

      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => void submit()}
          disabled={saving}
          className="rounded-full bg-cyan-500 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-60"
        >
          {saving ? "Criando…" : "Criar"}
        </button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="rounded-md px-3 py-1.5 text-sm text-gray-400 hover:bg-white/10"
        >
          Cancelar
        </button>
        <button
          type="button"
          onClick={() => setMore((m) => !m)}
          className="ml-auto text-xs text-gray-400 hover:text-cyan-400"
        >
          {more ? "Menos campos" : "Mais campos"}
        </button>
      </div>
    </div>
  );
}
