"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createCardAction } from "@/app/actions/cards";
import { useToast } from "@/components/toast";

/** Criação inline no rodapé da lista (US-07/US-12). */
export function AddCard({ listId, isOpportunity }: { listId: string; isOpportunity: boolean }) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [client, setClient] = useState("");
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();
  const router = useRouter();

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="w-full rounded-lg px-3 py-2 text-left text-sm text-slate-500 hover:bg-slate-200/70 hover:text-slate-700"
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
    });
    setSaving(false);
    if (!result.ok) {
      toast(result.error, "error");
      return;
    }
    setTitle("");
    setClient("");
    setOpen(false);
    router.refresh();
  };

  return (
    <div className="space-y-2 rounded-lg bg-white p-2 shadow">
      <input
        autoFocus
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && void submit()}
        placeholder={isOpportunity ? "Título da oportunidade" : "Título do card"}
        className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm focus:border-indigo-500 focus:outline-none"
      />
      {isOpportunity ? (
        <input
          value={client}
          onChange={(e) => setClient(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && void submit()}
          placeholder="Nome do cliente (obrigatório)"
          className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm focus:border-indigo-500 focus:outline-none"
        />
      ) : null}
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => void submit()}
          disabled={saving}
          className="rounded-md bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-60"
        >
          {saving ? "Criando…" : "Criar"}
        </button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="rounded-md px-3 py-1.5 text-sm text-slate-500 hover:bg-slate-100"
        >
          Cancelar
        </button>
      </div>
    </div>
  );
}
