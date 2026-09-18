"use client";

import { useRef, useState } from "react";
import clsx from "clsx";
import {
  TEMPLATE_VARS,
  previewValues,
  renderPreview,
  unknownVars,
  type SampleCard,
} from "@/lib/template-vars";

/**
 * Campo de texto das ações que enviam mensagem. O `{{card.title}}` que aparece
 * aqui é um espaço reservado: some na hora do envio, trocado pelo dado do card.
 * Por isso o campo traz os botões das variáveis, a pré-visualização do
 * resultado e o aviso de variável inexistente — que viraria um buraco no texto.
 */
export function MessageField({
  value,
  onChange,
  placeholder,
  rows = 1,
  sample,
  vars = TEMPLATE_VARS,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  rows?: number;
  sample: SampleCard | null;
  vars?: typeof TEMPLATE_VARS;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);
  const [open, setOpen] = useState(false);

  /** Insere no ponto do cursor (ou no fim, se o campo nunca recebeu foco). */
  const insert = (key: string) => {
    const el = ref.current;
    const token = `{{${key}}}`;
    if (!el) return onChange(`${value}${token}`);
    const start = el.selectionStart ?? value.length;
    const end = el.selectionEnd ?? start;
    onChange(`${value.slice(0, start)}${token}${value.slice(end)}`);
    // devolve o cursor para depois do que foi inserido
    requestAnimationFrame(() => {
      el.focus();
      const pos = start + token.length;
      el.setSelectionRange(pos, pos);
    });
  };

  const desconhecidas = unknownVars(value);
  const preview = renderPreview(value, previewValues(sample));
  const temVariavel = value.includes("{{");

  return (
    <div className="w-full space-y-2">
      <textarea
        ref={ref}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        rows={rows}
        className="w-full rounded-lg border border-line/15 px-2 py-1.5 text-sm focus:border-accent focus:outline-none"
      />

      <div className="flex flex-wrap items-center gap-1">
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          className="rounded-full border border-line/15 px-2 py-0.5 text-xs text-fg-3 hover:bg-tint/10 hover:text-fg-2"
        >
          {open ? "Ocultar variáveis" : "+ Inserir variável"}
        </button>
        {open
          ? vars.map((v) => (
              <button
                key={v.key}
                type="button"
                onClick={() => insert(v.key)}
                title={`{{${v.key}}} → ${v.sample}`}
                className="rounded-full bg-accent/10 px-2 py-0.5 text-xs text-accent hover:bg-accent/20"
              >
                {v.label}
              </button>
            ))
          : null}
      </div>

      {desconhecidas.length > 0 ? (
        <p className="rounded-md bg-warning/10 px-2 py-1 text-xs text-warning">
          {desconhecidas.map((k) => `{{${k}}}`).join(", ")}{" "}
          {desconhecidas.length > 1 ? "não existem" : "não existe"} — vai sair em branco na
          mensagem. Use os botões acima.
        </p>
      ) : null}

      {temVariavel && value.trim() ? (
        <div className="rounded-md border border-line/10 bg-tint/[0.04] px-2 py-1.5">
          <p className="text-[11px] uppercase tracking-wide text-fg-4">
            Como vai sair {sample ? "(com um card real)" : "(exemplo)"}
          </p>
          <p className={clsx("mt-0.5 whitespace-pre-wrap text-xs text-fg-2")}>{preview}</p>
        </div>
      ) : null}
    </div>
  );
}
