import type {
  FormCornerStyle,
  FormLayout,
  FormTheme,
  SignupForm,
} from "@/db/signup-forms";
import { appBaseUrl } from "@/lib/send/qstash";

/**
 * The public shape of a signup form — everything the rendered widget needs and
 * nothing private (no ids, org, or user). Style choices (layout/theme/corner)
 * are resolved here into concrete tokens so the React hosted page and the
 * vanilla-JS embed both consume the same values and stay in step.
 */
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

export type WidgetConfig = {
  key: string;
  headline: string;
  description: string;
  buttonLabel: string;
  successMessage: string;
  accentColor: string;
  collectName: boolean;
  layout: FormLayout;
  /** Resolved corner radius in px for inputs/buttons. */
  radius: number;
  colors: WidgetColors;
  /** Absolute URL of the subscribe endpoint (embeds run cross-origin). */
  apiUrl: string;
};

/** A safe hex accent, falling back to the default if the stored value is junk. */
export function safeAccent(value: string): string {
  return /^#[0-9a-fA-F]{6}$/.test(value) ? value : "#4f46e5";
}

const LIGHT: WidgetColors = {
  bg: "#ffffff",
  text: "#111111",
  muted: "#6b7280",
  border: "#e5e7eb",
  inputBg: "#ffffff",
  inputBorder: "#d1d5db",
  pageBg: "#f4f4f5",
};

const DARK: WidgetColors = {
  bg: "#0f1115",
  text: "#f5f5f5",
  muted: "#9ca3af",
  border: "#26282e",
  inputBg: "#171a20",
  inputBorder: "#33363d",
  pageBg: "#08090c",
};

function colorsForTheme(theme: FormTheme): WidgetColors {
  return theme === "dark" ? DARK : LIGHT;
}

function radiusForCorner(corner: FormCornerStyle): number {
  if (corner === "sharp") return 4;
  if (corner === "pill") return 9999;
  return 10; // rounded
}

function asLayout(value: string): FormLayout {
  return value === "minimal" || value === "inline" ? value : "card";
}

function asTheme(value: string): FormTheme {
  return value === "dark" ? "dark" : "light";
}

function asCorner(value: string): FormCornerStyle {
  return value === "sharp" || value === "pill" ? value : "rounded";
}

export function widgetConfig(form: SignupForm): WidgetConfig {
  return {
    key: form.publicKey,
    headline: form.headline,
    description: form.description,
    buttonLabel: form.buttonLabel,
    successMessage: form.successMessage,
    accentColor: safeAccent(form.accentColor),
    collectName: form.collectName,
    layout: asLayout(form.layout),
    radius: radiusForCorner(asCorner(form.cornerStyle)),
    colors: colorsForTheme(asTheme(form.theme)),
    apiUrl: `${appBaseUrl()}/api/public/subscribe`,
  };
}
