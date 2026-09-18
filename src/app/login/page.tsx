"use client";

import Link from "next/link";
import { useFormState, useFormStatus } from "react-dom";
import { loginAction } from "@/app/actions/auth";
import { ThemeToggle } from "@/components/theme-toggle";

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
      className="w-full rounded-full bg-accent-solid py-2.5 font-medium text-accent-fg transition hover:bg-accent-solid-hover disabled:opacity-60"
    >
      {pending ? "Entrando…" : "Entrar"}
    </button>
  );
}

export default function LoginPage() {
  const [state, formAction] = useFormState(loginAction, null);

  return (
    <main className="hero-gradient flex min-h-screen items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="mb-4 flex items-center justify-between">
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-sm font-medium text-fg-3 hover:text-accent"
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M15 18l-6-6 6-6" />
            </svg>
            Voltar
          </Link>
          <ThemeToggle />
        </div>

        <div className="rounded-3xl border border-line/10 bg-field p-8 shadow-xl">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.svg" alt="Polímatas" className="h-16 w-auto" />
          <h1 className="mt-4 text-3xl font-light tracking-tight text-fg">
            Polímatas <span className="text-accent">Flow</span>
          </h1>
          <p className="mt-1 text-sm text-fg-3">
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
                className="mt-1 w-full rounded-lg border border-line/15 px-3 py-2 focus:border-accent focus:outline-none"
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
                className="mt-1 w-full rounded-lg border border-line/15 px-3 py-2 focus:border-accent focus:outline-none"
              />
            </label>
            {state?.error ? (
              <p role="alert" className="rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger">
                {state.error}
              </p>
            ) : null}
            <SubmitButton />
          </form>

          <div className="mt-6 rounded-lg bg-tint/5 p-4 text-sm">
            <p className="font-medium text-fg-2">Credenciais de teste (senha: polimatas123)</p>
            <ul className="mt-2 space-y-1 text-fg-3">
              {DEMO_USERS.map((u) => (
                <li key={u.email}>
                  <span className="inline-block w-20 font-medium text-fg-2">{u.label}</span>
                  {u.email}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </main>
  );
}
