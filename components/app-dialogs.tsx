"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogPanel,
  DialogPopup,
  DialogTitle,
} from "@/components/ui/coss-dialog";
import { Input } from "@/components/ui/input";

// Themed, promise-based replacements for window.confirm / alert / prompt.
// <AppDialogs /> mounts once in Providers; the exported functions can then be
// awaited from anywhere in the client tree:
//
//   if (!(await confirmDialog({ title: "Delete template?" }))) return;
//   await alertDialog({ title: "Save failed", description: message });
//   const url = await promptDialog({ title: "Enter URL" }); // null = cancelled

type ConfirmOptions = {
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  /** Styles the confirm button as destructive (deletes, removals). */
  destructive?: boolean;
};

type AlertOptions = {
  title: string;
  description?: string;
  closeLabel?: string;
};

type PromptOptions = {
  title: string;
  description?: string;
  defaultValue?: string;
  placeholder?: string;
  confirmLabel?: string;
  cancelLabel?: string;
};

type DialogRequest =
  | { kind: "confirm"; options: ConfirmOptions; resolve: (ok: boolean) => void }
  | { kind: "alert"; options: AlertOptions; resolve: () => void }
  | { kind: "prompt"; options: PromptOptions; resolve: (value: string | null) => void };

let enqueue: ((request: DialogRequest) => void) | null = null;
const pendingBeforeMount: DialogRequest[] = [];

function submit(request: DialogRequest) {
  if (enqueue) enqueue(request);
  else pendingBeforeMount.push(request);
}

export function confirmDialog(options: ConfirmOptions): Promise<boolean> {
  return new Promise((resolve) => submit({ kind: "confirm", options, resolve }));
}

export function alertDialog(options: AlertOptions): Promise<void> {
  return new Promise((resolve) => submit({ kind: "alert", options, resolve }));
}

export function promptDialog(options: PromptOptions): Promise<string | null> {
  return new Promise((resolve) => submit({ kind: "prompt", options, resolve }));
}

export function AppDialogs() {
  const [queue, setQueue] = useState<DialogRequest[]>([]);
  const [promptValue, setPromptValue] = useState("");
  const active = queue[0] ?? null;
  // The active request is resolved exactly once, on close.
  const resolvedRef = useRef(false);

  useEffect(() => {
    enqueue = (request) => setQueue((q) => [...q, request]);
    if (pendingBeforeMount.length > 0) {
      const flush = pendingBeforeMount.splice(0);
      setQueue((q) => [...q, ...flush]);
    }
    return () => {
      enqueue = null;
    };
  }, []);

  useEffect(() => {
    resolvedRef.current = false;
    if (active?.kind === "prompt") {
      setPromptValue(active.options.defaultValue ?? "");
    }
  }, [active]);

  const finish = useCallback(
    (result: boolean | string | null) => {
      if (!active || resolvedRef.current) return;
      resolvedRef.current = true;
      if (active.kind === "confirm") active.resolve(Boolean(result));
      else if (active.kind === "alert") active.resolve();
      else active.resolve(typeof result === "string" ? result : null);
      setQueue((q) => q.slice(1));
    },
    [active],
  );

  if (!active) return null;

  if (active.kind === "prompt") {
    const o = active.options;
    return (
      <Dialog open onOpenChange={(open) => !open && finish(null)}>
        <DialogPopup className="sm:max-w-md" showCloseButton={false}>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              finish(promptValue);
            }}
            className="flex min-h-0 flex-col"
          >
            <DialogHeader>
              <DialogTitle>{o.title}</DialogTitle>
              {o.description && (
                <DialogDescription>{o.description}</DialogDescription>
              )}
            </DialogHeader>
            <DialogPanel>
              <Input
                autoFocus
                value={promptValue}
                placeholder={o.placeholder}
                onChange={(e) => setPromptValue(e.target.value)}
              />
            </DialogPanel>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => finish(null)}>
                {o.cancelLabel ?? "Cancel"}
              </Button>
              <Button type="submit">{o.confirmLabel ?? "OK"}</Button>
            </DialogFooter>
          </form>
        </DialogPopup>
      </Dialog>
    );
  }

  const isConfirm = active.kind === "confirm";
  const o = active.options;

  return (
    <Dialog open onOpenChange={(open) => !open && finish(false)}>
      <DialogPopup className="sm:max-w-md" showCloseButton={false}>
        <DialogHeader>
          <DialogTitle>{o.title}</DialogTitle>
          {o.description && (
            <DialogDescription className="break-words">
              {o.description}
            </DialogDescription>
          )}
        </DialogHeader>
        <DialogFooter>
          {isConfirm && (
            <Button variant="outline" onClick={() => finish(false)}>
              {(o as ConfirmOptions).cancelLabel ?? "Cancel"}
            </Button>
          )}
          <Button
            variant={
              isConfirm && (o as ConfirmOptions).destructive
                ? "destructive"
                : "default"
            }
            onClick={() => finish(true)}
          >
            {isConfirm
              ? ((o as ConfirmOptions).confirmLabel ?? "Continue")
              : ((o as AlertOptions).closeLabel ?? "OK")}
          </Button>
        </DialogFooter>
      </DialogPopup>
    </Dialog>
  );
}
