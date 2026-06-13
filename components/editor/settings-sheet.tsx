"use client";

import { HugeiconsIcon } from "@hugeicons/react";
import { Settings02Icon } from "@hugeicons/core-free-icons";
import { Button } from "@/components/ui/button";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import {
  touchDocument,
  type EmailDocument,
  type EmailDocumentSettings,
} from "@/lib/email/document";

export function GlobalSettingsSheet({
  document,
  onUpdateDocument,
}: {
  document: EmailDocument;
  onUpdateDocument: (updater: (current: EmailDocument) => EmailDocument) => void;
}) {
  const setSetting = <K extends keyof EmailDocumentSettings>(
    key: K,
    value: EmailDocumentSettings[K],
  ) => {
    onUpdateDocument((c) =>
      touchDocument({ ...c, settings: { ...c.settings, [key]: value } }),
    );
  };

  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button variant="outline" size="sm">
          <HugeiconsIcon icon={Settings02Icon} strokeWidth={2} data-icon="inline-start" />
          Settings
        </Button>
      </SheetTrigger>
      <SheetContent className="w-[380px] sm:max-w-[380px]">
        <SheetHeader>
          <SheetTitle>Campaign settings</SheetTitle>
          <SheetDescription>Subject line, sender info, and metadata.</SheetDescription>
        </SheetHeader>
        <ScrollArea className="min-h-0 flex-1 px-6 pb-6">
          <div className="flex flex-col gap-4 pt-2">
            <Field>
              <FieldLabel htmlFor="doc-name">Campaign name</FieldLabel>
              <Input
                id="doc-name"
                value={document.name}
                onChange={(e) =>
                  onUpdateDocument((c) => touchDocument({ ...c, name: e.target.value }))
                }
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="subject">Subject line</FieldLabel>
              <Input
                id="subject"
                value={document.subject}
                placeholder="e.g. Your June newsletter"
                onChange={(e) =>
                  onUpdateDocument((c) => touchDocument({ ...c, subject: e.target.value }))
                }
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="from-name">From name</FieldLabel>
              <Input
                id="from-name"
                value={document.fromName}
                onChange={(e) =>
                  onUpdateDocument((c) => touchDocument({ ...c, fromName: e.target.value }))
                }
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="from-email">From email</FieldLabel>
              <Input
                id="from-email"
                type="email"
                value={document.fromEmail}
                onChange={(e) =>
                  onUpdateDocument((c) => touchDocument({ ...c, fromEmail: e.target.value }))
                }
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="preview-text">Preview text</FieldLabel>
              <Textarea
                id="preview-text"
                rows={2}
                value={document.settings.previewText}
                placeholder="Shown in inbox below the subject line"
                onChange={(e) => setSetting("previewText", e.target.value)}
              />
            </Field>
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}
