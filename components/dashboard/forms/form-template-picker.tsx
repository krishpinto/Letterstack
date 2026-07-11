"use client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
      <DialogContent className="max-h-[88vh] gap-0 overflow-hidden p-0 sm:max-w-3xl">
        <DialogHeader className="border-b border-border px-6 py-4">
          <DialogTitle>Choose a starting point</DialogTitle>
          <DialogDescription>
            Pick a template to start from — you can customize everything after.
          </DialogDescription>
        </DialogHeader>

        <div className="grid max-h-[calc(88vh-6rem)] gap-4 overflow-y-auto p-6 sm:grid-cols-2 lg:grid-cols-3">
          {FORM_TEMPLATES.map((template) => (
            <button
              key={template.id}
              type="button"
              onClick={() => onSelect(template.settings)}
              className="group flex flex-col overflow-hidden rounded-xl border border-border bg-muted/30 text-left shadow-sm transition-all hover:border-primary hover:bg-muted/50 hover:shadow-md focus-visible:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
            >
              <FormPreview
                settings={template.settings}
                className="h-[210px] w-full border-b border-border"
              />
              <div className="p-3.5">
                <p className="text-sm font-semibold">{template.title}</p>
                <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
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
