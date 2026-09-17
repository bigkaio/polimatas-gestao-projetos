/**
 * Origens de lead sugeridas na criação da oportunidade. O campo no banco é
 * texto livre: a lista guia o preenchimento (e mantém os relatórios
 * consistentes), mas "Outra" aceita qualquer valor.
 */
export const LEAD_SOURCES = [
  "Indicação",
  "Site",
  "Instagram",
  "LinkedIn",
  "Google",
  "WhatsApp",
  "Evento",
  "Prospecção ativa",
  "Cliente antigo",
] as const;

/** Valor do seletor que libera o campo livre. */
export const OTHER_LEAD_SOURCE = "__outra__";

export function isKnownLeadSource(value: string | null | undefined): boolean {
  return !!value && (LEAD_SOURCES as readonly string[]).includes(value);
}
