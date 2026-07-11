// Pure resolution of a form's style choices (layout/theme/corner) into concrete
// visual tokens. No server imports — safe to use from both the server-side
// widget config (lib/forms/widget.ts) and client-side previews (the dashboard
// gallery), so the rendered widget and its preview never drift apart.

import type {
  FormCornerStyle,
  FormLayout,
  FormTheme,
} from "@/db/signup-forms";

export type WidgetColors = {
  bg: string;
  text: string;
  muted: string;
  border: string;
  inputBg: string;
  inputBorder: string;
  /** Backdrop behind the widget on the standalone hosted /s/<key> page. */
  pageBg: string;
};

export const LIGHT: WidgetColors = {
  bg: "#ffffff",
  text: "#111111",
  muted: "#6b7280",
  border: "#e5e7eb",
  inputBg: "#ffffff",
  inputBorder: "#d1d5db",
  pageBg: "#f4f4f5",
};

export const DARK: WidgetColors = {
  bg: "#0f1115",
  text: "#f5f5f5",
  muted: "#9ca3af",
  border: "#26282e",
  inputBg: "#171a20",
  inputBorder: "#33363d",
  pageBg: "#08090c",
};

export function colorsForTheme(theme: FormTheme): WidgetColors {
  return theme === "dark" ? DARK : LIGHT;
}

export function radiusForCorner(corner: FormCornerStyle): number {
  if (corner === "sharp") return 4;
  if (corner === "pill") return 9999;
  return 10; // rounded
}

export function asLayout(value: string): FormLayout {
  return value === "minimal" || value === "inline" ? value : "card";
}

export function asTheme(value: string): FormTheme {
  return value === "dark" ? "dark" : "light";
}

export function asCorner(value: string): FormCornerStyle {
  return value === "sharp" || value === "pill" ? value : "rounded";
}

/** A safe hex accent, falling back to the default if the stored value is junk. */
export function safeAccent(value: string): string {
  return /^#[0-9a-fA-F]{6}$/.test(value) ? value : "#4f46e5";
}
