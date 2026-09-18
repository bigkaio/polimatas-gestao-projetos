"use client";

import { useId, useState } from "react";
import clsx from "clsx";

/**
 * Gráficos do painel, em SVG puro — sem biblioteca externa.
 *
 * Paleta validada nos dois temas com o validador do guia
 * de dataviz: faixa de luminosidade, croma, contraste ≥ 3:1. Séries únicas usam
 * um tom só; as cores de status nunca aparecem sozinhas — sempre com rótulo.
 */
export const VIZ = {
  series: "#0891b2",
  seriesSoft: "#0891b233",
  good: "#059669",
  warn: "#d97706",
  bad: "#e11d48",
} as const;

/** Eixos, halos e rótulos seguem o tema; as cores das séries valem nos dois. */
const AXIS_CLS = "stroke-fg-5";

function Empty({ children }: { children: React.ReactNode }) {
  return <p className="py-6 text-center text-sm text-fg-4">{children}</p>;
}

/** Moldura comum: título, subtítulo e gráfico. */
export function ChartCard({
  title,
  hint,
  children,
}: {
  title: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-line/10 bg-surface p-5">
      <h2 className="text-sm font-semibold text-fg-2">{title}</h2>
      {hint ? <p className="mt-0.5 text-xs text-fg-4">{hint}</p> : null}
      <div className="mt-4">{children}</div>
    </section>
  );
}

/** Número em destaque — quando o dado é um só, gráfico seria enfeite. */
export function StatTile({
  label,
  value,
  hint,
  tone = "neutral",
}: {
  label: string;
  value: string;
  hint?: string;
  tone?: "neutral" | "good" | "warn" | "bad";
}) {
  const color =
    tone === "good"
      ? "text-success"
      : tone === "warn"
        ? "text-warning"
        : tone === "bad"
          ? "text-danger"
          : "text-fg";
  return (
    <div className="rounded-2xl border border-line/10 bg-surface p-4">
      <p className="text-xs font-medium text-fg-3">{label}</p>
      <p className={clsx("mt-1 text-2xl font-light tracking-tight", color)}>{value}</p>
      {hint ? <p className="text-xs text-fg-4">{hint}</p> : null}
    </div>
  );
}

export type BarDatum = { label: string; value: number; display: string; note?: string };

/**
 * Barras horizontais para comparar magnitude entre categorias.
 * Rótulo direto no fim da barra — sem eixo de valores, que aqui só somaria ruído.
 */
export function BarList({ data, empty }: { data: BarDatum[]; empty: string }) {
  const [hover, setHover] = useState<number | null>(null);
  if (data.length === 0) return <Empty>{empty}</Empty>;
  const max = Math.max(...data.map((d) => d.value), 1);

  return (
    <ul className="space-y-2">
      {data.map((d, i) => (
        <li
          key={d.label}
          onMouseEnter={() => setHover(i)}
          onMouseLeave={() => setHover(null)}
          className="grid grid-cols-[minmax(0,7rem)_1fr_auto] items-center gap-3"
        >
          <span className="truncate text-xs text-fg-3" title={d.label}>
            {d.label}
          </span>
          <span className="relative block h-5 rounded bg-tint/[0.04]">
            <span
              className="absolute inset-y-0 left-0 rounded transition-[width]"
              style={{
                width: `${Math.max((d.value / max) * 100, d.value > 0 ? 2 : 0)}%`,
                background: VIZ.series,
                opacity: hover === null || hover === i ? 1 : 0.55,
              }}
            />
            {hover === i && d.note ? (
              <span className="pointer-events-none absolute -top-7 left-2 z-10 whitespace-nowrap rounded-md border border-line/10 bg-field px-2 py-1 text-xs text-fg-2 shadow-lg">
                {d.note}
              </span>
            ) : null}
          </span>
          <span className="tabular-nums text-xs text-fg-2">{d.display}</span>
        </li>
      ))}
    </ul>
  );
}

export type StatusSegment = { label: string; value: number; tone: "good" | "warn" | "bad" };

/**
 * Barra empilhada de status. Cor nunca sozinha: legenda com o valor ao lado de
 * cada marcador, e 2px de respiro entre os segmentos.
 */
