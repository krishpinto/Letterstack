import {
  DEFAULT_FORM_SETTINGS,
  type SignupFormSettingsInput,
} from "./types";

// Starting points shown in the "New form" gallery. Each is a full settings
// preset (copy + style) the user picks and then tweaks — so "form templates"
// are just named presets, no separate document type. `id: "scratch"` is the
// bare default.
export type FormTemplate = {
  id: string;
  title: string;
  description: string;
  settings: SignupFormSettingsInput;
};

export const FORM_TEMPLATES: FormTemplate[] = [
  {
    id: "scratch",
    title: "Start from scratch",
    description: "A clean boxed form with our defaults.",
    settings: { ...DEFAULT_FORM_SETTINGS, name: "" },
  },
  {
    id: "boxed",
    title: "Boxed card",
    description: "A bordered card that stands on its own anywhere.",
    settings: {
      ...DEFAULT_FORM_SETTINGS,
      name: "Boxed signup",
      layout: "card",
      theme: "light",
      cornerStyle: "rounded",
      accentColor: "#4f46e5",
    },
  },
  {
    id: "minimal",
    title: "Minimal",
    description: "No border or background — blends into your page.",
    settings: {
      ...DEFAULT_FORM_SETTINGS,
      name: "Minimal signup",
      headline: "Join the newsletter",
      description: "One email a month. No spam, unsubscribe anytime.",
      layout: "minimal",
      theme: "light",
      cornerStyle: "rounded",
      accentColor: "#111111",
    },
  },
  {
    id: "inline",
    title: "Inline bar",
    description: "A compact one-line bar for footers and headers.",
    settings: {
      ...DEFAULT_FORM_SETTINGS,
      name: "Footer signup",
      headline: "Stay in the loop",
      description: "",
      buttonLabel: "Join",
      layout: "inline",
      theme: "light",
      cornerStyle: "pill",
      accentColor: "#0f766e",
    },
  },
  {
    id: "dark",
    title: "Dark card",
    description: "A dark-themed card for dark sites and hero sections.",
    settings: {
      ...DEFAULT_FORM_SETTINGS,
      name: "Dark signup",
      layout: "card",
      theme: "dark",
      cornerStyle: "rounded",
      accentColor: "#6366f1",
    },
  },
  {
    id: "bold",
    title: "Bold",
    description: "Sharp corners and a punchy accent for a confident look.",
    settings: {
      ...DEFAULT_FORM_SETTINGS,
      name: "Bold signup",
      headline: "Don't miss a thing",
      layout: "card",
      theme: "light",
      cornerStyle: "sharp",
      accentColor: "#e11d48",
    },
  },
];
