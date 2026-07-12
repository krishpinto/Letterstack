"use client";

import { useMemo, useState, type ReactNode } from "react";
import { CornerDownLeftIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Spinner } from "@/components/ui/spinner";
import { cn } from "@/lib/utils";

// Inline cell editing in the style of document-review tools: click a value in
// the table and an elevated input opens in place, with a candidate panel
// underneath — the live edit shown as a character diff against the saved
// value, the saved value itself, and (for emails) a typo-fix suggestion.

type DiffSegment = { text: string; kind: "same" | "added" | "removed" };

// Character-level diff via LCS. Values here are short (emails, names), so the
// quadratic table is nowhere near a concern.
function charDiff(from: string, to: string): DiffSegment[] {
  const n = from.length;
  const m = to.length;
  const dp: number[][] = Array.from({ length: n + 1 }, () =>
    new Array<number>(m + 1).fill(0),
  );
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      dp[i][j] =
        from[i] === to[j]
          ? dp[i + 1][j + 1] + 1
          : Math.max(dp[i + 1][j], dp[i][j + 1]);
    }
  }

  const segments: DiffSegment[] = [];
  const push = (kind: DiffSegment["kind"], text: string) => {
    const last = segments[segments.length - 1];
    if (last && last.kind === kind) last.text += text;
    else segments.push({ text, kind });
  };

  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    if (from[i] === to[j]) {
      push("same", from[i]);
      i++;
      j++;
    } else if (dp[i + 1][j] >= dp[i][j + 1]) {
      push("removed", from[i]);
      i++;
    } else {
      push("added", to[j]);
      j++;
    }
  }
  while (i < n) push("removed", from[i++]);
  while (j < m) push("added", to[j++]);
  return segments;
}

// How close two strings are (0–100), from the same LCS the diff uses.
function similarity(from: string, to: string): number {
  if (!from && !to) return 100;
  const same = charDiff(from, to)
    .filter((segment) => segment.kind === "same")
    .reduce((total, segment) => total + segment.text.length, 0);
  return Math.round((2 * same * 100) / (from.length + to.length));
}

function DiffText({ from, to }: { from: string; to: string }) {
  const segments = useMemo(() => charDiff(from, to), [from, to]);
  return (
    <span className="break-all">
      {segments.map((segment, index) =>
        segment.kind === "same" ? (
          <span key={index}>{segment.text}</span>
        ) : segment.kind === "added" ? (
          <span key={index} className="rounded-sm bg-emerald-500/20 text-emerald-600 dark:text-emerald-400">
            {segment.text}
          </span>
        ) : (
          <span key={index} className="rounded-sm bg-red-500/15 text-red-500 line-through">
            {segment.text}
          </span>
        ),
      )}
    </span>
  );
}

function ScoreBar({ value, tone }: { value: number; tone: "good" | "warn" | "bad" | "muted" }) {
  const toneClass = {
    good: "bg-emerald-500",
    warn: "bg-amber-500",
    bad: "bg-red-500",
    muted: "bg-muted-foreground/50",
  }[tone];
  return (
    <span className="flex shrink-0 items-center gap-1.5">
      <span className="h-1 w-14 overflow-hidden rounded-full bg-muted">
        <span
          className={cn("block h-full rounded-full", toneClass)}
          // Bar length is data-driven — the one place inline style is earned.
          style={{ width: `${Math.max(4, Math.min(100, value))}%` }}
        />
      </span>
      <span className="w-8 text-right text-[10px] tabular-nums text-muted-foreground">
        {value}%
      </span>
    </span>
  );
}

function OptionRow({
  label,
  onSelect,
  children,
  score,
}: {
  label?: string;
  onSelect: () => void;
  children: ReactNode;
  score: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className="flex w-full cursor-pointer items-center justify-between gap-3 rounded-md px-2 py-1.5 text-left transition-colors hover:bg-muted"
    >
      <span className="min-w-0">
        {label && (
          <span className="block text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
            {label}
          </span>
        )}
        <span className="block text-sm">{children}</span>
      </span>
      {score}
    </button>
  );
}