export function StatusBar({ segments, empty }: { segments: StatusSegment[]; empty: string }) {
  const total = segments.reduce((a, s) => a + s.value, 0);
  if (total === 0) return <Empty>{empty}</Empty>;
  const color = { good: VIZ.good, warn: VIZ.warn, bad: VIZ.bad };

  return (
    <div>
      <div className="flex h-6 gap-0.5 overflow-hidden rounded-lg">
        {segments
          .filter((s) => s.value > 0)
          .map((s) => (
            <div
              key={s.label}
              title={`${s.label}: ${s.value}`}
              style={{ width: `${(s.value / total) * 100}%`, background: color[s.tone] }}
              className="first:rounded-l-lg last:rounded-r-lg"
            />
          ))}
      </div>
      <ul className="mt-3 flex flex-wrap gap-x-5 gap-y-1">
        {segments.map((s) => (
          <li key={s.label} className="flex items-center gap-1.5 text-xs">
            <span
              aria-hidden
              className="h-2.5 w-2.5 shrink-0 rounded-full"
              style={{ background: color[s.tone] }}
            />
            <span className="text-fg-3">{s.label}</span>
            <strong className="tabular-nums text-fg-2">{s.value}</strong>
            <span className="text-fg-4">({Math.round((s.value / total) * 100)}%)</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export type TrendPoint = { label: string; value: number; display: string };

/** Série temporal: área com linha de 2px, marcadores e leitura ao passar o mouse. */
export function AreaTrend({ points, empty }: { points: TrendPoint[]; empty: string }) {
  const gradId = useId();
  const [hover, setHover] = useState<number | null>(null);
  if (points.length < 2) return <Empty>{empty}</Empty>;

  const W = 560;
  const H = 180;
  const PAD = { top: 12, right: 12, bottom: 26, left: 12 };
  const max = Math.max(...points.map((p) => p.value), 1);
  const innerW = W - PAD.left - PAD.right;
  const innerH = H - PAD.top - PAD.bottom;
  const x = (i: number) => PAD.left + (i * innerW) / (points.length - 1);
  const y = (v: number) => PAD.top + innerH - (v / max) * innerH;

  const line = points.map((p, i) => `${i === 0 ? "M" : "L"}${x(i)},${y(p.value)}`).join(" ");
  const area = `${line} L${x(points.length - 1)},${PAD.top + innerH} L${x(0)},${PAD.top + innerH} Z`;
  const active = hover === null ? points.length - 1 : hover;

  return (
    <div className="relative">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="h-44 w-full"
        role="img"
        aria-label={`Evolução: ${points.map((p) => `${p.label} ${p.display}`).join(", ")}`}
        onMouseLeave={() => setHover(null)}
      >
        <defs>
          <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={VIZ.series} stopOpacity="0.35" />
            <stop offset="100%" stopColor={VIZ.series} stopOpacity="0" />
          </linearGradient>
        </defs>
        <line
          x1={PAD.left}
          y1={PAD.top + innerH}
          x2={W - PAD.right}
          y2={PAD.top + innerH}
          className={AXIS_CLS}
          strokeWidth="1"
        />
        <path d={area} fill={`url(#${gradId})`} />
        <path d={line} fill="none" stroke={VIZ.series} strokeWidth="2" strokeLinejoin="round" />
        {points.map((p, i) => (
          <g key={p.label}>
            <circle
              cx={x(i)}
              cy={y(p.value)}
              r={active === i ? 5 : 3.5}
              fill={VIZ.series}
              className="stroke-surface"
              strokeWidth="2"
            />
            <text x={x(i)} y={H - 8} textAnchor="middle" className="fill-fg-4 text-[10px]">
              {p.label}
            </text>
            {/* alvo de clique maior que o marcador */}
            <rect
              x={x(i) - innerW / (points.length * 2)}
              y={0}
              width={innerW / points.length}
              height={H}
              fill="transparent"
              onMouseEnter={() => setHover(i)}
            />
          </g>
        ))}
        {active !== null ? (
          <line
            x1={x(active)}
            y1={PAD.top}
            x2={x(active)}
            y2={PAD.top + innerH}
            className={AXIS_CLS}
            strokeWidth="1"
            strokeDasharray="3 3"
          />
        ) : null}
      </svg>
      <p className="mt-1 text-center text-xs text-fg-3">
        {points[active]!.label}: <strong className="text-fg-2">{points[active]!.display}</strong>
      </p>
    </div>
  );
}
