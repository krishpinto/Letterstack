"use client";

import { useEffect, useState } from "react";
import { CircleAlertIcon, CircleCheckIcon, InfoIcon, XIcon } from "lucide-react";

import { cn } from "@/lib/utils";

// App-wide toasts. <Toaster /> mounts once in Providers (next to
// AppDialogs); `toast.success(...)` / `toast.error(...)` can then be called
// from any client code, including right before a router.push.
//
// Errors stay up longer and can be dismissed by hand, because they usually
// carry the one sentence that says what to do next ("Verify your email to
// send", "Monthly limit reached").

type ToastKind = "success" | "error" | "info";

type ToastItem = {
  id: number;
  kind: ToastKind;
  message: string;
  description?: string;
};

type ToastOptions = { description?: string; durationMs?: number };

const DEFAULT_DURATION: Record<ToastKind, number> = {
  success: 3000,
  info: 4000,
  error: 7000,
};
const MAX_VISIBLE = 3;

let items: ToastItem[] = [];
let nextId = 1;
const listeners = new Set<(next: ToastItem[]) => void>();

function emit() {
  for (const listener of listeners) listener(items);
}

function dismiss(id: number) {
  items = items.filter((item) => item.id !== id);
  emit();
}

function push(kind: ToastKind, message: string, options: ToastOptions = {}) {
  const id = nextId++;
  items = [...items, { id, kind, message, description: options.description }].slice(
    -MAX_VISIBLE,
  );
  emit();
  setTimeout(() => dismiss(id), options.durationMs ?? DEFAULT_DURATION[kind]);
  return id;
}

export const toast = {
  success: (message: string, options?: ToastOptions) => push("success", message, options),
  error: (message: string, options?: ToastOptions) => push("error", message, options),
  info: (message: string, options?: ToastOptions) => push("info", message, options),
  dismiss,
};

const ICONS = {
  success: CircleCheckIcon,
  error: CircleAlertIcon,
  info: InfoIcon,
} as const;

export function Toaster() {
  const [visible, setVisible] = useState<ToastItem[]>(items);

  useEffect(() => {
    listeners.add(setVisible);
    setVisible(items);
    return () => {
      listeners.delete(setVisible);
    };
  }, []);

  if (visible.length === 0) return null;

  return (
    <div
      className="pointer-events-none fixed inset-x-0 bottom-4 z-[70] flex flex-col items-center gap-2 px-4 sm:bottom-6"
      aria-live="polite"
      role="region"
      aria-label="Notifications"
    >
      {visible.map((item) => {
        const Icon = ICONS[item.kind];
        return (
          <div
            key={item.id}
            role={item.kind === "error" ? "alert" : "status"}
            className="pointer-events-auto flex w-full max-w-md items-start gap-3 rounded-lg border border-border bg-popover px-4 py-3 text-sm text-popover-foreground shadow-lg animate-in fade-in slide-in-from-bottom-2"
          >
            <Icon
              className={cn(
                "mt-0.5 size-4 shrink-0",
                item.kind === "success" && "text-emerald-600 dark:text-emerald-400",
                item.kind === "error" && "text-destructive",
                item.kind === "info" && "text-muted-foreground",
              )}
              aria-hidden
            />
            <div className="min-w-0 flex-1">
              <p className="font-medium break-words">{item.message}</p>
              {item.description && (
                <p className="mt-0.5 break-words text-muted-foreground">
                  {item.description}
                </p>
              )}
            </div>
            <button
              type="button"
              onClick={() => dismiss(item.id)}
              aria-label="Dismiss notification"
              className="-mr-1 flex size-6 shrink-0 cursor-pointer items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              <XIcon className="size-3.5" />
            </button>
          </div>
        );
      })}
    </div>
  );
}
