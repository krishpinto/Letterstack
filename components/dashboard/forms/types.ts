// Shape of a signup form as the dashboard sees it (JSON from /api/forms — dates
// arrive as strings). Kept in one place so the page, card, and settings dialog
// agree without importing server-only db types.
export type SignupFormRow = {
  id: string;
  publicKey: string;
  name: string;
  headline: string;
  description: string;
  buttonLabel: string;
  successMessage: string;
  accentColor: string;
  collectName: boolean;
  subscriberCount: number;
  createdAt: string;
};

/** The editable subset sent on create/update. */
export type SignupFormSettingsInput = {
  name: string;
  headline: string;
  description: string;
  buttonLabel: string;
  successMessage: string;
  accentColor: string;
  collectName: boolean;
};

export const DEFAULT_FORM_SETTINGS: SignupFormSettingsInput = {
  name: "",
  headline: "Subscribe to our newsletter",
  description: "Get our latest updates straight to your inbox.",
  buttonLabel: "Subscribe",
  successMessage:
    "Almost there — check your inbox to confirm your subscription.",
  accentColor: "#4f46e5",
  collectName: false,
};
