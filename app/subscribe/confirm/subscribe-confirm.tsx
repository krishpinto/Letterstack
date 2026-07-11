"use client";

import { useState } from "react";

// The confirm step of double opt-in. The address is already known (verified
// server-side); this turns the click into a POST that actually adds them to the
// list — a POST, not the page GET, so mail-scanner prefetches never confirm.
export function SubscribeConfirm({
  token,
  email,
  headline,
}: {
  token: string;
  email: string;
  headline: string;
}) {
  const [state, setState] = useState<"idle" | "working" | "done" | "error">(
    "idle",
  );

  async function confirm() {
    setState("working");
    try {
      const res = await fetch(
        `/api/public/subscribe/confirm?t=${encodeURIComponent(token)}`,
        { method: "POST" },
      );
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
        <h1 className="text-lg font-semibold text-zinc-900">
          You&apos;re subscribed!
        </h1>
        <p className="mt-2 text-sm text-zinc-500">
          <span className="font-medium text-zinc-700">{email}</span> is confirmed
          for {headline}. You can close this tab.
        </p>
      </>
    );
  }

  return (
    <>
      <h1 className="text-lg font-semibold text-zinc-900">
        Confirm your subscription
      </h1>
      <p className="mt-2 text-sm text-zinc-500">
        Confirm <span className="font-medium text-zinc-700">{email}</span> to
        start receiving {headline}.
      </p>
      {state === "error" && (
        <p className="mt-3 text-sm text-red-600">
          Something went wrong. Please try again.
        </p>
      )}
      <button
        onClick={confirm}
        disabled={state === "working"}
        className="mt-5 h-10 w-full rounded-lg bg-zinc-900 text-sm font-semibold text-white hover:bg-zinc-800 disabled:opacity-50"
      >
        {state === "working" ? "Confirming…" : "Confirm subscription"}
      </button>
    </>
  );
}
