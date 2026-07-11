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
import {
  DEFAULT_FORM_SETTINGS,
  type SignupFormRow,
  type SignupFormSettingsInput,
} from "./types";

// Create (initial = null) or edit (initial = a form) a signup form's wording,
// colors, and fields. On save it POSTs or PATCHes and hands the saved row back.
export function FormSettingsDialog({
  open,
  onOpenChange,
  initial,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initial: SignupFormRow | null;
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
      });
    } else {
      setValues(DEFAULT_FORM_SETTINGS);
    }
  }, [open, initial]);

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
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{editing ? "Edit form" : "New signup form"}</DialogTitle>
          <DialogDescription>
            This is what visitors see on your embedded and hosted subscribe form.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4 py-2">
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

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-2">
              <Label htmlFor="form-button">Button label</Label>
              <Input
                id="form-button"
                value={values.buttonLabel}
                onChange={(e) => set("buttonLabel", e.target.value)}
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="form-accent">Accent color</Label>
              <div className="flex items-center gap-2">
                <input
                  id="form-accent"
                  type="color"
                  value={values.accentColor}
                  onChange={(e) => set("accentColor", e.target.value)}
                  className="h-9 w-12 cursor-pointer rounded-md border border-input bg-transparent"
                  aria-label="Accent color"
                />
                <Input
                  value={values.accentColor}
                  onChange={(e) => set("accentColor", e.target.value)}
                  className="font-mono"
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
                Adds a name field above the email. More friction, more data.
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

        <DialogFooter>
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
