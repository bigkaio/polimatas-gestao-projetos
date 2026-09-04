"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  markAllNotificationsReadAction,
  markNotificationReadAction,
} from "@/app/actions/notifications";
import { relativeTime } from "@/lib/format";
import { useToast } from "./toast";

type Item = {
  id: string;
  message: string;
  readAt: string | null;
  createdAt: string;
  card: { id: string; title: string; boardKey: string } | null;
};

/**
 * Central de notificações (US-35) com aviso de chegada (US-36, via polling —
 * adaptação documentada no README por não haver Supabase Realtime).
 */
export function NotificationsBell() {
  const [open, setOpen] = useState(false);
  const [unread, setUnread] = useState(0);
  const [items, setItems] = useState<Item[]>([]);
  const prevUnread = useRef<number | null>(null);
  const { toast } = useToast();

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/notifications", { cache: "no-store" });
      if (!res.ok) return;
      const data = (await res.json()) as { unread: number; notifications: Item[] };
      setItems(data.notifications);
      setUnread(data.unread);
      if (prevUnread.current !== null && data.unread > prevUnread.current) {
        const newest = data.notifications.find((n) => !n.readAt);
        if (newest) toast(newest.message, "info");
      }
      prevUnread.current = data.unread;
    } catch {
      /* rede indisponível — tenta no próximo ciclo */
    }
  }, [toast]);

  useEffect(() => {
    void load();
    const interval = setInterval(load, 10_000);
    return () => clearInterval(interval);
  }, [load]);

  return (
    <div className="relative">
      <button
        type="button"
        aria-label={`Notificações${unread ? ` — ${unread} não lida(s)` : ""}`}
        onClick={() => setOpen((o) => !o)}
        className="relative rounded-lg p-2 text-gray-300 hover:bg-white/10"
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M18 8a6 6 0 10-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
          <path d="M13.7 21a2 2 0 01-3.4 0" />
        </svg>
        {unread > 0 ? (
          <span className="absolute -right-0.5 -top-0.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-red-600 px-1 text-[11px] font-bold text-white">
            {unread}
          </span>
        ) : null}
      </button>

      {open ? (
        <div className="absolute right-0 z-50 mt-2 w-96 max-w-[90vw] rounded-xl border border-white/10 bg-[#141420] shadow-xl">
          <div className="flex items-center justify-between border-b border-white/5 px-4 py-3">
            <p className="font-semibold">Notificações</p>
            {unread > 0 ? (
              <button
                type="button"
                className="text-xs font-medium text-cyan-400 hover:underline"
                onClick={async () => {
                  await markAllNotificationsReadAction();
                  await load();
                }}
              >
                Marcar todas como lidas
              </button>
            ) : null}
          </div>
          <ul className="max-h-96 overflow-y-auto">
            {items.length === 0 ? (
              <li className="px-4 py-8 text-center text-sm text-gray-500">
                Nada por aqui — quando uma automação notificar você, aparece nesta lista.
              </li>
            ) : (
              items.map((n) => (
                <li key={n.id} className={n.readAt ? "bg-[#141413]" : "bg-cyan-400/10"}>
                  <Link
                    href={n.card ? `/board/${n.card.boardKey}/card/${n.card.id}` : "#"}
                    onClick={async () => {
                      setOpen(false);
                      if (!n.readAt) await markNotificationReadAction({ id: n.id });
                    }}
                    className="block px-4 py-3 hover:bg-[#141413]/5"
                  >
                    <p className="text-sm text-gray-100">{n.message}</p>
                    <p className="mt-0.5 text-xs text-gray-500">
                      {n.card ? `${n.card.title} · ` : ""}
                      {relativeTime(n.createdAt)}
                    </p>
                  </Link>
                </li>
              ))
            )}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