export function InlineEditCell({
  value,
  display,
  ariaLabel,
  placeholder,
  validate,
  invalidMessage,
  suggest,
  onCommit,
}: {
  /** The saved value the edit is diffed against. */
  value: string;
  /** What the cell shows when not editing. */
  display: ReactNode;
  ariaLabel: string;
  placeholder?: string;
  /** Gate for committing; invalid values show `invalidMessage` instead. */
  validate?: (next: string) => boolean;
  invalidMessage?: string;
  /** Optional candidate producer (e.g. email domain typo fix). */
  suggest?: (next: string) => string | null;
  /** Persist the value; resolve an error message to keep editing, null on success. */
  onCommit: (next: string) => Promise<string | null>;
}) {
  const [open, setOpen] = useState(false);
  const [typed, setTyped] = useState(value);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const trimmed = typed.trim();
  const changed = trimmed !== value;
  const valid = validate ? validate(trimmed) : true;
  const suggestion = suggest ? suggest(trimmed) : null;

  function openEditor(next: boolean) {
    setOpen(next);
    if (next) {
      setTyped(value);
      setError(null);
    }
  }

  async function commit(next: string) {
    if (busy) return;
    const candidate = next.trim();
    if (candidate === value) {
      setOpen(false);
      return;
    }
    if (validate && !validate(candidate)) {
      setError(invalidMessage ?? "That value is not valid.");
      return;
    }
    setBusy(true);
    setError(null);
    const failure = await onCommit(candidate);
    setBusy(false);
    if (failure) setError(failure);
    else setOpen(false);
  }

  return (
    <Popover open={open} onOpenChange={openEditor}>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={ariaLabel}
          className="-mx-1 block min-w-0 max-w-full cursor-text rounded-sm px-1 text-left transition-colors hover:bg-muted"
        >
          {display}
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        side="bottom"
        sideOffset={-2}
        className="w-96 max-w-[calc(100vw-2rem)] overflow-hidden p-0"
      >
        <div className="flex items-center gap-1 border-b border-border p-1.5">
          <input
            autoFocus
            value={typed}
            placeholder={placeholder}
            onChange={(event) => {
              setTyped(event.target.value);
              setError(null);
            }}
            onKeyDown={(event) => {
              if (event.key === "Enter") void commit(typed);
              else if (event.key === "Escape") setOpen(false);
            }}
            className="h-8 min-w-0 flex-1 rounded-md bg-transparent px-2 text-sm outline-none placeholder:text-muted-foreground"
            aria-label={ariaLabel}
          />
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={() => void commit(typed)}
            disabled={busy}
            aria-label="Save"
          >
            {busy ? <Spinner className="size-3.5" /> : <CornerDownLeftIcon className="size-3.5" />}
          </Button>
        </div>

        {error && (
          <p className="border-b border-border bg-destructive/5 px-3 py-1.5 text-xs text-destructive">
            {error}
          </p>
        )}

        <div className="flex flex-col p-1">
          {changed && trimmed !== "" && (
            <OptionRow
              onSelect={() => void commit(typed)}
              score={
                <ScoreBar
                  value={similarity(value, trimmed)}
                  tone={valid ? "good" : "bad"}
                />
              }
            >
              <DiffText from={value} to={trimmed} />
            </OptionRow>
          )}

          {value !== "" && (
            <OptionRow
              label="Current"
              onSelect={() => {
                setTyped(value);
                setError(null);
              }}
              score={<ScoreBar value={100} tone="muted" />}
            >
              {value}
            </OptionRow>
          )}

          {suggestion && suggestion !== value && (
            <OptionRow
              label="Suggested"
              onSelect={() => void commit(suggestion)}
              score={<ScoreBar value={similarity(trimmed, suggestion)} tone="warn" />}
            >
              {suggestion}
            </OptionRow>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}

// Common email domain typos → the address people almost certainly meant.
const DOMAIN_FIXES: Record<string, string> = {
  "gamil.com": "gmail.com",
  "gmial.com": "gmail.com",
  "gmal.com": "gmail.com",
  "gmaill.com": "gmail.com",
  "gmali.com": "gmail.com",
  "gmail.co": "gmail.com",
  "gmail.cm": "gmail.com",
  "hotmial.com": "hotmail.com",
  "hotmal.com": "hotmail.com",
  "hotmail.co": "hotmail.com",
  "yaho.com": "yahoo.com",
  "yahooo.com": "yahoo.com",
  "yahoo.co": "yahoo.com",
  "outlok.com": "outlook.com",
  "outloook.com": "outlook.com",
  "outlook.co": "outlook.com",
};

export function suggestEmailFix(next: string): string | null {
  const at = next.lastIndexOf("@");
  if (at < 1) return null;
  const local = next.slice(0, at);
  const domain = next.slice(at + 1).toLowerCase();
  let fixed = DOMAIN_FIXES[domain];
  // ".con" is a keyboard slip for ".com" on any domain.
  if (!fixed && domain.endsWith(".con")) fixed = `${domain.slice(0, -4)}.com`;
  return fixed && fixed !== domain ? `${local}@${fixed}` : null;
}
