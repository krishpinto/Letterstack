import type { Editor } from "@tiptap/react";

export type FormattingTextType = "p" | "h1" | "h2" | "h3" | "quote";

export const FORMATTING_TEXT_TYPES: {
  value: FormattingTextType;
  label: string;
  fontSize: string;
}[] = [
  { value: "p", label: "Text", fontSize: "15px" },
  { value: "h1", label: "Heading 1", fontSize: "32px" },
  { value: "h2", label: "Heading 2", fontSize: "24px" },
  { value: "h3", label: "Heading 3", fontSize: "18px" },
  { value: "quote", label: "Quote", fontSize: "15px" },
];

export const FORMATTING_FONT_SIZES = [
  "12px",
  "13px",
  "14px",
  "15px",
  "16px",
  "18px",
  "20px",
  "24px",
  "28px",
  "32px",
];

export const DEFAULT_FONT_SIZE_BY_TEXT_TYPE = FORMATTING_TEXT_TYPES.reduce(
  (acc, option) => ({ ...acc, [option.value]: option.fontSize }),
  {} as Record<FormattingTextType, string>,
);

type EditorWithFormattingState = Editor & {
  __letterstackFormatting?: {
    textType?: FormattingTextType;
  };
};

export function toFontSizeValue(value: unknown) {
  if (typeof value === "number") return `${value}px`;
  if (typeof value === "string" && value.trim()) return value.trim();
  return undefined;
}

export function setFormattingTextTypeOverride(
  editor: Editor,
  textType: FormattingTextType,
) {
  const target = editor as EditorWithFormattingState;
  target.__letterstackFormatting = {
    ...target.__letterstackFormatting,
    textType,
  };
}

export function getRichTextDefaults(editor: Editor) {
  const root = editor.view.dom.closest<HTMLElement>("[data-letterstack-rich-text]");

  return {
    textType: root?.dataset.defaultTextType as FormattingTextType | undefined,
    fontSize: root?.dataset.defaultFontSize,
  };
}

export function getCurrentTextType(editor: Editor): FormattingTextType {
  if (editor.isActive("heading", { level: 1 })) return "h1";
  if (editor.isActive("heading", { level: 2 })) return "h2";
  if (editor.isActive("heading", { level: 3 })) return "h3";
  if (editor.isActive("blockquote")) return "quote";

  const override = (editor as EditorWithFormattingState).__letterstackFormatting?.textType;
  if (override) return override;

  const defaults = getRichTextDefaults(editor);
  return defaults.textType ?? "p";
}

export function getCurrentFontSize(editor: Editor, textType = getCurrentTextType(editor)) {
  const markSize = toFontSizeValue(editor.getAttributes("textStyle").fontSize);
  if (markSize) return markSize;

  const defaults = getRichTextDefaults(editor);
  return defaults.fontSize ?? DEFAULT_FONT_SIZE_BY_TEXT_TYPE[textType];
}
