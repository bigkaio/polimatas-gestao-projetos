"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import clsx from "clsx";

const NAV = [
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
                ? "bg-indigo-50 text-indigo-700"
                : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
            )}
          >
            {item.label}
          </Link>
        );
      })}
    </>
  );
}
