"use client";

import * as React from "react";
import { cn } from "cn";

type ToastVariant = "success" | "destructive" | "info";

type ToastItem = {
  id: string;
  message: string;
  variant: ToastVariant;
  leaving: boolean;
};

type ToastContextValue = {
  toast: (message: string, variant?: ToastVariant) => void;
};

const ToastContext = React.createContext<ToastContextValue | null>(null);

const VARIANT_ACCENT: Record<ToastVariant, string> = {
  success: "before:bg-primary",
  destructive: "before:bg-destructive",
  info: "before:bg-secondary",
};

const VISIBLE_MS = 3200;
const EXIT_MS = 160;

function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = React.useState<ToastItem[]>([]);

  const toast = React.useCallback((message: string, variant: ToastVariant = "success") => {
    const id =
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random()}`;

    setToasts((prev) => [...prev, { id, message, variant, leaving: false }]);

    setTimeout(() => {
      setToasts((prev) => prev.map((t) => (t.id === id ? { ...t, leaving: true } : t)));
    }, VISIBLE_MS - EXIT_MS);

    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, VISIBLE_MS);
  }, []);

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 bottom-4 z-100 flex flex-col items-center gap-2 px-4">
        {toasts.map((t) => (
          <div
            key={t.id}
            role="status"
            className={cn(
              "pointer-events-auto relative w-full max-w-sm overflow-hidden rounded-2xl border border-[color:var(--glass-border)] bg-[var(--glass-bg-strong)] py-2.5 pr-4 pl-5 text-sm text-foreground shadow-[var(--glass-shadow)] backdrop-blur-[var(--glass-blur)] before:absolute before:inset-y-0 before:left-0 before:w-1",
              t.leaving
                ? "motion-safe:animate-out motion-safe:fade-out motion-safe:duration-150"
                : "motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-2 motion-safe:duration-300 motion-safe:ease-[cubic-bezier(0.16,1,0.3,1)]",
              VARIANT_ACCENT[t.variant]
            )}
          >
            {t.message}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

function useToast() {
  const ctx = React.useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within a ToastProvider");
  return ctx;
}

export { ToastProvider, useToast };
