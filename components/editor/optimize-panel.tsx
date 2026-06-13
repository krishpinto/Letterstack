"use client";

import { HugeiconsIcon } from "@hugeicons/react";
import { CheckmarkCircle01Icon } from "@hugeicons/core-free-icons";
import { cn } from "@/lib/utils";
import type { EmailDocument } from "@/lib/email/document";

export function OptimizePanel({ document }: { document: EmailDocument }) {
  const checks = [
    { label: "Add a subject line",             done: Boolean(document.subject) },
    { label: "Add preview text",               done: Boolean(document.settings.previewText) },
    { label: "Add at least one content block", done: document.blocks.length > 0 },
    { label: "Include a footer / unsubscribe", done: document.blocks.some((b) => b.type === "footer") },
    { label: "Keep email under 100 KB",        done: true },
  ];
  const done = checks.filter((c) => c.done).length;

  return (
    <div className="flex flex-col overflow-auto">
      <div className="border-b px-4 py-3">
        <p className="text-sm font-semibold">Optimize</p>
        <p className="mt-0.5 text-xs text-muted-foreground">
          {done}/{checks.length} checks passed
        </p>
      </div>

      <div className="mx-4 mt-3 h-1.5 overflow-hidden rounded-full bg-muted">
        <div
          className="h-full rounded-full bg-emerald-500 transition-[width] duration-500"
          style={{ width: `${(done / checks.length) * 100}%` }}
        />
      </div>

      <div className="flex flex-col gap-0.5 p-4">
        {checks.map((check) => (
          <div key={check.label} className="flex items-start gap-3 rounded-lg px-2 py-2.5">
            <HugeiconsIcon
              icon={CheckmarkCircle01Icon}
              strokeWidth={check.done ? 2.5 : 1.5}
              className={cn(
                "mt-0.5 size-4 shrink-0 transition-colors",
                check.done ? "text-emerald-500" : "text-muted-foreground/30",
              )}
            />
            <span
              className={cn(
                "text-xs leading-snug",
                check.done ? "text-muted-foreground line-through" : "text-foreground",
              )}
            >
              {check.label}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
