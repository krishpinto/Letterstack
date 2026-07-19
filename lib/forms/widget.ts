import type { FormLayout, FormType, SignupForm } from "@/db/signup-forms";
import { appBaseUrl } from "@/lib/send/qstash";
import {
  asCorner,
  asLayout,
  asTheme,
  colorsForTheme,
  radiusForCorner,
  safeAccent,
  type WidgetColors,
} from "./style";

/**
 * The public shape of a signup form — everything the rendered widget needs and
 * nothing private (no ids, org, or user). Style choices are resolved into
 * concrete tokens (see ./style) so the React hosted page and the vanilla-JS
 * embed both consume the same values and stay in step.
 */
export type { WidgetColors } from "./style";
export { safeAccent } from "./style";

export type WidgetConfig = {
  key: string;
  /** How the form appears on the host site — static, popup, or animated. */
  formType: FormType;
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

export function widgetConfig(form: SignupForm): WidgetConfig {
  return {
    key: form.publicKey,
    formType:
      form.formType === "popup" || form.formType === "animated"
        ? form.formType
        : "static",
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
