// The agent's tool surface — one file so the model's schemas and the code that
// executes them can never drift apart.
//
// Every tool is a thin wrapper over a helper that already exists in
// lib/email/document.ts, which is what keeps the "canvas is the only editing
// surface" rule intact: the agent is just another writer into the same
// EmailDocument, exactly like the inspector panel. It has no path to HTML that
// bypasses compileEmailDocument(), and deliberately no access to sending,
// saving, recipients, or the From address.
//
// applyAgentTool is a pure function (document in, document out) so the whole
// tool layer can be exercised without mounting React or calling a model.

import { z } from "zod";

import {
  createBlock,
  duplicateBlock,
  findBlock,
  insertBlockAtIndex,
  removeBlock,
  reorderBlocks,
  touchDocument,
  updateBlock,
  type EmailBlock,
  type EmailDocument,
} from "@/lib/email/document";
import { normalizeRawHtml } from "@/lib/email/normalize-raw-html";

const BLOCK_TYPES = [
  "text",
  "heading",
  "paragraph",
  "image",
  "button",
  "divider",
  "spacer",
  "columns",
  "articleCard",
  "rawHtml",
  "video",
  "social",
  "logo",
  "footer",
] as const;

/** Block fields that hold rich text as HTML rather than a plain string. */
const RICH_TEXT_FIELDS = new Set(["heading", "body", "text", "headline"]);

/**
 * Appearance fields, deliberately unreachable from updateBlock.
 *
 * This is a structural guarantee rather than a request in the prompt: because
 * the content tool has no colour or padding fields, "make this paragraph
 * shorter" *cannot* also restyle the block. A model that drifts off-theme
 * gets a rejection instead of a recoloured email. Changing these requires
 * setBlockStyle, whose description says it needs an explicit visual request.
 */
const STYLE_FIELDS = new Set([
  "backgroundColor",
  "textColor",
  "paddingTop",
  "paddingBottom",
  "columnBackgroundColor",
  "borderColor",
]);

/** Structural fields no tool may set — changing them corrupts the document. */
const FROZEN_FIELDS = new Set(["id", "type", "blocks", "columns", "links"]);

/**
 * Optional fields that `createBlock` doesn't seed.
 *
 * A plain `key in block` test rejects these, because the property genuinely
 * isn't there until something sets it — which would mean the agent could never
 * add a link to an image, or set a background on a block that has never had
 * one. Every BaseBlock style field is in this position, so without this list
 * setBlockStyle would be unable to style anything at all.
 */
const BASE_OPTIONAL_FIELDS = [
  "backgroundColor",
  "textColor",
  "paddingTop",
  "paddingBottom",
];

const OPTIONAL_FIELDS_BY_TYPE: Partial<Record<EmailBlock["type"], string[]>> = {
  image: ["href"],
  logo: ["href"],
  button: ["fullWidth", "secondaryLabel", "secondaryHref", "secondaryVariant"],
  text: ["eyebrow"],
  columns: ["columnBackgroundColor"],
};

function fieldExistsOnBlock(target: EmailBlock, key: string): boolean {
  if (key in target) return true;
  if (BASE_OPTIONAL_FIELDS.includes(key)) return true;
  return (OPTIONAL_FIELDS_BY_TYPE[target.type] ?? []).includes(key);
}

/** Every field a given tool may set on this block, for error messages. */
function settableFields(target: EmailBlock, styling: boolean): string[] {
  const all = new Set([
    ...Object.keys(target),
    ...BASE_OPTIONAL_FIELDS,
    ...(OPTIONAL_FIELDS_BY_TYPE[target.type] ?? []),
  ]);
  return [...all].filter(
    (key) => !FROZEN_FIELDS.has(key) && STYLE_FIELDS.has(key) === styling,
  );
}

/**
 * Models reliably write prose but unreliably remember that these fields are
 * HTML. Wrapping bare text keeps the canvas and compiler from rendering a
 * stray unwrapped string.
 */
function asRichText(value: unknown): unknown {
  if (typeof value !== "string") return value;
  const trimmed = value.trim();
  if (!trimmed) return "";
  return /^</.test(trimmed) ? trimmed : `<p>${trimmed}</p>`;
}

