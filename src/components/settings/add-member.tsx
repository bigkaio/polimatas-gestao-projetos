"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createMemberAction } from "@/app/actions/settings";
import { ROLE_LABELS } from "@/core/permissions";
import { useToast } from "@/components/toast";

type Role = keyof typeof ROLE_LABELS;
type Created = { name: string; email: string; temporaryPassword: string };

const inputCls =
  "w-full rounded-lg border border-line/15 bg-field px-3 py-2 text-sm text-fg focus:border-accent focus:outline-none";

/**
 * Cadastro de membro pelo admin. Não há e-mail no sistema, então a senha
 * temporária aparece uma única vez aqui para ser repassada; o membro define a
 * própria senha no primeiro acesso.
 */
export function AddMember() {
  const router = useRouter();
  const { toast } = useToast();
  const [pending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: "", email: "", role: "member" as Role, phone: "" });
  const [created, setCreated] = useState<Created | null>(null);
  const [copied, setCopied] = useState(false);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    startTransition(async () => {
      const res = await createMemberAction(form);
      if (!res.ok) return toast(res.error, "error");
      setCreated(res.data ?? null);
      setCopied(false);
      setForm({ name: "", email: "", role: "member", phone: "" });
      setOpen(false);
      router.refresh();
    });
  };

  const copy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
    } catch {
      toast("Não foi possível copiar — selecione o texto e copie manualmente.", "error");
    }
  };

  if (created) {
    const message = `Acesso ao Polímatas Flow\nE-mail: ${created.email}\nSenha temporária: ${created.temporaryPassword}\nNo primeiro acesso você vai definir a sua senha.`;
    return (
      <div className="rounded-2xl border border-success/30 bg-success/5 p-5">
        <p className="font-medium text-success">{created.name} foi cadastrado.</p>
        <p className="mt-1 text-sm text-fg-3">
          Repasse os dados abaixo. <strong className="text-fg-2">A senha temporária não
          aparece de novo</strong> — se fechar sem copiar, será preciso cadastrar outra vez.
        </p>
        <dl className="mt-4 grid gap-2 text-sm sm:grid-cols-[auto_1fr]">
          <dt className="text-fg-4">E-mail</dt>
          <dd className="font-mono text-fg">{created.email}</dd>
          <dt className="text-fg-4">Senha temporária</dt>
          <dd className="select-all font-mono text-lg tracking-wider text-accent">
            {created.temporaryPassword}
          </dd>
        </dl>
        <div className="mt-4 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => copy(message)}
            className="rounded-full bg-accent-solid px-4 py-2 text-sm font-semibold text-accent-fg hover:bg-accent-solid-hover"
          >
            {copied ? "Copiado ✓" : "Copiar mensagem de acesso"}
          </button>
          <button
            type="button"
            onClick={() => setCreated(null)}
            className="rounded-full border border-line/15 px-4 py-2 text-sm text-fg-2 hover:bg-tint/10"
          >
            Concluir
          </button>
        </div>
      </div>
    );
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-full bg-accent-solid px-5 py-2 text-sm font-semibold text-accent-fg transition hover:bg-accent-solid-hover"
      >
        + Adicionar membro
      </button>
    );
  }

  return (
    <form onSubmit={submit} className="rounded-2xl border border-line/10 bg-surface p-5">
      <p className="font-medium text-fg">Novo membro da equipe</p>
      <p className="text-sm text-fg-3">
        O sistema gera uma senha temporária; no primeiro acesso a pessoa define a própria.
      </p>
      <div className="mt-4 grid gap-3 sm:grid-cols-[1fr_1fr_auto_auto]">
        <label className="text-sm text-fg-2">
          Nome
          <input
            required
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            className={`mt-1 ${inputCls}`}
            autoComplete="off"
          />
        </label>
        <label className="text-sm text-fg-2">
          E-mail
          <input
            required
            type="email"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
            className={`mt-1 ${inputCls}`}
            autoComplete="off"
          />
        </label>
        <label className="text-sm text-fg-2">
          Papel
          <select
            value={form.role}
            onChange={(e) => setForm({ ...form, role: e.target.value as Role })}
            className={`mt-1 ${inputCls}`}
          >
            {(Object.keys(ROLE_LABELS) as Role[]).map((r) => (
              <option key={r} value={r}>
                {ROLE_LABELS[r]}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm text-fg-2">
          WhatsApp <span className="text-fg-4">(opcional)</span>
          <input
            value={form.phone}
            onChange={(e) => setForm({ ...form, phone: e.target.value })}
            placeholder="DDD + número"
            inputMode="tel"
            className={`mt-1 ${inputCls}`}
            autoComplete="off"
          />
        </label>
      </div>
      <div className="mt-4 flex gap-2">
        <button
          type="submit"
          disabled={pending}
          className="rounded-full bg-accent-solid px-5 py-2 text-sm font-semibold text-accent-fg hover:bg-accent-solid-hover disabled:opacity-50"
        >
          {pending ? "Cadastrando…" : "Cadastrar"}
        </button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          disabled={pending}
          className="rounded-full border border-line/15 px-5 py-2 text-sm text-fg-2 hover:bg-tint/10"
        >
          Cancelar
        </button>
      </div>
    </form>
  );
}
