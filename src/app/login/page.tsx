"use client";

import { useFormState, useFormStatus } from "react-dom";
import { loginAction } from "@/app/actions/auth";

const DEMO_USERS = [
  { label: "Admin", email: "admin@polimatas.dev" },
  { label: "Gestor", email: "gestor@polimatas.dev" },
  { label: "Vendas", email: "vendas@polimatas.dev" },
  { label: "Executor", email: "executor@polimatas.dev" },
];

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="w-full rounded-full bg-cyan-500 py-2.5 font-medium text-white transition hover:bg-cyan-400 disabled:opacity-60"
    >
      {pending ? "Entrando…" : "Entrar"}
    </button>
  );
}

export default function LoginPage() {
  const [state, formAction] = useFormState(loginAction, null);

  return (
    <main
      className="flex min-h-screen items-center justify-center p-4"
      style={{ background: "linear-gradient(180deg, #164E63 0%, #155E75 35%, #000000 100%)" }}
    >
      <div className="w-full max-w-md rounded-3xl border border-white/10 bg-[#0b0f19] p-8 shadow-xl">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo.svg" alt="Polímatas" className="h-16 w-auto" />
        <h1 className="mt-4 text-3xl font-light tracking-tight text-white">
          Polímatas <span className="text-cyan-400">Flow</span>
        </h1>
        <p className="mt-1 text-sm text-gray-400">
          Automação aplicada com método: do funil de vendas à entrega do projeto.
        </p>

        <form action={formAction} className="mt-6 space-y-4">
          <label className="block text-sm font-medium">
            E-mail
            <input
              name="email"
              type="email"
              required
              autoComplete="email"
              defaultValue="admin@polimatas.dev"
              className="mt-1 w-full rounded-lg border border-white/15 px-3 py-2 focus:border-cyan-400 focus:outline-none"
            />
          </label>
          <label className="block text-sm font-medium">
            Senha
            <input
              name="password"
              type="password"
              required
              autoComplete="current-password"
              defaultValue="polimatas123"
              className="mt-1 w-full rounded-lg border border-white/15 px-3 py-2 focus:border-cyan-400 focus:outline-none"
            />
          </label>
          {state?.error ? (
            <p role="alert" className="rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-300">
              {state.error}
            </p>
          ) : null}
          <SubmitButton />
        </form>

        <div className="mt-6 rounded-lg bg-[#141413]/5 p-4 text-sm">
          <p className="font-medium text-gray-200">Credenciais de teste (senha: polimatas123)</p>
          <ul className="mt-2 space-y-1 text-gray-400">
            {DEMO_USERS.map((u) => (
              <li key={u.email}>
                <span className="inline-block w-20 font-medium text-gray-300">{u.label}</span>
                {u.email}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </main>
  );
}
