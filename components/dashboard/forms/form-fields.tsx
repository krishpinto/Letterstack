"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import type { SignupFormSettingsInput } from "./types";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

// The editable fields for a signup form — shared by the full-page editor
// (/editor/form/[id]) so the controls live in one place.
export function FormFields({
  values,
  set,
}: {
  values: SignupFormSettingsInput;
  set: <K extends keyof SignupFormSettingsInput>(
    key: K,
    value: SignupFormSettingsInput[K],
  ) => void;
}) {
  return (
    <Accordion type="single" defaultValue="general-settings" className="w-full border-none">
      {/* 1. General Settings */}
      <AccordionItem value="general-settings" className="border-none">
        <AccordionTrigger className="text-sm font-semibold hover:no-underline py-2.5 px-0.5 text-foreground/90">
          General Settings
        </AccordionTrigger>
        <AccordionContent className="flex flex-col gap-4 pt-1 pb-4 px-0.5">
          <div className="flex flex-col gap-2">
            <Label htmlFor="form-name" className="text-xs font-semibold text-foreground/80">Form name</Label>
            <Input
              id="form-name"
              value={values.name}
              onChange={(e) => set("name", e.target.value)}
              placeholder="Website footer form"
              className="h-8.5 text-xs bg-muted/10"
            />
            <p className="text-[10px] text-muted-foreground/70">
              Internal label — only you see this.
            </p>
          </div>

          <div className="flex items-center justify-between rounded-lg p-3 bg-muted/15 mt-1">
            <div>
              <Label htmlFor="form-collect-name" className="text-xs font-semibold text-foreground/80">Ask for a name</Label>
              <p className="text-[10px] text-muted-foreground/70 mt-0.5">
                Adds a name field above the email.
              </p>
            </div>
            <Switch
              id="form-collect-name"
              checked={!!values.collectName}
              onCheckedChange={(checked) => set("collectName", checked)}
            />
          </div>
        </AccordionContent>
      </AccordionItem>

      {/* 2. Form Content */}
      <AccordionItem value="content" className="border-none">
        <AccordionTrigger className="text-sm font-semibold hover:no-underline py-2.5 px-0.5 text-foreground/90">
          Form Content
        </AccordionTrigger>
        <AccordionContent className="flex flex-col gap-4 pt-1 pb-4 px-0.5">
          <div className="flex flex-col gap-2">
            <Label htmlFor="form-headline" className="text-xs font-semibold text-foreground/80">Headline</Label>
            <Input
              id="form-headline"
              value={values.headline}
              onChange={(e) => set("headline", e.target.value)}
              className="h-8.5 text-xs bg-muted/10"
            />
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="form-description" className="text-xs font-semibold text-foreground/80">Description</Label>
            <Textarea
              id="form-description"
              rows={2}
              value={values.description}
              onChange={(e) => set("description", e.target.value)}
              className="text-xs bg-muted/10 resize-none"
            />
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="form-button" className="text-xs font-semibold text-foreground/80">Button label</Label>
            <Input
              id="form-button"
              value={values.buttonLabel}
              onChange={(e) => set("buttonLabel", e.target.value)}
              className="h-8.5 text-xs bg-muted/10"
            />
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="form-success" className="text-xs font-semibold text-foreground/80">Success message</Label>
            <Textarea
              id="form-success"
              rows={2}
              value={values.successMessage}
              onChange={(e) => set("successMessage", e.target.value)}
              className="text-xs bg-muted/10 resize-none"
            />
            <p className="text-[10px] text-muted-foreground/70">
              Shown right after someone subscribes.
            </p>
          </div>
        </AccordionContent>
      </AccordionItem>

      {/* 3. Design & Styles */}
      <AccordionItem value="styles" className="border-none">
        <AccordionTrigger className="text-sm font-semibold hover:no-underline py-2.5 px-0.5 text-foreground/90">
          Design & Styles
        </AccordionTrigger>
        <AccordionContent className="flex flex-col gap-4 pt-1 pb-4 px-0.5">
          <div className="flex flex-col gap-3.5 rounded-lg p-3 bg-muted/15">
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

            <div className="flex items-center justify-between gap-3 pt-1">
              <Label htmlFor="form-accent" className="text-xs font-normal text-muted-foreground">
                Accent color
              </Label>
              <div className="flex items-center gap-2">
                <input
                  id="form-accent"
                  type="color"
                  value={values.accentColor}
                  onChange={(e) => set("accentColor", e.target.value)}
                  className="h-7 w-9 cursor-pointer rounded-md border border-input bg-transparent"
                  aria-label="Accent color"
                />
                <Input
                  value={values.accentColor}
                  onChange={(e) => set("accentColor", e.target.value)}
                  className="h-7 w-20 font-mono text-[10px]"
                />
              </div>
            </div>
          </div>
        </AccordionContent>
      </AccordionItem>
    </Accordion>
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
