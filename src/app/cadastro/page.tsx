"use client";

import Link from "next/link";
import { useFormState, useFormStatus } from "react-dom";
import { signupAction } from "@/app/actions/auth";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="w-full rounded-full bg-accent-solid py-2.5 font-medium text-accent-fg transition hover:bg-accent-solid-hover disabled:opacity-60"
    >
      {pending ? "Criando conta…" : "Criar conta"}
    </button>
  );
}

export default function SignupPage() {
  const [state, formAction] = useFormState(signupAction, null);

  return (
    <main
      className="hero-gradient flex min-h-screen items-center justify-center p-4"
    >
      <div className="w-full max-w-md">
        <Link
          href="/"
          className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-fg-3 hover:text-accent"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M15 18l-6-6 6-6" />
          </svg>
          Voltar
        </Link>

        <div className="rounded-3xl border border-line/10 bg-field p-8 shadow-xl">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.svg" alt="Polímatas" className="h-16 w-auto" />
          <h1 className="mt-4 text-3xl font-light tracking-tight text-fg">
            Criar <span className="text-accent">conta</span>
          </h1>
          <p className="mt-1 text-sm text-fg-3">
            Sua conta entra com o papel de executor — o admin ajusta as permissões depois.
          </p>

          <form action={formAction} className="mt-6 space-y-4">
            <label className="block text-sm font-medium">
              Nome
              <input
                name="name"
                type="text"
                required
                autoComplete="name"
                className="mt-1 w-full rounded-lg border border-line/15 px-3 py-2 focus:border-accent focus:outline-none"
              />
            </label>
            <label className="block text-sm font-medium">
              E-mail
              <input
                name="email"
                type="email"
                required
                autoComplete="email"
                className="mt-1 w-full rounded-lg border border-line/15 px-3 py-2 focus:border-accent focus:outline-none"
              />
            </label>
            <label className="block text-sm font-medium">
              Senha
              <input
                name="password"
                type="password"
                required
                minLength={6}
                autoComplete="new-password"
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

          <p className="mt-6 text-center text-sm text-fg-3">
            Já tem uma conta?{" "}
            <Link href="/login" className="font-medium text-accent hover:underline">
              Entrar
            </Link>
          </p>
        </div>
      </div>
    </main>
  );
}
