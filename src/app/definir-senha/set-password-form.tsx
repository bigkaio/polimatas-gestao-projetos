"use client";

import { useFormState, useFormStatus } from "react-dom";
import { logoutAction, setPasswordAction } from "@/app/actions/auth";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="w-full rounded-full bg-accent-solid py-2.5 font-medium text-accent-fg transition hover:bg-accent-solid-hover disabled:opacity-60"
    >
      {pending ? "Salvando…" : "Definir senha e entrar"}
    </button>
  );
}

const inputCls =
  "mt-1 w-full rounded-lg border border-line/15 px-3 py-2 focus:border-accent focus:outline-none";

export function SetPasswordForm({ name }: { name: string }) {
  const [state, formAction] = useFormState(setPasswordAction, null);

  return (
    <main
      className="hero-gradient flex min-h-screen items-center justify-center p-4"
    >
      <div className="w-full max-w-md rounded-3xl border border-line/10 bg-field p-8 shadow-xl">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo.svg" alt="Polímatas" className="h-16 w-auto" />
        <h1 className="mt-4 text-3xl font-light tracking-tight text-fg">
          Olá, <span className="text-accent">{name}</span>
        </h1>
        <p className="mt-1 text-sm text-fg-3">
          Você entrou com uma senha temporária criada pelo administrador. Defina a sua senha para
          continuar.
        </p>

        <form action={formAction} className="mt-6 space-y-4">
          <label className="block text-sm font-medium">
            Nova senha
            <input
              name="password"
              type="password"
              required
              minLength={6}
              autoComplete="new-password"
              className={inputCls}
            />
          </label>
          <label className="block text-sm font-medium">
            Confirme a nova senha
            <input
              name="confirm"
              type="password"
              required
              minLength={6}
              autoComplete="new-password"
              className={inputCls}
            />
          </label>
          {state?.error ? (
            <p role="alert" className="rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger">
              {state.error}
            </p>
          ) : null}
          <SubmitButton />
        </form>

        <form action={logoutAction} className="mt-4 text-center">
          <button type="submit" className="text-sm text-fg-3 hover:text-accent">
            Sair
          </button>
        </form>
      </div>
    </main>
  );
}
