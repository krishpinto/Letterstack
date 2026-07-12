"use client";

import { useState } from "react";
import {
  CheckIcon,
  CodeIcon,
  CopyIcon,
  ExternalLinkIcon,
  PencilIcon,
  Trash2Icon,
  UsersIcon,
} from "lucide-react";

import { confirmDialog } from "@/components/app-dialogs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { SignupFormRow } from "./types";

export function FormCard({
  form,
  baseUrl,
  onEdit,
  onDeleted,
}: {
  form: SignupFormRow;
  baseUrl: string;
  onEdit: (form: SignupFormRow) => void;
  onDeleted: (id: string) => void;
}) {
  const [copied, setCopied] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const hostedUrl = `${baseUrl}/s/${form.publicKey}`;
  const embedSnippet = `<script src="${baseUrl}/embed/${form.publicKey}" async></script>`;

  async function copy(key: string, text: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(key);
      setTimeout(
        () => setCopied((current) => (current === key ? null : current)),
        1500,
      );
    } catch {
      // Clipboard unavailable — nothing sensible to do.
    }
  }

  async function remove() {
    const ok = await confirmDialog({
      title: `Delete "${form.name}"?`,
      description:
        "Its hosted page and embed script stop working immediately. People already subscribed stay on your list.",
      confirmLabel: "Delete form",
      destructive: true,
    });
    if (!ok) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/forms/${form.id}`, { method: "DELETE" });
      const data = await res.json();
      if (data.ok) onDeleted(form.id);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-4">
        <div className="min-w-0">
          <CardTitle className="truncate">{form.name}</CardTitle>
          <CardDescription className="truncate">
            {form.headline}
          </CardDescription>
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          <Badge variant="outline" className="capitalize">
            {form.formType ?? "static"}
          </Badge>
          <Badge variant="secondary" className="gap-1">
            <UsersIcon className="size-3" />
            {form.subscriberCount}
            <span className="text-muted-foreground">
              {form.subscriberCount === 1 ? "subscriber" : "subscribers"}
            </span>
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="flex flex-col gap-4">
        {/* Embed snippet */}
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
            <CodeIcon className="size-3.5" />
            Embed on your site
          </div>
          <div className="flex items-stretch gap-2">
            <code className="min-w-0 flex-1 overflow-x-auto rounded-lg border border-border bg-muted/50 px-3 py-2 font-mono text-xs whitespace-nowrap">
              {embedSnippet}
            </code>
            <Button
              variant="outline"
              size="sm"
              className="shrink-0"
              onClick={() => void copy("embed", embedSnippet)}
            >
              {copied === "embed" ? (
                <CheckIcon data-icon="inline-start" />
              ) : (
                <CopyIcon data-icon="inline-start" />
              )}
              {copied === "embed" ? "Copied" : "Copy"}
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            Paste this one line wherever you want the form to appear.
          </p>
        </div>

        {/* Hosted link */}
        <div className="flex flex-col gap-2">
          <div className="text-xs font-medium text-muted-foreground">
            Or share a direct link
          </div>
          <div className="flex items-stretch gap-2">
            <code className="min-w-0 flex-1 overflow-x-auto rounded-lg border border-border bg-muted/50 px-3 py-2 font-mono text-xs whitespace-nowrap">
              {hostedUrl}
            </code>
            <Button
              variant="outline"
              size="sm"
              className="shrink-0"
              onClick={() => void copy("link", hostedUrl)}
            >
              {copied === "link" ? (
                <CheckIcon data-icon="inline-start" />
              ) : (
                <CopyIcon data-icon="inline-start" />
              )}
              {copied === "link" ? "Copied" : "Copy"}
            </Button>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-between gap-2 border-t border-border pt-3">
          <Button variant="ghost" size="sm" asChild>
            <a href={hostedUrl} target="_blank" rel="noreferrer">
              <ExternalLinkIcon data-icon="inline-start" />
              Preview
            </a>
          </Button>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => onEdit(form)}>
              <PencilIcon data-icon="inline-start" />
              Edit
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => void remove()}
              disabled={busy}
            >
              <Trash2Icon data-icon="inline-start" />
              Delete
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
