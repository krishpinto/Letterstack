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
import type {
  EmailBlock,
  EmailDocument,
  EmailDocumentSettings,
} from "@/lib/email/document";
import { createBlock, insertBlockAtIndex, touchDocument } from "@/lib/email/document";

type ThemePreset = {
  id: string;
  name: string;
  description: string;
  settings: Partial<EmailDocumentSettings>;
};

export const THEME_PRESETS = themePresetsJson as unknown as ThemePreset[];

export type CommandGroup = "Templates" | "Theme" | "Layout" | "Writing";

export type AgentCommand = {
  id: string;
  /** Shown in the menu. */
  label: string;
  hint: string;
  group: CommandGroup;
  /** True when running this costs a model call. */
  usesAi: boolean;
  /** Local mutation. Absent for AI commands. */
  apply?: (document: EmailDocument) => EmailDocument;
  /**
   * Prompt submitted on the user's behalf. Present for AI commands.
   * `{ref}` is replaced with the @-reference for the selected block, or with
   * "the whole email" when nothing is selected — so /rephrase targets what the
   * user is looking at rather than rewriting everything by accident.
   */
  prompt?: string;
};

/** Insert a composite block at the end of the email. */
function insertBlock(type: EmailBlock["type"]) {
  return (document: EmailDocument): EmailDocument =>
    insertBlockAtIndex(document, document.blocks.length, createBlock(type));
}

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
  // ── Templates ──────────────────────────────────────────────────────────────
  // The composites that used to sit in the block palette. Inserted locally, so
  // adding one is instant and costs nothing.
  {
    id: "template:text",
    label: "Text section",
    hint: "Eyebrow, heading and body together",
    group: "Templates",
    usesAi: false,
    apply: insertBlock("text"),
  },
  {
    id: "template:articleCard",
    label: "Article card",
    hint: "Image beside a headline, summary and link",
    group: "Templates",
    usesAi: false,
    apply: insertBlock("articleCard"),
  },
  {
    id: "template:columns",
    label: "Columns",
    hint: "Two side-by-side cells",
    group: "Templates",
    usesAi: false,
    apply: insertBlock("columns"),
  },

  // ── Theme ──────────────────────────────────────────────────────────────────
  ...THEME_PRESETS.map((preset): AgentCommand => ({
    id: `theme:${preset.id}`,
    label: preset.name,
    hint: preset.description,
    group: "Theme",
    usesAi: false,
    apply: applyTheme(preset),
  })),

  // ── Layout ─────────────────────────────────────────────────────────────────
  {
    id: "width:480",
    label: "Narrow width",
    hint: "480px — good for text-heavy emails",
    group: "Layout",
    usesAi: false,
    apply: applyWidth(480),
  },
  {
    id: "width:600",
    label: "Standard width",
    hint: "600px — the safe default",
    group: "Layout",
    usesAi: false,
    apply: applyWidth(600),
  },
  {
    id: "width:700",
    label: "Wide width",
    hint: "700px — for image-led layouts",
    group: "Layout",
    usesAi: false,
    apply: applyWidth(700),
  },

  // ── Writing (these cost a model call) ──────────────────────────────────────
  {
    id: "ai:rephrase",
    label: "Rephrase",
    hint: "Same meaning, fresh wording",
    group: "Writing",
    usesAi: true,
    prompt:
      "Rephrase the copy in {ref}. Keep the meaning and the length roughly the same, and keep the existing voice. Change nothing about the design.",
  },
  {
    id: "ai:shorten",
    label: "Shorten",
    hint: "Cut roughly a third",
    group: "Writing",
    usesAi: true,
    prompt:
      "Cut the body copy in {ref} by about a third. Keep every point, keep the voice, and change nothing about the design.",
  },
  {
    id: "ai:expand",
    label: "Expand",
    hint: "Add supporting detail",
    group: "Writing",
    usesAi: true,
    prompt:
      "Expand the copy in {ref} with concrete supporting detail. Do not pad it with filler, and change nothing about the design.",
  },
  {
    id: "ai:proofread",
    label: "Proofread",
    hint: "Fix spelling and grammar only",
    group: "Writing",
    usesAi: true,
    prompt:
      "Proofread {ref}. Fix spelling, grammar and punctuation only. Do not reword anything that is already correct, and do not change the design.",
  },
  {
    id: "ai:subject",
    label: "Write a subject line",
    hint: "Based on the email's content",
    group: "Writing",
    usesAi: true,
    prompt:
      "Read the email and set a subject line and preview text that suit it. Keep the subject under 60 characters.",
  },
];

/** Order groups appear in the `/` menu. */
export const COMMAND_GROUP_ORDER: CommandGroup[] = [
  "Templates",
  "Theme",
  "Layout",
  "Writing",
];

/**
 * Fill in `{ref}` with whatever the user currently has in focus, so a writing
 * command applies to the selected block instead of the entire email.
 */
export function resolveCommandPrompt(
  command: AgentCommand,
  reference: string | null,
): string {
  if (!command.prompt) return "";
  return command.prompt.replace(/\{ref\}/g, reference ?? "the whole email");
}

export function findCommand(id: string): AgentCommand | undefined {
  return AGENT_COMMANDS.find((command) => command.id === id);
}
