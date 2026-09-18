"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import clsx from "clsx";

const NAV = [
  { href: "/inicio", label: "Visão geral" },
  { href: "/board/sales", label: "Pipeline de Vendas" },
  { href: "/board/projects", label: "Pipeline de Projetos" },
  { href: "/automations", label: "Automações" },
  { href: "/compliance", label: "Compliance" },
];

/** Navegação do cabeçalho com destaque da página atual. */
export function NavLinks({ mobile = false }: { mobile?: boolean }) {
  const pathname = usePathname();

  return (
    <>
      {NAV.map((item) => {
        const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={clsx(
              "rounded-lg px-3 py-1.5 text-sm font-medium transition",
              mobile && "whitespace-nowrap",
              active
                ? "bg-accent/10 text-accent"
                : "text-fg-2 hover:bg-tint/10 hover:text-fg"
            )}
          >
            {item.label}
          </Link>
        );
      })}
    </>
  );
}
