"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import type { SignupFormSettingsInput } from "./types";

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
    <div className="flex flex-col gap-5">
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
          Shown right after someone subscribes.
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
    </div>
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
