import type {
  FormCornerStyle,
  FormLayout,
  FormTheme,
  FormType,
} from "@/db/signup-forms";

// Shape of a signup form as the dashboard sees it (JSON from /api/forms — dates
// arrive as strings). Kept in one place so the page, card, and settings dialog
// agree without importing server-only db types.
export type SignupFormRow = {
  id: string;
  publicKey: string;
  name: string;
  formType: FormType;
  headline: string;
  description: string;
  buttonLabel: string;
  successMessage: string;
  accentColor: string;
  collectName: boolean;
  layout: FormLayout;
  theme: FormTheme;
  cornerStyle: FormCornerStyle;
  subscriberCount: number;
  createdAt: string;
};

/** The editable subset sent on create/update. */
export type SignupFormSettingsInput = {
  name: string;
  formType: FormType;
  headline: string;
  description: string;
  buttonLabel: string;
  successMessage: string;
  accentColor: string;
  collectName: boolean;
  layout: FormLayout;
  theme: FormTheme;
  cornerStyle: FormCornerStyle;
};

export const DEFAULT_FORM_SETTINGS: SignupFormSettingsInput = {
  name: "",
  formType: "static",
  headline: "Subscribe to our newsletter",
  description: "Get our latest updates straight to your inbox.",
  buttonLabel: "Subscribe",
  successMessage: "You're subscribed — thanks for joining!",
  accentColor: "#4f46e5",
  collectName: false,
  layout: "card",
  theme: "light",
  cornerStyle: "rounded",
};
