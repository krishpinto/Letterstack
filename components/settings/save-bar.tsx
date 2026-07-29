"use client";

import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { cn } from "@/lib/utils";

// Floating "you have unsaved changes" bar. Only ever appears once a panel's
// fields actually diverge from what's saved — nothing autosaves, and nothing
// commits until the user explicitly clicks Save.
export function SaveBar({
  dirty,
  saving,
  error,
  onSave,
  onDiscard,
}: {
  dirty: boolean;
  saving: boolean;
  error?: string | null;
  onSave: () => void;
  onDiscard: () => void;
}) {
  return (
    <div
      className={cn(
        "pointer-events-none fixed inset-x-0 bottom-0 z-40 flex justify-center px-4 pb-5 transition-all duration-200",
        dirty ? "translate-y-0 opacity-100" : "translate-y-3 opacity-0",
      )}
      aria-hidden={!dirty}
    >
      <div className="pointer-events-auto flex items-center gap-3 rounded-xl border border-border bg-popover px-4 py-2.5 shadow-lg shadow-black/10">
        <span className="text-sm font-medium">
          {error ? <span className="text-destructive">{error}</span> : "You have unsaved changes"}
        </span>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={onDiscard} disabled={saving}>
            Discard
          </Button>
          <Button size="sm" onClick={onSave} disabled={saving}>
            {saving && <Spinner data-icon="inline-start" />}
            {saving ? "Saving…" : "Save changes"}
          </Button>
        </div>
      </div>
    </div>
  );
}
