"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createMemberAction } from "@/app/actions/settings";
import { ROLE_LABELS } from "@/core/permissions";
import { useToast } from "@/components/toast";

type Role = keyof typeof ROLE_LABELS;
type Created = { name: string; email: string; temporaryPassword: string };

const inputCls =
  "w-full rounded-lg border border-white/15 bg-[#0b0f19] px-3 py-2 text-sm text-gray-100 focus:border-cyan-400 focus:outline-none";

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
  const [form, setForm] = useState({ name: "", email: "", role: "member" as Role });
  const [created, setCreated] = useState<Created | null>(null);
  const [copied, setCopied] = useState(false);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    startTransition(async () => {
      const res = await createMemberAction(form);
      if (!res.ok) return toast(res.error, "error");
      setCreated(res.data ?? null);
      setCopied(false);
      setForm({ name: "", email: "", role: "member" });
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
      <div className="rounded-2xl border border-emerald-400/30 bg-emerald-400/5 p-5">
        <p className="font-medium text-emerald-300">{created.name} foi cadastrado.</p>
        <p className="mt-1 text-sm text-gray-400">
          Repasse os dados abaixo. <strong className="text-gray-200">A senha temporária não
          aparece de novo</strong> — se fechar sem copiar, será preciso cadastrar outra vez.
        </p>
        <dl className="mt-4 grid gap-2 text-sm sm:grid-cols-[auto_1fr]">
          <dt className="text-gray-500">E-mail</dt>
          <dd className="font-mono text-gray-100">{created.email}</dd>
          <dt className="text-gray-500">Senha temporária</dt>
          <dd className="select-all font-mono text-lg tracking-wider text-cyan-300">
            {created.temporaryPassword}
          </dd>
        </dl>
        <div className="mt-4 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => copy(message)}
            className="rounded-full bg-cyan-500 px-4 py-2 text-sm font-semibold text-black hover:bg-cyan-400"
          >
            {copied ? "Copiado ✓" : "Copiar mensagem de acesso"}
          </button>
          <button
            type="button"
            onClick={() => setCreated(null)}
            className="rounded-full border border-white/15 px-4 py-2 text-sm text-gray-300 hover:bg-white/10"
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
        className="rounded-full bg-cyan-500 px-5 py-2 text-sm font-semibold text-black transition hover:bg-cyan-400"
      >
        + Adicionar membro
      </button>
    );
  }

  return (
    <form onSubmit={submit} className="rounded-2xl border border-white/10 bg-[#141413] p-5">
      <p className="font-medium text-white">Novo membro da equipe</p>
      <p className="text-sm text-gray-400">
        O sistema gera uma senha temporária; no primeiro acesso a pessoa define a própria.
      </p>
      <div className="mt-4 grid gap-3 sm:grid-cols-[1fr_1fr_auto]">
        <label className="text-sm text-gray-300">
          Nome
          <input
            required
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            className={`mt-1 ${inputCls}`}
            autoComplete="off"
          />
        </label>
        <label className="text-sm text-gray-300">
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
        <label className="text-sm text-gray-300">
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
      </div>
      <div className="mt-4 flex gap-2">
        <button
          type="submit"
          disabled={pending}
          className="rounded-full bg-cyan-500 px-5 py-2 text-sm font-semibold text-black hover:bg-cyan-400 disabled:opacity-50"
        >
          {pending ? "Cadastrando…" : "Cadastrar"}
        </button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          disabled={pending}
          className="rounded-full border border-white/15 px-5 py-2 text-sm text-gray-300 hover:bg-white/10"
        >
          Cancelar
        </button>
      </div>
    </form>
  );
}
