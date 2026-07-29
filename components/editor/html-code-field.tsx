"use client";

import * as React from "react";
import CodeMirror from "@uiw/react-codemirror";
import { html as htmlLang } from "@codemirror/lang-html";
import { EditorView } from "@codemirror/view";
import { AlertTriangleIcon } from "lucide-react";

import { normalizeRawHtml } from "@/lib/email/normalize-raw-html";
import { cn } from "@/lib/utils";

/**
 * HTML editor for the rawHtml block.
 *
 * Normalizing runs on blur rather than on every keystroke — rewriting markup
 * while someone is halfway through typing a tag fights the user and moves the
 * caret. `text` is derived here so the plain-text half of the email stays in
 * sync without asking anyone to write it twice.
 */
export function HtmlCodeField({
  value,
  onCommit,
  minHeight = 220,
}: {
  value: string;
  /** Called with normalized markup plus its derived plain-text equivalent. */
  onCommit: (next: { html: string; text: string }) => void;
  minHeight?: number;
}) {
  const [draft, setDraft] = React.useState(value);
  const [warnings, setWarnings] = React.useState<string[]>([]);

  // Adopt outside edits (agent writes, undo) unless the user is mid-edit.
  const dirty = React.useRef(false);
  React.useEffect(() => {
    if (!dirty.current) setDraft(value);
  }, [value]);

  const commit = React.useCallback(() => {
    dirty.current = false;
    const result = normalizeRawHtml(draft);
    setWarnings(result.warnings);
    // Only rewrite the buffer when normalizing actually changed something,
    // so a clean paste doesn't reformat under the cursor.
    if (result.html !== draft) setDraft(result.html);
    onCommit({ html: result.html, text: result.text });
  }, [draft, onCommit]);

  const theme = React.useMemo(
    () =>
      EditorView.theme({
        "&": { fontSize: "12px", backgroundColor: "transparent" },
        "&.cm-focused": { outline: "none" },
        ".cm-content": { fontFamily: "var(--font-mono, ui-monospace, monospace)" },
        ".cm-gutters": { backgroundColor: "transparent", border: "none" },
      }),
    [],
  );

  return (
    <div className="flex flex-col gap-2">
      <div
        className={cn(
          "overflow-hidden rounded-md border border-border bg-muted/30",
          "focus-within:border-ring focus-within:ring-[3px] focus-within:ring-ring/50",
        )}
      >
        <CodeMirror
          value={draft}
          height={`${minHeight}px`}
          extensions={[htmlLang(), EditorView.lineWrapping, theme]}
          basicSetup={{ foldGutter: false, highlightActiveLine: false }}
          onChange={(next) => {
            dirty.current = true;
            setDraft(next);
          }}
          onBlur={commit}
        />
      </div>

      {warnings.length > 0 && (
        <ul className="flex flex-col gap-1.5 rounded-md border border-amber-500/30 bg-amber-500/5 p-2.5">
          {warnings.map((warning) => (
            <li key={warning} className="flex gap-1.5 text-xs text-amber-700 dark:text-amber-500">
              <AlertTriangleIcon className="mt-px size-3 shrink-0" />
              <span>{warning}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
