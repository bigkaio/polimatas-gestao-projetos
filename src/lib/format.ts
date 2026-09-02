export function brl(value: string | number | null | undefined): string {
  if (value === null || value === undefined || value === "") return "—";
  return Number(value).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export function dateBR(value: Date | string | null | undefined): string {
  if (!value) return "—";
  const d = typeof value === "string" ? new Date(value) : value;
  return d.toLocaleDateString("pt-BR", { timeZone: "UTC" });
}

export function relativeTime(value: Date | string): string {
  const d = typeof value === "string" ? new Date(value) : value;
  const diff = Date.now() - d.getTime();
  const min = Math.round(diff / 60_000);
  if (min < 1) return "agora";
  if (min < 60) return `há ${min} min`;
  const h = Math.round(min / 60);
  if (h < 24) return `há ${h} h`;
  const days = Math.round(h / 24);
  if (days < 30) return `há ${days} d`;
  return d.toLocaleDateString("pt-BR");
}

/** Situação do prazo (US-06): vencido = vermelho; ≤ 2 dias = âmbar. */
export function dueStatus(due: Date | string | null | undefined, done = false): "ok" | "soon" | "late" | "none" {
  if (!due || done) return due ? "ok" : "none";
  const d = typeof due === "string" ? new Date(due) : due;
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  const diffDays = Math.floor((d.getTime() - today.getTime()) / 86_400_000);
  if (diffDays < 0) return "late";
  if (diffDays <= 2) return "soon";
  return "ok";
}

export function initials(name: string): string {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0] ?? "")
    .join("")
    .toUpperCase();
}
