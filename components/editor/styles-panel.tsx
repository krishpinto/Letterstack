"use client";

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  touchDocument,
  type EmailDocument,
  type EmailDocumentSettings,
} from "@/lib/email/document";
import { FONT_FAMILIES } from "./editor-types";

export function StylesPanel({
  document,
  onUpdateDocument,
}: {
  document: EmailDocument;
  onUpdateDocument: (updater: (current: EmailDocument) => EmailDocument) => void;
}) {
  const set = <K extends keyof EmailDocumentSettings>(
    key: K,
    value: EmailDocumentSettings[K],
  ) => {
    onUpdateDocument((c) =>
      touchDocument({ ...c, settings: { ...c.settings, [key]: value } }),
    );
  };
  const s = document.settings;

  return (
    <div className="flex flex-col overflow-auto">
      <div className="border-b px-4 py-3">
        <p className="text-sm font-semibold">Email styles</p>
        <p className="mt-0.5 text-xs text-muted-foreground">
          Edit the look of your entire email
        </p>
      </div>

      <Accordion type="multiple" defaultValue={["background"]} className="w-full">
        <AccordionItem value="background">
          <AccordionTrigger className="px-4 py-3 text-sm font-medium hover:no-underline">
            Background
          </AccordionTrigger>
          <AccordionContent className="px-4 pb-4">
            <div className="flex flex-col gap-3">
              <StyleColorRow
                label="Outer background"
                value={s.backgroundColor}
                onChange={(v) => set("backgroundColor", v)}
              />
              <StyleColorRow
                label="Email background"
                value={s.contentColor}
                onChange={(v) => set("contentColor", v)}
              />
            </div>
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="text">
          <AccordionTrigger className="px-4 py-3 text-sm font-medium hover:no-underline">
            Text
          </AccordionTrigger>
          <AccordionContent className="px-4 pb-4">
            <div className="flex flex-col gap-3">
              <Field>
                <FieldLabel>Font family</FieldLabel>
                <Select
                  value={s.fontFamily}
                  onValueChange={(v) => set("fontFamily", v)}
                >
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {FONT_FAMILIES.map((f) => (
                      <SelectItem key={f.value} value={f.value} className="text-xs">
                        {f.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <StyleColorRow
                label="Text color"
                value={s.textColor}
                onChange={(v) => set("textColor", v)}
              />
            </div>
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="link">
          <AccordionTrigger className="px-4 py-3 text-sm font-medium hover:no-underline">
            Link
          </AccordionTrigger>
          <AccordionContent className="px-4 pb-4">
            <StyleColorRow
              label="Link / accent color"
              value={s.accentColor}
              onChange={(v) => set("accentColor", v)}
            />
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="button">
          <AccordionTrigger className="px-4 py-3 text-sm font-medium hover:no-underline">
            Button
          </AccordionTrigger>
          <AccordionContent className="px-4 pb-4">
            <div className="flex flex-col gap-3">
              <StyleColorRow
                label="Background"
                value={s.accentColor}
                onChange={(v) => set("accentColor", v)}
              />
              <StyleSliderRow label="Border radius" value={s.buttonRadius}   min={0}  max={24} suffix="px" onChange={(v) => set("buttonRadius",   v)} />
              <StyleSliderRow label="Vert. padding"  value={s.buttonPaddingY} min={6}  max={28} suffix="px" onChange={(v) => set("buttonPaddingY", v)} />
              <StyleSliderRow label="Horiz. padding" value={s.buttonPaddingX} min={8}  max={40} suffix="px" onChange={(v) => set("buttonPaddingX", v)} />
              <StyleSliderRow label="Font size"      value={s.buttonFontSize} min={12} max={22} suffix="px" onChange={(v) => set("buttonFontSize",  v)} />
            </div>
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="divider">
          <AccordionTrigger className="px-4 py-3 text-sm font-medium hover:no-underline">
            Divider
          </AccordionTrigger>
          <AccordionContent className="px-4 pb-4">
            <p className="text-xs text-muted-foreground">
              1px solid line. Color inherits from the border token.
            </p>
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="layout">
          <AccordionTrigger className="px-4 py-3 text-sm font-medium hover:no-underline">
            Layout
          </AccordionTrigger>
          <AccordionContent className="px-4 pb-4">
            <div className="flex flex-col gap-3">
              <StyleSliderRow label="Max width"    value={s.maxWidth} min={480} max={760} suffix="px" onChange={(v) => set("maxWidth", v)} />
              <StyleSliderRow label="Side padding" value={s.padding}  min={0}   max={48}  suffix="px" onChange={(v) => set("padding",  v)} />
              <StyleSliderRow label="Radius"       value={s.radius}   min={0}   max={24}  suffix="px" onChange={(v) => set("radius",   v)} />
            </div>
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    </div>
  );
}

export function StyleColorRow({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="flex items-center gap-2">
      <label className="w-28 shrink-0 text-xs text-muted-foreground">{label}</label>
      <div className="flex flex-1 items-center gap-1.5">
        <input
          type="color"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="h-7 w-7 shrink-0 cursor-pointer rounded border p-0.5"
        />
        <Input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="h-7 flex-1 font-mono text-xs"
        />
      </div>
    </div>
  );
}

export function StyleSliderRow({
  label,
  value,
  min,
  max,
  suffix,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  suffix: string;
  onChange: (v: number) => void;
}) {
  return (
    <div className="flex items-center gap-2">
      <label className="w-28 shrink-0 text-xs text-muted-foreground">{label}</label>
      <input
        type="range"
        value={value}
        min={min}
        max={max}
        onChange={(e) => onChange(Number(e.target.value))}
        className="h-1.5 flex-1 cursor-pointer accent-primary"
      />
      <span className="w-10 shrink-0 text-right text-xs text-muted-foreground">
        {value}{suffix}
      </span>
    </div>
  );
}
