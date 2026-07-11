"use client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { FormPreview } from "./form-preview";
import { FORM_TEMPLATES } from "./templates";
import type { SignupFormSettingsInput } from "./types";

// Step one of creating a form: pick a starting preset. Selecting one hands its
// full settings to the create flow, which opens the editor dialog pre-filled.
export function FormTemplatePicker({
  open,
  onOpenChange,
  onSelect,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect: (settings: SignupFormSettingsInput) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>Choose a starting point</DialogTitle>
          <DialogDescription>
            Pick a template to start from — you can customize everything after.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-2 sm:grid-cols-2 lg:grid-cols-3">
          {FORM_TEMPLATES.map((template) => (
            <button
              key={template.id}
              type="button"
              onClick={() => onSelect(template.settings)}
              className={cn(
                "group flex flex-col overflow-hidden rounded-xl border border-border text-left transition-colors hover:border-primary",
              )}
            >
              <FormPreview
                settings={template.settings}
                className="h-40 w-full overflow-hidden border-b border-border"
              />
              <div className="p-3">
                <p className="text-sm font-semibold">{template.title}</p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {template.description}
                </p>
              </div>
            </button>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
