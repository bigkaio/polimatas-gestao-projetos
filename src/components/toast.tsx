"use client";

import { createContext, useCallback, useContext, useMemo, useState } from "react";
import clsx from "clsx";

type Toast = { id: number; message: string; kind: "error" | "success" | "info" };
type ToastContextType = { toast: (message: string, kind?: Toast["kind"]) => void };

const ToastContext = createContext<ToastContextType>({ toast: () => undefined });

export function useToast() {
  return useContext(ToastContext);
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const toast = useCallback((message: string, kind: Toast["kind"] = "info") => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t, { id, message, kind }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 6000);
  }, []);

  const value = useMemo(() => ({ toast }), [toast]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div aria-live="polite" className="fixed bottom-4 right-4 z-[100] flex w-80 flex-col gap-2">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={clsx(
              "rounded-lg border px-4 py-3 text-sm shadow-lg",
              t.kind === "error" && "border-danger/30 bg-danger/10 text-danger",
              t.kind === "success" && "border-success/30 bg-success/10 text-success",
              t.kind === "info" && "border-line/15 bg-surface-2 text-fg-2"
            )}
          >
            {t.message}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
