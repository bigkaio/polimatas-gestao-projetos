import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Polímatas Flow",
  description: "Gestão de vendas e projetos — do funil à entrega, com automações e compliance.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
