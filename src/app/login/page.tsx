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
      className="w-full rounded-lg bg-indigo-600 py-2.5 font-medium text-white transition hover:bg-indigo-700 disabled:opacity-60"
    >
      {pending ? "Entrando…" : "Entrar"}
    </button>
  );
}

export default function LoginPage() {
  const [state, formAction] = useFormState(loginAction, null);

  return (
    <main className="flex min-h-screen items-center justify-center bg-gradient-to-br from-indigo-600 to-violet-700 p-4">
      <div className="w-full max-w-md rounded-2xl bg-white p-8 shadow-xl">
        <h1 className="text-2xl font-bold">Polímatas Flow</h1>
        <p className="mt-1 text-sm text-slate-500">
          Do funil de vendas à entrega do projeto — em dois quadros integrados.
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
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 focus:border-indigo-500 focus:outline-none"
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
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 focus:border-indigo-500 focus:outline-none"
            />
          </label>
          {state?.error ? (
            <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
              {state.error}
            </p>
          ) : null}
          <SubmitButton />
        </form>

        <div className="mt-6 rounded-lg bg-slate-50 p-4 text-sm">
          <p className="font-medium text-slate-700">Credenciais de teste (senha: polimatas123)</p>
          <ul className="mt-2 space-y-1 text-slate-500">
            {DEMO_USERS.map((u) => (
              <li key={u.email}>
                <span className="inline-block w-20 font-medium text-slate-600">{u.label}</span>
                {u.email}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </main>
  );
}
