import Link from "next/link";
import { requireSession } from "@/lib/auth";
import { canManageUsers } from "@/core/permission-store";
import { logoutAction } from "@/app/actions/auth";
import { NotificationsBell } from "@/components/notifications-bell";
import { ThemeToggle } from "@/components/theme-toggle";
import { NavLinks } from "@/components/nav-links";
import { SettingsLink } from "@/components/settings-link";
import { ToastProvider } from "@/components/toast";
import { initials } from "@/lib/format";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await requireSession();
  const manageUsers = await canManageUsers(session.userId);

  return (
    <ToastProvider>
      <div className="flex min-h-screen flex-col">
        <header className="sticky top-0 z-40 border-b border-line/10 bg-bg/80 backdrop-blur-md">
          <div className="mx-auto flex h-14 max-w-[1400px] items-center gap-4 px-4">
            <Link href="/inicio" className="flex shrink-0 items-center gap-2">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/logo.svg" alt="" className="h-7 w-auto" />
              <span className="text-lg font-medium text-fg">
                Polímatas <span className="font-light text-accent">Flow</span>
              </span>
            </Link>
            <nav className="hidden items-center gap-1 md:flex">
              <NavLinks />
            </nav>
            <div className="ml-auto flex items-center gap-2">
              <ThemeToggle />
              {manageUsers && <SettingsLink />}
              <NotificationsBell />
              <div
                title={`${session.name} (${session.role})`}
                className="flex h-8 w-8 items-center justify-center rounded-full bg-accent-solid text-xs font-bold text-accent-fg"
              >
                {initials(session.name)}
              </div>
              <form action={logoutAction}>
                <button
                  type="submit"
                  className="rounded-lg px-2 py-1.5 text-sm text-fg-3 hover:bg-tint/10"
                >
                  Sair
                </button>
              </form>
            </div>
          </div>
          <nav className="flex gap-1 overflow-x-auto border-t border-line/5 px-2 py-1 md:hidden">
            <NavLinks mobile />
          </nav>
        </header>
        <main className="flex-1">{children}</main>
      </div>
    </ToastProvider>
  );
}
