export type Theme = "dark" | "light";

export const THEME_STORAGE_KEY = "polimatas-theme";

/**
 * Roda antes da primeira pintura (no <head>), senão a página apareceria no
 * tema errado por um instante. Sem `localStorage` — janela anônima, dados do
 * site bloqueados — vale a preferência do sistema, e o padrão é o escuro da
 * marca. É injetado como texto, por isso não usa nada do escopo do módulo.
 */
export const THEME_INIT_SCRIPT = `(function(){try{var t=localStorage.getItem("${THEME_STORAGE_KEY}");if(t!=="light"&&t!=="dark"){t=window.matchMedia&&window.matchMedia("(prefers-color-scheme: light)").matches?"light":"dark";}document.documentElement.setAttribute("data-theme",t);}catch(e){document.documentElement.setAttribute("data-theme","dark");}})();`;
