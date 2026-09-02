import { ComplianceError, NotFoundError, PermissionError } from "@/core/errors";

export type ActionResult<T = undefined> =
  | { ok: true; data?: T }
  | { ok: false; error: string; status: number; blocked?: boolean };

/** Converte erros de domínio em resposta amigável (US-32/US-40: linguagem de negócio). */
export function toResult(err: unknown): ActionResult<never> {
  if (err instanceof ComplianceError)
    return { ok: false, error: err.message, status: 422, blocked: true };
  if (err instanceof PermissionError) return { ok: false, error: err.message, status: 403 };
  if (err instanceof NotFoundError) return { ok: false, error: err.message, status: 404 };
  console.error(err);
  return { ok: false, error: "Algo deu errado. Tente novamente.", status: 500 };
}
