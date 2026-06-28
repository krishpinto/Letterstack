"use client";

import { useState } from "react";

// The confirm step. The address is already known (verified server-side); this
// just turns the click into a POST that suppresses it.
export function UnsubscribeConfirm({ token, email }: { token: string; email: string }) {
  const [state, setState] = useState<"idle" | "working" | "done" | "error">("idle");

  async function confirm() {
    setState("working");
    try {
      const res = await fetch(`/api/unsubscribe?t=${encodeURIComponent(token)}`, {
        method: "POST",
      });
      const data = await res.json();
      setState(data.ok ? "done" : "error");
    } catch {
      setState("error");
    }
  }

  if (state === "done") {
    return (
      <>
        <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-emerald-50 text-2xl text-emerald-600">
          ✓
        </div>
        <h1 className="text-lg font-semibold text-zinc-900">You&apos;re unsubscribed</h1>
        <p className="mt-2 text-sm text-zinc-500">
          <span className="font-medium text-zinc-700">{email}</span> won&apos;t receive any more of
          these emails. You can close this tab.
        </p>
      </>
    );
  }

  return (
    <>
      <h1 className="text-lg font-semibold text-zinc-900">Unsubscribe?</h1>
      <p className="mt-2 text-sm text-zinc-500">
        Stop sending newsletters to{" "}
        <span className="font-medium text-zinc-700">{email}</span>?
      </p>
      {state === "error" && (
        <p className="mt-3 text-sm text-red-600">Something went wrong. Please try again.</p>
      )}
      <button
        onClick={confirm}
        disabled={state === "working"}
        className="mt-5 h-10 w-full rounded-lg bg-zinc-900 text-sm font-semibold text-white hover:bg-zinc-800 disabled:opacity-50"
      >
        {state === "working" ? "Unsubscribing…" : "Unsubscribe me"}
      </button>
    </>
  );
}
