"use client";

import { useFormState, useFormStatus } from "react-dom";
import { logoutAction, setPasswordAction } from "@/app/actions/auth";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="w-full rounded-full bg-cyan-500 py-2.5 font-medium text-white transition hover:bg-cyan-400 disabled:opacity-60"
    >
      {pending ? "Salvando…" : "Definir senha e entrar"}
    </button>
  );
}

const inputCls =
  "mt-1 w-full rounded-lg border border-white/15 px-3 py-2 focus:border-cyan-400 focus:outline-none";

export function SetPasswordForm({ name }: { name: string }) {
  const [state, formAction] = useFormState(setPasswordAction, null);

  return (
    <main
      className="flex min-h-screen items-center justify-center p-4"
      style={{ background: "linear-gradient(180deg, #164E63 0%, #155E75 35%, #000000 100%)" }}
    >
      <div className="w-full max-w-md rounded-3xl border border-white/10 bg-[#0b0f19] p-8 shadow-xl">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo.svg" alt="Polímatas" className="h-16 w-auto" />
        <h1 className="mt-4 text-3xl font-light tracking-tight text-white">
          Olá, <span className="text-cyan-400">{name}</span>
        </h1>
        <p className="mt-1 text-sm text-gray-400">
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
            <p role="alert" className="rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-300">
              {state.error}
            </p>
          ) : null}
          <SubmitButton />
        </form>

        <form action={logoutAction} className="mt-4 text-center">
          <button type="submit" className="text-sm text-gray-400 hover:text-cyan-400">
            Sair
          </button>
        </form>
      </div>
    </main>
  );
}
