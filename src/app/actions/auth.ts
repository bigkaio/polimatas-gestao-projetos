"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { changePassword, getSession, login, logout, signup } from "@/lib/auth";

const loginSchema = z.object({
  email: z.string().email("Informe um e-mail válido."),
  password: z.string().min(1, "Informe a senha."),
});

export async function loginAction(
  _prev: { error: string } | null,
  formData: FormData
): Promise<{ error: string } | null> {
  const parsed = loginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!parsed.success)
    return { error: parsed.error.issues[0]?.message ?? "Dados inválidos." };

  const session = await login(parsed.data.email, parsed.data.password);
  if (!session) return { error: "E-mail ou senha incorretos." };
  redirect(session.mustChangePassword ? "/definir-senha" : "/inicio");
}

const signupSchema = z.object({
  name: z.string().trim().min(1, "Informe seu nome."),
  email: z.string().email("Informe um e-mail válido."),
  password: z.string().min(6, "A senha precisa ter pelo menos 6 caracteres."),
});

export async function signupAction(
  _prev: { error: string } | null,
  formData: FormData
): Promise<{ error: string } | null> {
  // A action pode ser chamada por POST direto, sem passar pela página.
  if (process.env.ALLOW_SELF_SIGNUP !== "true")
    return { error: "O cadastro é feito pelo administrador em Configurações." };
  const parsed = signupSchema.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!parsed.success)
    return { error: parsed.error.issues[0]?.message ?? "Dados inválidos." };

  const result = await signup(parsed.data.name, parsed.data.email, parsed.data.password);
  if ("error" in result) return { error: result.error };
  redirect("/inicio");
}

const setPasswordSchema = z
  .object({
    password: z.string().min(6, "A senha precisa ter pelo menos 6 caracteres."),
    confirm: z.string(),
  })
  .refine((d) => d.password === d.confirm, { message: "As senhas não conferem." });

export async function setPasswordAction(
  _prev: { error: string } | null,
  formData: FormData
): Promise<{ error: string } | null> {
  const session = await getSession();
  if (!session) redirect("/login");
  const parsed = setPasswordSchema.safeParse({
    password: formData.get("password"),
    confirm: formData.get("confirm"),
  });
  if (!parsed.success)
    return { error: parsed.error.issues[0]?.message ?? "Dados inválidos." };

  await changePassword(session.userId, parsed.data.password);
  redirect("/inicio");
}

export async function logoutAction(): Promise<void> {
  logout();
  redirect("/login");
}