// ─── Value validation ─────────────────────────────────────────────────────────
// Checking that a field *exists* is not enough. Without these, a model can
// write align:"diagonal", level:7, or width:-50 — all of which are accepted by
// a plain key check and then render as garbage.

type FieldCheck =
  | { ok: true; value: unknown }
  | { ok: false; message: string };

const pass = (value: unknown): FieldCheck => ({ ok: true, value });
const failField = (message: string): FieldCheck => ({ ok: false, message });

function enumOf(...allowed: string[]) {
  return (value: unknown): FieldCheck =>
    typeof value === "string" && allowed.includes(value)
      ? pass(value)
      : failField(`must be one of ${allowed.join(", ")}`);
}

function boundedNumber(min: number, max: number) {
  return (value: unknown): FieldCheck => {
    const n = typeof value === "string" ? Number(value) : value;
    if (typeof n !== "number" || !Number.isFinite(n)) return failField("must be a number");
    if (n < min || n > max) return failField(`must be between ${min} and ${max}`);
    return pass(n);
  };
}

const colorValue = (value: unknown): FieldCheck =>
  typeof value === "string" && /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(value.trim())
    ? pass(value.trim())
    : failField("must be a hex color like #1a1a1a");

const boolValue = (value: unknown): FieldCheck =>
  typeof value === "boolean" ? pass(value) : failField("must be true or false");

/**
 * Explicit for optional fields that may be absent from the block: without a
 * check, the "keep the existing type" fallback has no existing type to compare
 * against and would wave anything through.
 */
const textValue = (value: unknown): FieldCheck =>
  typeof value === "string" ? pass(value) : failField("must be text");

const FIELD_CHECKS: Record<string, (value: unknown) => FieldCheck> = {
  align: enumOf("left", "center", "right"),
  level: boundedNumber(1, 3),
  variant: enumOf("primary", "secondary"),
  secondaryVariant: enumOf("primary", "secondary"),
  imagePosition: enumOf("left", "right"),
  ctaStyle: enumOf("link", "button"),
  borderStyle: enumOf("none", "solid", "dashed", "dotted"),
  valign: enumOf("top", "middle", "bottom"),
  mobile: enumOf("stack", "stack-reverse", "row"),
  showCta: boolValue,
  showImage: boolValue,
  fullWidth: boolValue,
  href: textValue,
  secondaryHref: textValue,
  secondaryLabel: textValue,
  eyebrow: textValue,
  width: boundedNumber(1, 1000),
  height: boundedNumber(0, 400),
  gap: boundedNumber(0, 64),
  cellPadding: boundedNumber(0, 64),
  borderRadius: boundedNumber(0, 64),
  paddingTop: boundedNumber(0, 200),
  paddingBottom: boundedNumber(0, 200),
  backgroundColor: colorValue,
  textColor: colorValue,
  columnBackgroundColor: colorValue,
  borderColor: colorValue,
};

/**
 * Validate one field against the target block. Fields with an explicit check
 * use it; anything else must at least keep the type the block already has, so
 * an array is never replaced by a string.
 */
function checkField(key: string, value: unknown, current: unknown): FieldCheck {
  if (RICH_TEXT_FIELDS.has(key)) {
    return typeof value === "string" ? pass(asRichText(value)) : failField("must be text");
  }

  const check = FIELD_CHECKS[key];
  if (check) return check(value);

  if (current !== undefined && typeof current !== typeof value) {
    return failField(`must be a ${typeof current}`);
  }
  return pass(value);
}

/** Shared merge path for updateBlock and setBlockStyle. */
function mergeFields(
  target: EmailBlock,
  patch: Record<string, unknown>,
  allow: (key: string) => string | null,
): { allowed: Record<string, unknown>; problems: string[] } {
  const allowed: Record<string, unknown> = {};
  const problems: string[] = [];

  for (const [key, value] of Object.entries(patch)) {
    if (FROZEN_FIELDS.has(key)) {
      problems.push(`${key}: cannot be changed`);
      continue;
    }
    const rejection = allow(key);
    if (rejection) {
      problems.push(`${key}: ${rejection}`);
      continue;
    }
    if (!fieldExistsOnBlock(target, key)) {
      problems.push(`${key}: not a field on a ${target.type} block`);
      continue;
    }
    const result = checkField(key, value, (target as Record<string, unknown>)[key]);
    if (!result.ok) {
      problems.push(`${key}: ${result.message}`);
      continue;
    }
    allowed[key] = result.value;
  }

  return { allowed, problems };
}

