import Link from "next/link";
import { requireSession } from "@/lib/auth";
import { logoutAction } from "@/app/actions/auth";
import { NotificationsBell } from "@/components/notifications-bell";
import { ToastProvider } from "@/components/toast";
import { initials } from "@/lib/format";

const NAV = [
  { href: "/board/sales", label: "Pipeline de Vendas" },
  { href: "/board/projects", label: "Pipeline de Projetos" },
  { href: "/automations", label: "Automações" },
  { href: "/compliance", label: "Compliance" },
];

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await requireSession();

  return (
    <ToastProvider>
      <div className="flex min-h-screen flex-col">
        <header className="sticky top-0 z-40 border-b border-slate-200 bg-white">
          <div className="mx-auto flex h-14 max-w-[1400px] items-center gap-4 px-4">
            <Link href="/" className="shrink-0 text-lg font-bold text-indigo-700">
              Polímatas <span className="font-normal text-slate-500">Flow</span>
            </Link>
            <nav className="hidden items-center gap-1 md:flex">
              {NAV.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="rounded-lg px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                >
                  {item.label}
                </Link>
              ))}
            </nav>
            <div className="ml-auto flex items-center gap-2">
              <NotificationsBell />
              <div
                title={`${session.name} (${session.role})`}
                className="flex h-8 w-8 items-center justify-center rounded-full bg-indigo-600 text-xs font-bold text-white"
              >
                {initials(session.name)}
              </div>
              <form action={logoutAction}>
                <button
                  type="submit"
                  className="rounded-lg px-2 py-1.5 text-sm text-slate-500 hover:bg-slate-100"
                >
                  Sair
                </button>
              </form>
            </div>
          </div>
          <nav className="flex gap-1 overflow-x-auto border-t border-slate-100 px-2 py-1 md:hidden">
            {NAV.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="whitespace-nowrap rounded-lg px-3 py-1.5 text-sm font-medium text-slate-600"
              >
                {item.label}
              </Link>
            ))}
          </nav>
        </header>
        <main className="flex-1">{children}</main>
      </div>
    </ToastProvider>
  );
}
