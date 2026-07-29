// The `/` command palette.
//
// The important property: most of these are **local**. Applying a theme preset
// is a deterministic mutation of document.settings, so it needs no model call —
// which means zero tokens and zero requests against the daily free-tier
// ceiling. On a free plan every command that avoids the model is capacity
// handed back to the requests that genuinely need judgement.
//
// Commands that do need judgement are marked `usesAi` and become a prompt, so
// the panel can show which is which rather than silently spending quota.

import themePresetsJson from "@/lib/email/theme-presets.json";
import type { EmailDocument, EmailDocumentSettings } from "@/lib/email/document";
import { touchDocument } from "@/lib/email/document";

type ThemePreset = {
  id: string;
  name: string;
  description: string;
  settings: Partial<EmailDocumentSettings>;
};

export const THEME_PRESETS = themePresetsJson as unknown as ThemePreset[];

export type AgentCommand = {
  id: string;
  /** Shown in the menu. */
  label: string;
  hint: string;
  /** True when running this costs a model call. */
  usesAi: boolean;
  /** Local mutation. Absent for AI commands. */
  apply?: (document: EmailDocument) => EmailDocument;
  /** Prompt submitted on the user's behalf. Present for AI commands. */
  prompt?: string;
};

function applyTheme(preset: ThemePreset) {
  return (document: EmailDocument): EmailDocument =>
    touchDocument({
      ...document,
      settings: { ...document.settings, ...preset.settings },
    });
}

function applyWidth(width: number) {
  return (document: EmailDocument): EmailDocument =>
    touchDocument({ ...document, settings: { ...document.settings, maxWidth: width } });
}

export const AGENT_COMMANDS: AgentCommand[] = [
  ...THEME_PRESETS.map((preset) => ({
    id: `theme:${preset.id}`,
    label: preset.name,
    hint: preset.description,
    usesAi: false,
    apply: applyTheme(preset),
  })),

  {
    id: "width:480",
    label: "Narrow width",
    hint: "480px — good for text-heavy emails",
    usesAi: false,
    apply: applyWidth(480),
  },
  {
    id: "width:600",
    label: "Standard width",
    hint: "600px — the safe default",
    usesAi: false,
    apply: applyWidth(600),
  },
  {
    id: "width:700",
    label: "Wide width",
    hint: "700px — for image-led layouts",
    usesAi: false,
    apply: applyWidth(700),
  },

  {
    id: "ai:proofread",
    label: "Proofread",
    hint: "Fix spelling and grammar only",
    usesAi: true,
    prompt:
      "Proofread every block. Fix spelling, grammar and punctuation only. Do not reword anything that is already correct, and do not change the design.",
  },
  {
    id: "ai:shorten",
    label: "Shorten everything",
    hint: "Cut roughly a third",
    usesAi: true,
    prompt:
      "Cut the body copy across the email by about a third. Keep every point, keep the voice, and change nothing about the design.",
  },
  {
    id: "ai:subject",
    label: "Write a subject line",
    hint: "Based on the email's content",
    usesAi: true,
    prompt:
      "Read the email and set a subject line and preview text that suit it. Keep the subject under 60 characters.",
  },
];

export function findCommand(id: string): AgentCommand | undefined {
  return AGENT_COMMANDS.find((command) => command.id === id);
}
