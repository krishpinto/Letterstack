"use client";

import * as React from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import { RangeSlider } from "@/components/motion/range-slider";
import { cn } from "@/lib/utils";

export type ToggleOption = {
  value: string;
  label: string;
  icon?: React.ComponentProps<typeof HugeiconsIcon>["icon"];
};

/**
 * Compact, full-width, rounded segmented control on top of shadcn ToggleGroup —
 * the editor sidebar's shared "pick one" control, so alignment, heading level,
 * on/off pairs, and theme toggles all read the same. Icon-only when an option
 * supplies an icon.
 */
export function OptionToggle({
  value,
  onChange,
  options,
  ariaLabel,
  className,
}: {
  value: string;
  onChange: (value: string) => void;
  options: ToggleOption[];
  ariaLabel?: string;
  className?: string;
}) {
  return (
    <ToggleGroup
      type="single"
      value={value}
      onValueChange={(v) => {
        if (v) onChange(v);
      }}
      variant="outline"
      size="sm"
      aria-label={ariaLabel}
      className={cn("w-full rounded-full", className)}
    >
      {options.map((option) => (
        <ToggleGroupItem
          key={option.value}
          value={option.value}
          aria-label={option.label}
          title={option.label}
          className="flex-1 text-xs font-medium first:rounded-l-full last:rounded-r-full"
        >
          {option.icon ? (
            <HugeiconsIcon icon={option.icon} strokeWidth={2} data-icon="icon" />
          ) : (
            option.label
          )}
        </ToggleGroupItem>
      ))}
    </ToggleGroup>
  );
}

/**
 * Stacked label + value readout above the motion RangeSlider. Shared by the
 * block inspector and the theme panel so every slider looks the same.
 */
export function SliderField({
  label,
  value,
  min,
  max,
  step = 1,
  suffix = "",
  description,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  suffix?: string;
  description?: string;
  onChange: (v: number) => void;
}) {
  return (
    <Field>
      <div className="flex items-center justify-between gap-2">
        <FieldLabel>{label}</FieldLabel>
        <span className="text-xs tabular-nums text-muted-foreground">
          {value}
          {suffix}
        </span>
      </div>
      <RangeSlider
        value={value}
        min={min}
        max={max}
        step={step}
        onValueChange={onChange}
        aria-label={label}
        className="rounded-full"
      />
      {description && <FieldDescription>{description}</FieldDescription>}
    </Field>
  );
}
