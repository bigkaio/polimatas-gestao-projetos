/** Violação de compliance bloqueante — a mutação NÃO foi persistida. */
export class ComplianceError extends Error {
  readonly status = 422;
  constructor(
    public readonly reasons: { ruleId: string; ruleName: string; message: string }[]
  ) {
    super(reasons.map((r) => r.message).join(" "));
    this.name = "ComplianceError";
  }
}

/** Ação negada pela matriz de permissões (seção 3.1 do backlog). */
export class PermissionError extends Error {
  readonly status = 403;
  constructor(message = "Você não tem permissão para esta ação.") {
    super(message);
    this.name = "PermissionError";
  }
}

export class NotFoundError extends Error {
  readonly status = 404;
  constructor(message = "Registro não encontrado.") {
    super(message);
    this.name = "NotFoundError";
  }
}
