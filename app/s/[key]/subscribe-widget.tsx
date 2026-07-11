"use client";

import { useState, type CSSProperties } from "react";
import type { WidgetConfig } from "@/lib/forms/widget";

// React rendering of the subscribe widget for the hosted /s/<key> page. Mirrors
// the vanilla-JS embed (lib/forms/widget + app/embed) — same fields, honeypot,
// double opt-in POST, and the same layout/theme/corner styling. All the visual
// tokens are per-form data (chosen colors/theme), so they can only be applied as
// inline styles — there are no static classes for a runtime-chosen palette.
export function SubscribeWidget({ config }: { config: WidgetConfig }) {
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [honeypot, setHoneypot] = useState("");
  const [state, setState] = useState<"idle" | "working" | "done" | "error">(
    "idle",
  );
  const [error, setError] = useState("");

  const { colors, radius, layout } = config;
  const inline = layout === "inline";

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

  const inputStyle: CSSProperties = {
    height: 44,
    padding: "0 12px",
    fontSize: 14,
    width: "100%",
    boxSizing: "border-box",
    borderRadius: radius,
    border: `1px solid ${colors.inputBorder}`,
    background: colors.inputBg,
    color: colors.text,
    outline: "none",
  };

  const buttonStyle: CSSProperties = {
    height: 44,
    padding: inline ? "0 18px" : undefined,
    borderRadius: radius,
    border: 0,
    background: config.accentColor,
    color: "#ffffff",
    fontSize: 14,
    fontWeight: 600,
    cursor: "pointer",
    whiteSpace: "nowrap",
    opacity: state === "working" ? 0.6 : 1,
  };

  // The outer box: a bordered, padded card — or bare for minimal/inline.
  const rootStyle: CSSProperties =
    layout === "card"
      ? {
          maxWidth: 440,
          padding: 24,
          borderRadius: 16,
          border: `1px solid ${colors.border}`,
          background: colors.bg,
          color: colors.text,
        }
      : { maxWidth: 460, color: colors.text };

  if (state === "done") {
    return (
      <div style={rootStyle}>
        <div className="text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-emerald-500/15 text-2xl text-emerald-500">
            ✓
          </div>
          <p className="text-lg font-semibold">Check your inbox</p>
          <p className="mt-2 text-sm" style={{ color: colors.muted }}>
            {config.successMessage}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div style={rootStyle}>
      <h1 className="text-xl font-semibold">{config.headline}</h1>
      {config.description && (
        <p className="mt-1 text-sm leading-relaxed" style={{ color: colors.muted }}>
          {config.description}
        </p>
      )}

      <form
        onSubmit={submit}
        className="mt-5 flex flex-col gap-2.5"
      >
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
            style={inputStyle}
          />
        )}

        {/* Inline layout puts the email + button on one row; otherwise stacked. */}
        <div className={inline ? "flex gap-2" : "flex flex-col gap-2.5"}>
          <input
            type="email"
            required
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            style={inline ? { ...inputStyle, flex: 1 } : inputStyle}
          />
          <button type="submit" disabled={state === "working"} style={buttonStyle}>
            {state === "working" ? "Submitting…" : config.buttonLabel}
          </button>
        </div>

        {state === "error" && <p className="text-sm text-red-500">{error}</p>}
      </form>
    </div>
  );
}
