"use client";

import type { CSSProperties } from "react";
import {
  colorsForTheme,
  radiusForCorner,
  safeAccent,
} from "@/lib/forms/style";
import type { SignupFormSettingsInput } from "./types";

// A static, non-interactive rendering of the subscribe widget, driven by the
// same style resolution (lib/forms/style) as the real widget — so what the user
// sees in the gallery/settings preview is what actually ships. Inert: no submit,
// no fetch, pointer-events disabled. Kept compact so it never clips inside a
// preview frame.
export function FormPreview({
  settings,
  className,
}: {
  settings: SignupFormSettingsInput;
  className?: string;
}) {
  const colors = colorsForTheme(settings.theme);
  const radius = radiusForCorner(settings.cornerStyle);
  const accent = safeAccent(settings.accentColor);
  const inline = settings.layout === "inline";

  const field: CSSProperties = {
    height: 30,
    borderRadius: Math.min(radius, 999),
    border: `1px solid ${colors.inputBorder}`,
    background: colors.inputBg,
    color: colors.muted,
    fontSize: 11,
    padding: "0 9px",
    display: "flex",
    alignItems: "center",
    width: "100%",
    boxSizing: "border-box",
  };

  const button: CSSProperties = {
    height: 30,
    borderRadius: Math.min(radius, 999),
    background: accent,
    color: "#fff",
    fontSize: 11,
    fontWeight: 600,
    padding: "0 12px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    whiteSpace: "nowrap",
  };

  const clamp2: CSSProperties = {
    fontSize: 11,
    color: colors.muted,
    marginTop: 3,
    lineHeight: 1.35,
    display: "-webkit-box",
    WebkitLineClamp: 2,
    WebkitBoxOrient: "vertical",
    overflow: "hidden",
  };

  const root: CSSProperties =
    settings.layout === "card"
      ? {
          borderRadius: 12,
          border: `1px solid ${colors.border}`,
          background: colors.bg,
          color: colors.text,
          padding: 14,
          width: "100%",
          maxWidth: 260,
        }
      : { color: colors.text, width: "100%", maxWidth: 280 };

  return (
    <div
      className={className}
      style={{
        backgroundColor: colors.pageBg,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 16,
        pointerEvents: "none",
        userSelect: "none",
      }}
      aria-hidden="true"
    >
      <div style={root}>
        <div
          style={{
            fontSize: 13,
            fontWeight: 700,
            lineHeight: 1.25,
          }}
        >
          {settings.headline}
        </div>
        {settings.description && <div style={clamp2}>{settings.description}</div>}

        <div
          style={{
            marginTop: 10,
            display: "flex",
            flexDirection: "column",
            gap: 7,
          }}
        >
          {settings.collectName && <div style={field}>Your name</div>}
          {inline ? (
            <div style={{ display: "flex", gap: 6 }}>
              <div style={{ ...field, flex: 1 }}>you@example.com</div>
              <div style={button}>{settings.buttonLabel}</div>
            </div>
          ) : (
            <>
              <div style={field}>you@example.com</div>
              <div style={button}>{settings.buttonLabel}</div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
