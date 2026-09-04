import "server-only";
import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import bcrypt from "bcryptjs";
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

export type Session = { userId: string; role: Actor["role"]; name: string; email: string };

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

  const session: Session = { userId: user.id, role: user.role, name: user.name, email: user.email };
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

  const session: Session = { userId: user.id, role: user.role, name: user.name, email: user.email };
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

/** Usuário autenticado ou redirect para /login (US-03). */
export async function requireSession(): Promise<Session> {
  const session = await getSession();
  if (!session) redirect("/login");
  return session;
}

export function sessionActor(session: Session): Actor {
  return { id: session.userId, role: session.role };
}
