"use client";

import { useEffect, useState } from "react";
import { THEME_STORAGE_KEY, type Theme } from "@/lib/theme";

/**
 * Alterna entre o tema escuro (o da marca) e o claro. A escolha fica no
 * navegador de quem usa: é preferência de exibição, não dado do sistema.
 * O tema já foi aplicado no <html> antes da primeira pintura; aqui só lemos
 * o que está valendo para desenhar o botão certo.
 */
export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme | null>(null);

  useEffect(() => {
    const current = document.documentElement.getAttribute("data-theme");
    setTheme(current === "light" ? "light" : "dark");
  }, []);

  const toggle = () => {
    const next: Theme = theme === "light" ? "dark" : "light";
    document.documentElement.setAttribute("data-theme", next);
    setTheme(next);
    try {
      localStorage.setItem(THEME_STORAGE_KEY, next);
    } catch {
      /* sem armazenamento: vale só nesta página */
    }
  };

  // Antes do efeito não sabemos o tema; o espaço fica reservado para o
  // cabeçalho não "pular" quando o botão aparece.
  if (theme === null) return <span className="h-8 w-8" aria-hidden />;

  const toLight = theme === "dark";
  const label = toLight ? "Mudar para o tema claro" : "Mudar para o tema escuro";

  return (
    <button
      type="button"
      onClick={toggle}
      title={label}
      aria-label={label}
      className="flex h-8 w-8 items-center justify-center rounded-lg text-fg-3 transition hover:bg-tint/10 hover:text-fg"
    >
      <svg
        width="18"
        height="18"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden
      >
        {toLight ? (
          <>
            <circle cx="12" cy="12" r="4.2" />
            <path d="M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.2 5.2l1.4 1.4M17.4 17.4l1.4 1.4M18.8 5.2l-1.4 1.4M6.6 17.4l-1.4 1.4" />
          </>
        ) : (
          <path d="M20 14.5A8.2 8.2 0 0 1 9.5 4 8.3 8.3 0 1 0 20 14.5z" />
        )}
      </svg>
    </button>
  );
}
