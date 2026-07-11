"use client";

import { useEffect, useState } from "react";
import { Loader2Icon } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { FormPreview } from "./form-preview";
import {
  DEFAULT_FORM_SETTINGS,
  type SignupFormRow,
  type SignupFormSettingsInput,
} from "./types";

// Create (initial = null) or edit (initial = a form) a signup form's wording,
// style, and fields, with a live preview. On save it POSTs or PATCHes and hands
// the saved row back. When creating, `preset` seeds the starting values.
export function FormSettingsDialog({
  open,
  onOpenChange,
  initial,
  preset,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initial: SignupFormRow | null;
  preset?: SignupFormSettingsInput | null;
  onSaved: (form: SignupFormRow) => void;
}) {
  const editing = initial !== null;
  const [values, setValues] = useState<SignupFormSettingsInput>(
    DEFAULT_FORM_SETTINGS,
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Reload the form fields whenever the dialog opens for a different target.
  useEffect(() => {
    if (!open) return;
    setError(null);
    if (initial) {
      setValues({
        name: initial.name,
        headline: initial.headline,
        description: initial.description,
        buttonLabel: initial.buttonLabel,
        successMessage: initial.successMessage,
        accentColor: initial.accentColor,
        collectName: initial.collectName,
        layout: initial.layout,
        theme: initial.theme,
        cornerStyle: initial.cornerStyle,
      });
    } else {
      setValues(preset ?? DEFAULT_FORM_SETTINGS);
    }
  }, [open, initial, preset]);

  function set<K extends keyof SignupFormSettingsInput>(
    key: K,
    value: SignupFormSettingsInput[K],
  ) {
    setValues((prev) => ({ ...prev, [key]: value }));
  }

  async function save() {
    setBusy(true);
    setError(null);
    try {
      const url = editing ? `/api/forms/${initial.id}` : "/api/forms";
      const res = await fetch(url, {
        method: editing ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });
      const data = await res.json();
      if (data.ok) {
        onSaved(data.form);
        onOpenChange(false);
      } else {
        setError(data.error ?? "Could not save the form.");
      }
    } catch {
      setError("Could not reach the server.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[88vh] gap-0 overflow-hidden p-0 sm:max-w-3xl">
        <DialogHeader className="border-b border-border px-6 py-4">
          <DialogTitle>{editing ? "Edit form" : "New signup form"}</DialogTitle>
          <DialogDescription>
            This is what visitors see on your embedded and hosted subscribe form.
          </DialogDescription>
        </DialogHeader>

        <div className="grid max-h-[calc(88vh-8.5rem)] md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
          {/* Settings column */}
          <div className="flex flex-col gap-5 overflow-y-auto p-6">
            <div className="flex flex-col gap-2">
              <Label htmlFor="form-name">Form name</Label>
              <Input
                id="form-name"
                value={values.name}
                onChange={(e) => set("name", e.target.value)}
                placeholder="Website footer form"
              />
              <p className="text-xs text-muted-foreground">
                Internal label — only you see this.
              </p>
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="form-headline">Headline</Label>
              <Input
                id="form-headline"
                value={values.headline}
                onChange={(e) => set("headline", e.target.value)}
              />
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="form-description">Description</Label>
              <Textarea
                id="form-description"
                rows={2}
                value={values.description}
                onChange={(e) => set("description", e.target.value)}
              />
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="form-button">Button label</Label>
              <Input
                id="form-button"
                value={values.buttonLabel}
                onChange={(e) => set("buttonLabel", e.target.value)}
              />
            </div>

            {/* Style */}
            <div className="flex flex-col gap-3 rounded-lg border border-border p-3">
              <p className="text-sm font-medium">Style</p>

              <Segmented
                label="Layout"
                value={values.layout}
                onChange={(v) => set("layout", v)}
                options={[
                  { value: "card", label: "Card" },
                  { value: "minimal", label: "Minimal" },
                  { value: "inline", label: "Inline" },
                ]}
              />
              <Segmented
                label="Theme"
                value={values.theme}
                onChange={(v) => set("theme", v)}
                options={[
                  { value: "light", label: "Light" },
                  { value: "dark", label: "Dark" },
                ]}
              />
              <Segmented
                label="Corners"
                value={values.cornerStyle}
                onChange={(v) => set("cornerStyle", v)}
                options={[
                  { value: "sharp", label: "Sharp" },
                  { value: "rounded", label: "Rounded" },
                  { value: "pill", label: "Pill" },
                ]}
              />

              <div className="flex items-center justify-between gap-3">
                <Label htmlFor="form-accent" className="text-xs font-normal">
                  Accent color
                </Label>
                <div className="flex items-center gap-2">
                  <input
                    id="form-accent"
                    type="color"
                    value={values.accentColor}
                    onChange={(e) => set("accentColor", e.target.value)}
                    className="h-8 w-10 cursor-pointer rounded-md border border-input bg-transparent"
                    aria-label="Accent color"
                  />
                  <Input
                    value={values.accentColor}
                    onChange={(e) => set("accentColor", e.target.value)}
                    className="h-8 w-24 font-mono text-xs"
                  />
                </div>
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="form-success">Success message</Label>
              <Textarea
                id="form-success"
                rows={2}
                value={values.successMessage}
                onChange={(e) => set("successMessage", e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Shown after someone submits, while they go confirm their email.
              </p>
            </div>

            <div className="flex items-center justify-between rounded-lg border border-border p-3">
              <div>
                <Label htmlFor="form-collect-name">Ask for a name</Label>
                <p className="text-xs text-muted-foreground">
                  Adds a name field above the email.
                </p>
              </div>
              <Switch
                id="form-collect-name"
                checked={values.collectName}
                onCheckedChange={(checked) => set("collectName", checked)}
              />
            </div>

            {error && <p className="text-sm text-destructive">{error}</p>}
          </div>

          {/* Live preview column */}
          <div className="hidden min-h-full border-l border-border bg-muted/30 md:block">
            <div className="sticky top-0 flex h-full items-center justify-center p-4">
              <div className="w-full overflow-hidden rounded-xl border border-border shadow-sm">
                <FormPreview settings={values} className="min-h-[260px] w-full" />
              </div>
            </div>
          </div>
        </div>

        <DialogFooter className="border-t border-border px-6 py-4">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={() => void save()} disabled={busy}>
            {busy && <Loader2Icon data-icon="inline-start" className="animate-spin" />}
            {editing ? "Save changes" : "Create form"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// A compact segmented button group for the small enum style choices.
function Segmented<T extends string>({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: T;
  onChange: (value: T) => void;
  options: { value: T; label: string }[];
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-xs text-muted-foreground">{label}</span>
      <div className="flex rounded-md border border-border p-0.5">
        {options.map((option) => (
          <button
            key={option.value}
            type="button"
            onClick={() => onChange(option.value)}
            className={cn(
              "rounded px-2.5 py-1 text-xs transition-colors",
              value === option.value
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {option.label}
          </button>
        ))}
      </div>
    </div>
  );
}
