"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { login, logout, signup } from "@/lib/auth";

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
  redirect("/inicio");
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

export async function logoutAction(): Promise<void> {
  logout();
  redirect("/login");
}
