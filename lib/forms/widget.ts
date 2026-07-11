import type { SignupForm } from "@/db/signup-forms";
import { appBaseUrl } from "@/lib/send/qstash";

/**
 * The public shape of a signup form — everything the rendered widget needs and
 * nothing private (no ids, org, or user). Shared by the React hosted page and
 * the vanilla-JS embed script so the two renderings stay in step.
 */
export type WidgetConfig = {
  key: string;
  headline: string;
  description: string;
  buttonLabel: string;
  successMessage: string;
  accentColor: string;
  collectName: boolean;
  /** Absolute URL of the subscribe endpoint (embeds run cross-origin). */
  apiUrl: string;
};

/** A safe hex accent, falling back to the default if the stored value is junk. */
export function safeAccent(value: string): string {
  return /^#[0-9a-fA-F]{6}$/.test(value) ? value : "#4f46e5";
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
    apiUrl: `${appBaseUrl()}/api/public/subscribe`,
  };
}
