import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { THEME_INIT_SCRIPT } from "@/lib/theme";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Polímatas Flow",
  description: "Gestão de vendas e projetos — do funil à entrega, com automações e compliance.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    // O tema vem do navegador (localStorage) e é aplicado antes da pintura:
    // o atributo muda depois do HTML do servidor, e o React avisaria disso.
    <html lang="pt-BR" data-theme="dark" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      <body className={inter.className}>{children}</body>
    </html>
  );
}