// ─── Schemas ──────────────────────────────────────────────────────────────────
// Sent to the model. Descriptions are load-bearing: they are the only place the
// model learns the document's conventions.

export const agentTools = {
  readBlock: {
    description:
      "Read one block's full contents. The conversation already includes a summary outline of every block, so only call this when you need a block's exact current values and it was not referenced with @.",
    inputSchema: z.object({
      id: z.string().describe("Block id from the outline."),
    }),
  },

  addBlock: {
    description:
      "Add a new block with sensible placeholder content, then use updateBlock to fill it in. Returns the new block's id.",
    inputSchema: z.object({
      type: z.enum(BLOCK_TYPES).describe("Kind of block to create."),
      index: z
        .number()
        .int()
        .min(0)
        .optional()
        .describe("Position among top-level blocks. Omit to append at the end."),
    }),
  },

  updateBlock: {
    description:
      "Change the CONTENT of an existing block: text, links, image sources, alignment, layout. Only pass fields you are actually changing. Text fields (heading, body, text, headline) hold HTML — use <p>, <strong>, <em>, <a href>. This tool cannot change colors or padding; that is setBlockStyle, and it is intentionally separate so editing copy never alters the design.",
    inputSchema: z.object({
      id: z.string(),
      patch: z
        .record(z.string(), z.unknown())
        .describe("Field name to new value, e.g. { \"body\": \"<p>Hello</p>\" }."),
    }),
  },

  setBlockStyle: {
    description:
      "Override colors or padding on ONE block. Use this only when the user explicitly asks for a visual change to that block. Never use it to 'improve' or 'tidy' a design that was not mentioned — per-block overrides fight the email's global theme and are almost always the wrong tool. If the user wants a look changed across the whole email, use setDocumentSettings instead.",
    inputSchema: z.object({
      id: z.string(),
      patch: z
        .record(z.string(), z.unknown())
        .describe(
          "Any of backgroundColor, textColor, columnBackgroundColor, borderColor (hex like #1a1a1a), paddingTop, paddingBottom (px).",
        ),
    }),
  },

  removeBlock: {
    description: "Delete a block. The document always keeps at least one block.",
    inputSchema: z.object({ id: z.string() }),
  },

  moveBlock: {
    description: "Move a top-level block to a new position.",
    inputSchema: z.object({
      id: z.string(),
      toIndex: z.number().int().min(0).describe("Zero-based destination index."),
    }),
  },

  duplicateBlock: {
    description: "Copy a block, inserting the copy directly after the original.",
    inputSchema: z.object({ id: z.string() }),
  },

  setCustomHtml: {
    description:
      "Write markup into a rawHtml block. The HTML is placed inside a table cell in the email, so send content only — no <!DOCTYPE>, <html>, <head> or <body>. Email-safe markup only: nested tables and inline styles. Flexbox, grid, absolute positioning, CSS variables, <style> blocks and <script> do not work in email clients and will be stripped or flagged. The plain-text version is derived automatically.",
    inputSchema: z.object({
      id: z.string().describe("Id of an existing rawHtml block."),
      html: z.string(),
      label: z.string().optional().describe("Short name shown on the canvas."),
    }),
  },

  setDocumentSettings: {
    description:
      "Change the email's global theme — colors, font, width, padding, button styling. This is the email's design and the user chose it deliberately, so only call this when they explicitly ask to change how the email looks. Never adjust the theme as a side effect of a content request, and never 'improve' colors that were not mentioned. When the user does ask for a visual change, prefer this over restyling blocks one by one.",
    inputSchema: z.object({
      patch: z.record(z.string(), z.unknown()),
    }),
  },

  setSubject: {
    description:
      "Set the email's subject line and/or the preview text shown after it in the inbox.",
    inputSchema: z.object({
      subject: z.string().optional(),
      previewText: z.string().optional(),
    }),
  },
} as const;

