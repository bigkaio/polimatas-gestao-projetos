import "server-only";
import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { randomInt } from "node:crypto";
import bcrypt from "bcryptjs";
import type { Profile, Role } from "@prisma/client";
import { prisma } from "./prisma";
import type { Actor } from "@/core/events";

/**
 * Autenticação por e-mail e senha com sessão JWT em cookie httpOnly.
 * Adaptação registrada: a spec pede Supabase Auth; sem projeto Supabase
 * disponível, este módulo isola a troca — só ele conhece o mecanismo.
 * A matriz de papéis (seção 3.1) é aplicada na camada de domínio.
 */

const COOKIE = "polimatas_session";
const secret = () => new TextEncoder().encode(process.env.SESSION_SECRET ?? "dev-secret");

export type Session = {
  userId: string;
  role: Actor["role"];
  name: string;
  email: string;
  /** Conta criada pelo admin: o middleware prende o usuário em /definir-senha. */
  mustChangePassword?: boolean;
};

function sessionOf(user: Profile): Session {
  return {
    userId: user.id,
    role: user.role,
    name: user.name,
    email: user.email,
    mustChangePassword: user.mustChangePassword,
  };
}

async function startSession(session: Session): Promise<void> {
  const token = await new SignJWT(session as unknown as Record<string, unknown>)
    .setProtectedHeader({ alg: "HS256" })
    .setExpirationTime("7d")
    .sign(secret());
  cookies().set(COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 60 * 60 * 24 * 7,
    path: "/",
  });
}

export async function login(email: string, password: string): Promise<Session | null> {
  const user = await prisma.profile.findUnique({ where: { email: email.toLowerCase().trim() } });
  if (!user) return null;
  const ok = await bcrypt.compare(password, user.passwordHash);
  if (!ok) return null;

  const session = sessionOf(user);
  await startSession(session);
  return session;
}

/** Auto-cadastro: papel padrão `member` (US-03), como no primeiro acesso via Supabase Auth. */
export async function signup(
  name: string,
  email: string,
  password: string
): Promise<Session | { error: string }> {
  const normalizedEmail = email.toLowerCase().trim();
  const existing = await prisma.profile.findUnique({ where: { email: normalizedEmail } });
  if (existing) return { error: "Já existe uma conta com este e-mail." };

  const passwordHash = await bcrypt.hash(password, 10);
  const user = await prisma.profile.create({
    data: { name: name.trim(), email: normalizedEmail, passwordHash, role: "member" },
  });

  const session = sessionOf(user);
  await startSession(session);
  return session;
}

// ------------------------------------------------------ cadastro pelo admin

/** Sem 0/O, 1/l/I: a senha é lida em voz alta ou digitada a partir de uma mensagem. */
const TEMP_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";

export function generateTemporaryPassword(length = 12): string {
  let out = "";
  for (let i = 0; i < length; i++) out += TEMP_ALPHABET[randomInt(TEMP_ALPHABET.length)];
  return out;
}

/**
 * Cria a conta de um membro da equipe com senha temporária. Não há envio de
 * e-mail no sistema: a senha volta para quem cadastrou repassar, e o membro é
 * obrigado a trocá-la no primeiro acesso. Não abre sessão — quem está logado
 * é o admin.
 */
export async function createMemberAccount(
  name: string,
  email: string,
  role: Role
): Promise<{ user: Profile; temporaryPassword: string } | { error: string }> {
  const normalizedEmail = email.toLowerCase().trim();
  const existing = await prisma.profile.findUnique({ where: { email: normalizedEmail } });
  if (existing) return { error: "Já existe uma conta com este e-mail." };

  const temporaryPassword = generateTemporaryPassword();
  const user = await prisma.profile.create({
    data: {
      name: name.trim(),
      email: normalizedEmail,
      role,
      passwordHash: await bcrypt.hash(temporaryPassword, 10),
      mustChangePassword: true,
    },
  });
  return { user, temporaryPassword };
}

/** Define a senha definitiva e reabre a sessão já sem a trava de troca. */
export async function changePassword(userId: string, newPassword: string): Promise<Session> {
  const user = await prisma.profile.update({
    where: { id: userId },
    data: { passwordHash: await bcrypt.hash(newPassword, 10), mustChangePassword: false },
  });
  const session = sessionOf(user);
  await startSession(session);
  return session;
}

export function logout(): void {
  cookies().delete(COOKIE);
}

export async function getSession(): Promise<Session | null> {
  const token = cookies().get(COOKIE)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret());
    return payload as unknown as Session;
  } catch {
    return null;
  }
}

/**
 * Usuário autenticado ou redirect para /login (US-03). Quem ainda está com
 * senha temporária vai para /definir-senha — aqui, e não só no middleware,
 * porque uma Server Action pode ser chamada por POST em qualquer caminho.
 */
export async function requireSession(): Promise<Session> {
  const session = await getSession();
  if (!session) redirect("/login");
  if (session.mustChangePassword) redirect("/definir-senha");
  return session;
}

export function sessionActor(session: Session): Actor {
  return { id: session.userId, role: session.role };
}
