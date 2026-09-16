/**
 * Paleta das colunas do quadro. As classes são escritas por extenso de
 * propósito: o Tailwind varre o código em busca de nomes literais e descarta
 * o que for montado em tempo de execução, então `bg-${cor}-500` não existiria
 * no CSS final.
 */
export const LIST_COLORS = {
  slate: { label: "Cinza", dot: "bg-slate-400", bar: "bg-slate-400/60", text: "text-slate-300" },
  cyan: { label: "Ciano", dot: "bg-cyan-400", bar: "bg-cyan-400/60", text: "text-cyan-300" },
  blue: { label: "Azul", dot: "bg-blue-400", bar: "bg-blue-400/60", text: "text-blue-300" },
  violet: { label: "Roxo", dot: "bg-violet-400", bar: "bg-violet-400/60", text: "text-violet-300" },
  emerald: {
    label: "Verde",
    dot: "bg-emerald-400",
    bar: "bg-emerald-400/60",
    text: "text-emerald-300",
  },
  amber: { label: "Âmbar", dot: "bg-amber-400", bar: "bg-amber-400/60", text: "text-amber-300" },
  rose: { label: "Vermelho", dot: "bg-rose-400", bar: "bg-rose-400/60", text: "text-rose-300" },
  pink: { label: "Rosa", dot: "bg-pink-400", bar: "bg-pink-400/60", text: "text-pink-300" },
} as const;

export type ListColor = keyof typeof LIST_COLORS;

export const LIST_COLOR_KEYS = Object.keys(LIST_COLORS) as ListColor[];

export function isListColor(value: string | null | undefined): value is ListColor {
  return !!value && (LIST_COLOR_KEYS as string[]).includes(value);
}

/** Cor padrão quando a coluna não tem escolha própria: segue a semântica. */
export function listColor(
  color: string | null | undefined,
  semantics: string | null | undefined
): ListColor {
  if (isListColor(color)) return color;
  if (semantics === "won" || semantics === "done") return "emerald";
  if (semantics === "lost") return "rose";
  if (semantics === "late") return "amber";
  return "slate";
}
