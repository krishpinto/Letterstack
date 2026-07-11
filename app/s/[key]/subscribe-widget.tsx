"use client";

import { useState } from "react";
import type { WidgetConfig } from "@/lib/forms/widget";

// React rendering of the subscribe widget for the hosted /s/<key> page. Mirrors
// the vanilla-JS embed (lib/forms/widget + app/embed) — same fields, honeypot,
// and double opt-in POST — just as a component instead of an injected script.
export function SubscribeWidget({ config }: { config: WidgetConfig }) {
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [honeypot, setHoneypot] = useState("");
  const [state, setState] = useState<"idle" | "working" | "done" | "error">(
    "idle",
  );
  const [error, setError] = useState("");

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (honeypot) return; // honeypot tripped
    setState("working");
    setError("");
    try {
      const res = await fetch(config.apiUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          key: config.key,
          email,
          name: config.collectName ? name : undefined,
        }),
      });
      const data = await res.json();
      if (data.ok) {
        setState("done");
      } else {
        setError(data.error ?? "Something went wrong. Please try again.");
        setState("error");
      }
    } catch {
      setError("Could not reach the server. Please try again.");
      setState("error");
    }
  }

  if (state === "done") {
    return (
      <div className="text-center">
        <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-emerald-50 text-2xl text-emerald-600">
          ✓
        </div>
        <h1 className="text-lg font-semibold text-zinc-900">Check your inbox</h1>
        <p className="mt-2 text-sm text-zinc-500">{config.successMessage}</p>
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-xl font-semibold text-zinc-900">{config.headline}</h1>
      {config.description && (
        <p className="mt-1 text-sm leading-relaxed text-zinc-500">
          {config.description}
        </p>
      )}

      <form onSubmit={submit} className="mt-5 flex flex-col gap-2.5">
        {/* Honeypot — off-screen, only bots fill it. */}
        <input
          type="text"
          name="website"
          tabIndex={-1}
          autoComplete="off"
          aria-hidden="true"
          value={honeypot}
          onChange={(e) => setHoneypot(e.target.value)}
          className="absolute left-[-9999px] h-px w-px opacity-0"
        />

        {config.collectName && (
          <input
            type="text"
            placeholder="Your name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="h-11 rounded-lg border border-zinc-300 px-3 text-sm text-zinc-900 outline-none focus:border-zinc-500"
          />
        )}

        <input
          type="email"
          required
          placeholder="you@example.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="h-11 rounded-lg border border-zinc-300 px-3 text-sm text-zinc-900 outline-none focus:border-zinc-500"
        />

        {state === "error" && (
          <p className="text-sm text-red-600">{error}</p>
        )}

        <button
          type="submit"
          disabled={state === "working"}
          // Accent is per-form user data (a stored hex), not a design token, so
          // it can only be applied inline — there's no static class for it.
          style={{ backgroundColor: config.accentColor }}
          className="h-11 rounded-lg text-sm font-semibold text-white disabled:opacity-60"
        >
          {state === "working" ? "Submitting…" : config.buttonLabel}
        </button>
      </form>
    </div>
  );
}
