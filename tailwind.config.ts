import type { Config } from "tailwindcss";

/** Cor semântica vinda de `globals.css`, preservando o modificador de opacidade. */
const token = (name: string) => `rgb(var(--${name}) / <alpha-value>)`;

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  // O tema é escolhido pela pessoa (e lembrado): a variante `dark:` segue o
  // atributo no <html>, não a preferência do sistema.
  darkMode: ["selector", '[data-theme="dark"]'],
  theme: {
    extend: {
      colors: {
        bg: token("bg"),
        surface: token("surface"),
        "surface-2": token("surface-2"),
        field: token("field"),

        fg: {
          DEFAULT: token("fg"),
          2: token("fg-2"),
          3: token("fg-3"),
          4: token("fg-4"),
          5: token("fg-5"),
        },

        /** Bordas e hovers: a mesma tinta, só muda a opacidade. */
        line: token("tint"),
        tint: token("tint"),
        overlay: token("overlay"),

        accent: {
          DEFAULT: token("accent"),
          solid: token("accent-solid"),
          "solid-hover": token("accent-solid-hover"),
          fg: token("accent-fg"),
        },
        success: {
          DEFAULT: token("success"),
          solid: token("success-solid"),
          "solid-hover": token("success-solid-hover"),
          fg: token("success-fg"),
        },
        danger: {
          DEFAULT: token("danger"),
          solid: token("danger-solid"),
          "solid-hover": token("danger-solid-hover"),
          fg: token("danger-fg"),
        },
        warning: token("warning"),
        info: token("info"),
      },
    },
  },
  plugins: [],
};
export default config;
