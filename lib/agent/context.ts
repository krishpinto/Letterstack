// Builds what the model sees each turn.
//
// The whole EmailDocument is far too big to send — it's mostly styling scalars,
// and on a free tier the tokens spent on padding values are tokens not spent on
// the user's actual content. So: always send a one-line-per-block outline, send
// full JSON only for blocks the user @-referenced, and let the model pull
// anything else with the readBlock tool.

import type { EmailBlock, EmailDocument } from "@/lib/email/document";
import { findBlock } from "@/lib/email/document";
import { summarizeBlock } from "./tools";

/** One line per block: id, type, and enough content to identify it. */
export function documentOutline(document: EmailDocument): string {
  if (document.blocks.length === 0) return "(empty — the email has no blocks yet)";

  return document.blocks
    .map((block, index) => {
      const summary = summarizeBlock(block, 70);
      const head = `${index}. ${block.id} [${block.type}]`;
      const line = summary ? `${head} ${summary}` : head;
      // Column cells hold their own content, so name them or the model can't
      // address anything inside a columns block.
      if (block.type === "columns") {
        const cells = block.columns
          .map((c, i) => `      cell ${i} ${c.id}: ${stripTags(c.heading)}`)
          .join("\n");
        return `${line}\n${cells}`;
      }
      return line;
    })
    .join("\n");
}

function stripTags(value: string): string {
  return value.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
}

/** Full JSON for the blocks the user explicitly pointed at with @. */
export function expandReferences(
  document: EmailDocument,
  referenceIds: string[],
): string | null {
  const found = referenceIds
    .map((id) => findBlock(document.blocks, id))
    .filter((b): b is EmailBlock => Boolean(b));

  if (found.length === 0) return null;
  return found.map((block) => JSON.stringify(block)).join("\n");
}

/**
 * Settings the model needs to write on-brand content. Deliberately a subset —
 * shadow offsets and padding scalars don't help it write copy or markup.
 */
function relevantSettings(document: EmailDocument) {
  const s = document.settings;
  return {
    backgroundColor: s.backgroundColor,
    contentColor: s.contentColor,
    accentColor: s.accentColor,
    linkColor: s.linkColor,
    textColor: s.textColor,
    fontFamily: s.fontFamily,
    maxWidth: s.maxWidth,
    buttonBackgroundColor: s.buttonBackgroundColor,
    buttonTextColor: s.buttonTextColor,
  };
}

export const AGENT_SYSTEM_PROMPT = `You are the editing assistant inside LetterStack, an email campaign builder. You edit the user's email by calling tools. You never write the email as a chat reply — if the user asks for content, put it in the document.

How the document works:
- An email is an ordered list of blocks. Each has an id and a type.
- Text fields (heading, body, text, headline) contain HTML. Use <p> for paragraphs, plus <strong>, <em>, and <a href="">. Do not use headings tags inside them; block type controls hierarchy.
- Colors, fonts and width are global, in document settings. Change those with setDocumentSettings rather than styling every block.
- The email is compiled to table-based, inline-styled HTML for email clients. Flexbox, grid, absolute positioning and CSS variables do not work.

Protecting the design (this matters more than anything else you do):
- The email already has a theme. The user chose those colors, that font and that spacing on purpose. Treat them as fixed.
- Never change the theme, a block's colors, or its padding unless the user explicitly asked for a visual change. "Rewrite this", "make it shorter", "add a section" are content requests — the design must come out identical.
- New blocks inherit the global theme automatically. Do not set colors on them to "match". Setting them is what causes drift.
- Do not improve, modernise, tidy or harmonise a design nobody asked you to touch. If you think the design is wrong, say so in one sentence and leave it alone.
- When you do add content, write it to suit the existing tone and palette rather than introducing a new style.

How to work:
- Make the edit rather than describing it. Prefer several small tool calls over one large speculative one.
- Only touch what was asked for. Do not restyle or rewrite blocks the user did not mention.
- When the user @-references blocks, those are the blocks they mean.
- If a request is ambiguous in a way that matters, make the most reasonable interpretation and say briefly what you assumed. Do not stop to ask unless you genuinely cannot proceed.
- After your edits, reply with one or two short sentences describing what changed. No preamble, no bullet lists, no restating the document.

Keep copy tight and concrete. Match the tone of the existing content. Placeholder text like "Lorem ipsum" or "Your headline here" is never an acceptable final result.`;

export type AgentContextInput = {
  document: EmailDocument;
  /** Block ids the user @-referenced in this message. */
  references?: string[];
};

/**
 * The per-turn context block. Sent as a system message alongside the
 * conversation so it refreshes as the document changes, rather than going stale
 * inside the message history.
 */
export function buildAgentContext({ document, references = [] }: AgentContextInput): string {
  const parts = [
    `Email: ${document.name || "Untitled"}`,
    `Subject: ${document.subject || "(not set)"}`,
    `Preview text: ${document.settings.previewText || "(not set)"}`,
    "",
    "Theme in use — keep these unless a visual change was explicitly requested:",
    JSON.stringify(relevantSettings(document)),
    "",
    `Blocks (${document.blocks.length}):`,
    documentOutline(document),
  ];

  const expanded = expandReferences(document, references);
  if (expanded) {
    parts.push(
      "",
      "The user referenced these blocks — full contents:",
      expanded,
    );
  }

  return parts.join("\n");
}