export type AgentToolName = keyof typeof agentTools;

export function isAgentToolName(name: string): name is AgentToolName {
  return Object.prototype.hasOwnProperty.call(agentTools, name);
}

// ─── Execution ────────────────────────────────────────────────────────────────

export type AgentToolOutcome = {
  document: EmailDocument;
  /** Fed back to the model as the tool result. Terse — this costs tokens. */
  output: string;
  /** True when the document was left untouched (an error or a no-op). */
  failed?: boolean;
};

function fail(document: EmailDocument, message: string): AgentToolOutcome {
  return { document, output: message, failed: true };
}

/** One-line summary of a block, matching the outline format the model sees. */
function describeBlock(block: EmailBlock): string {
  const preview = summarizeBlock(block);
  return preview ? `${block.id} (${block.type}) — ${preview}` : `${block.id} (${block.type})`;
}

export function summarizeBlock(block: EmailBlock, max = 60): string {
  const raw = (() => {
    switch (block.type) {
      case "text":
        return `${block.eyebrow ?? ""} ${block.heading} ${block.body}`;
      case "heading":
        return block.text;
      case "paragraph":
        return block.body;
      case "articleCard":
        return `${block.headline} ${block.body}`;
      case "button":
        return `${block.label} → ${block.href}`;
      case "image":
        return block.alt || block.src;
      case "logo":
        return block.alt;
      case "video":
        return block.url;
      case "rawHtml":
        return block.label || block.text;
      case "social":
        return block.links.map((l) => l.platform).join(", ");
      case "footer":
        return block.companyName;
      case "spacer":
        return `${block.height}px`;
      case "columns":
        return `${block.columns.length} columns`;
      default:
        return "";
    }
  })();

  const text = raw.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

/**
 * Apply one tool call. Pure: never mutates `document`, never touches React,
 * never performs I/O.
 */
export function applyAgentTool(
  document: EmailDocument,
  name: string,
  rawInput: unknown,
): AgentToolOutcome {
  if (!isAgentToolName(name)) return fail(document, `Unknown tool "${name}".`);

  const parsed = agentTools[name].inputSchema.safeParse(rawInput ?? {});
  if (!parsed.success) {
    return fail(document, `Invalid input: ${parsed.error.issues.map((i) => `${i.path.join(".")} ${i.message}`).join("; ")}`);
  }
  const input = parsed.data as Record<string, unknown>;

  switch (name) {
    case "readBlock": {
      const block = findBlock(document.blocks, input.id as string);
      if (!block) return fail(document, `No block with id "${input.id}".`);
      return { document, output: JSON.stringify(block) };
    }

    case "addBlock": {
      const block = createBlock(input.type as EmailBlock["type"]);
      const index = Math.min(
        (input.index as number | undefined) ?? document.blocks.length,
        document.blocks.length,
      );
      return {
        document: insertBlockAtIndex(document, index, block),
        output: `Added ${block.type} block "${block.id}" at index ${index}.`,
      };
    }

    case "updateBlock":
    case "setBlockStyle": {
      const id = input.id as string;
      const target = findBlock(document.blocks, id);
      if (!target) return fail(document, `No block with id "${id}".`);

      const styling = name === "setBlockStyle";
      const { allowed, problems } = mergeFields(
        target,
        input.patch as Record<string, unknown>,
        (key) => {
          const isStyle = STYLE_FIELDS.has(key);
          if (styling && !isStyle) {
            return "is content, not styling — use updateBlock";
          }
          if (!styling && isStyle) {
            return "is styling — use setBlockStyle, and only if the user asked for a visual change";
          }
          return null;
        },
      );

      if (Object.keys(allowed).length === 0) {
        const usable = settableFields(target, styling);
        return fail(
          document,
          `Nothing applied. ${problems.join("; ")}. Fields this tool can set on a ${target.type}: ${usable.join(", ") || "none"}.`,
        );
      }

      const next = updateBlock(document, id, (b) => ({ ...b, ...allowed }) as EmailBlock);
      // Rejections are reported rather than swallowed so the model can correct
      // itself on the next step instead of believing the edit fully landed.
      const note = problems.length ? ` Rejected — ${problems.join("; ")}.` : "";
      return {
        document: next,
        output: `Set ${Object.keys(allowed).join(", ")} on "${id}".${note}`,
      };
    }

    case "removeBlock": {
      const id = input.id as string;
      if (!findBlock(document.blocks, id)) return fail(document, `No block with id "${id}".`);
      const next = removeBlock(document, id);
      if (next === document) {
        return fail(document, "Cannot remove the last remaining block.");
      }
      return { document: next, output: `Removed block "${id}".` };
    }

    case "moveBlock": {
      const id = input.id as string;
      const from = document.blocks.findIndex((b) => b.id === id);
      if (from < 0) return fail(document, `"${id}" is not a top-level block.`);
      const to = Math.min(input.toIndex as number, document.blocks.length - 1);
      if (to === from) return { document, output: `"${id}" is already at index ${to}.` };
      return {
        document: reorderBlocks(document, from, to),
        output: `Moved "${id}" from ${from} to ${to}.`,
      };
    }

    case "duplicateBlock": {
      const id = input.id as string;
      if (!findBlock(document.blocks, id)) return fail(document, `No block with id "${id}".`);
      const next = duplicateBlock(document, id);
      const fresh = next.blocks.find(
        (b) => !document.blocks.some((old) => old.id === b.id),
      );
      return { document: next, output: `Duplicated "${id}"${fresh ? ` as "${fresh.id}"` : ""}.` };
    }

    case "setCustomHtml": {
      const id = input.id as string;
      const target = findBlock(document.blocks, id);
      if (!target) return fail(document, `No block with id "${id}".`);
      if (target.type !== "rawHtml") {
        return fail(document, `Block "${id}" is a ${target.type}, not rawHtml. Add a rawHtml block first.`);
      }

      const { html, text, warnings } = normalizeRawHtml(input.html as string);
      if (!html) {
        return fail(document, `Produced no usable HTML. ${warnings.join(" ")}`.trim());
      }

      const label = (input.label as string | undefined) ?? target.label;
      const next = updateBlock(document, id, (b) => ({ ...b, html, text, label }) as EmailBlock);
      // Warnings go back to the model so it can correct itself next step.
      return {
        document: next,
        output: warnings.length
          ? `Set HTML on "${id}", with changes: ${warnings.join(" ")}`
          : `Set HTML on "${id}".`,
      };
    }

    case "setDocumentSettings": {
      const patch = input.patch as Record<string, unknown>;
      const settings = document.settings as unknown as Record<string, unknown>;
      const allowed: Record<string, unknown> = {};
      const problems: string[] = [];

      for (const [key, value] of Object.entries(patch)) {
        if (!(key in settings)) {
          problems.push(`${key}: not a setting`);
          continue;
        }
        // Same value checks as blocks — a color must still be a color here.
        const result = checkField(key, value, settings[key]);
        if (!result.ok) {
          problems.push(`${key}: ${result.message}`);
          continue;
        }
        allowed[key] = result.value;
      }

      if (Object.keys(allowed).length === 0) {
        return fail(document, `No settings applied. ${problems.join("; ")}.`);
      }
      return {
        document: touchDocument({
          ...document,
          settings: { ...document.settings, ...allowed } as EmailDocument["settings"],
        }),
        output: `Updated theme: ${Object.keys(allowed).join(", ")}.${problems.length ? ` Rejected — ${problems.join("; ")}.` : ""}`,
      };
    }

    case "setSubject": {
      const subject = input.subject as string | undefined;
      const previewText = input.previewText as string | undefined;
      if (subject === undefined && previewText === undefined) {
        return fail(document, "Provide subject, previewText, or both.");
      }
      return {
        document: touchDocument({
          ...document,
          subject: subject ?? document.subject,
          settings:
            previewText === undefined
              ? document.settings
              : { ...document.settings, previewText },
        }),
        output: `Updated ${[subject !== undefined && "subject", previewText !== undefined && "preview text"].filter(Boolean).join(" and ")}.`,
      };
    }
  }
}

export { describeBlock };
