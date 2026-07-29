"use client";

import * as React from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import { ComputerIcon, EyeIcon, SmartPhone01Icon } from "@hugeicons/core-free-icons";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogHeader,
  DialogPopup,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/coss-dialog";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { cn } from "@/lib/utils";
import type { PreviewMode } from "./editor-types";

export function PreviewDialog({
  compiled,
}: {
  compiled: { html: string; text: string };
}) {
  const [mode, setMode] = React.useState<PreviewMode>("desktop");

  return (
    <Dialog>
      {/* Base UI trigger composes via render, not Radix asChild. */}
      <DialogTrigger render={<Button variant="outline" size="sm" />}>
        <HugeiconsIcon icon={EyeIcon} strokeWidth={2} data-icon="inline-start" />
        Preview
      </DialogTrigger>
      <DialogPopup className="h-[90vh] sm:max-w-4xl">
        <DialogHeader>
          <DialogTitle>Email preview</DialogTitle>
        </DialogHeader>
        <div className="min-h-0 flex-1 px-6 pb-6">
          <PreviewPane html={compiled.html} mode={mode} onModeChange={setMode} />
        </div>
      </DialogPopup>
    </Dialog>
  );
}

function PreviewPane({
  html,
  mode,
  onModeChange,
}: {
  html: string;
  mode: PreviewMode;
  onModeChange: (m: PreviewMode) => void;
}) {
  const iframeRef = React.useRef<HTMLIFrameElement>(null);
  const [iframeHeight, setIframeHeight] = React.useState(620);

  const previewHtml = React.useMemo(() => {
    if (html.includes("<head>")) return html.replace("<head>", '<head><base href="/">');
    return `<base href="/">${html}`;
  }, [html]);

  const measureIframe = React.useCallback(() => {
    try {
      const doc = iframeRef.current?.contentDocument;
      const h = Math.max(
        doc?.documentElement.scrollHeight ?? 0,
        doc?.body.scrollHeight ?? 0,
      );
      if (h > 0) setIframeHeight(Math.max(620, h));
    } catch {
      setIframeHeight(620);
    }
  }, []);

  React.useEffect(() => {
    const t = window.setTimeout(measureIframe, 50);
    return () => window.clearTimeout(t);
  }, [previewHtml, measureIframe]);

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex items-center gap-2 border-b px-4 py-2.5">
        <ToggleGroup
          type="single"
          value={mode}
          onValueChange={(v) => { if (v) onModeChange(v as PreviewMode); }}
          variant="outline"
        >
          <ToggleGroupItem value="desktop">
            <HugeiconsIcon icon={ComputerIcon} strokeWidth={2} data-icon="inline-start" />
            Desktop
          </ToggleGroupItem>
          <ToggleGroupItem value="mobile">
            <HugeiconsIcon icon={SmartPhone01Icon} strokeWidth={2} data-icon="inline-start" />
            Mobile
          </ToggleGroupItem>
        </ToggleGroup>
        <Badge variant="outline" className="ml-auto text-xs">
          Live preview
        </Badge>
      </div>

      <div className="min-h-0 flex-1 overflow-auto bg-zinc-100 p-4">
        <div
          className={cn(
            "mx-auto overflow-hidden rounded-xl border bg-white shadow-md transition-[max-width] duration-300",
            mode === "mobile" ? "max-w-[390px]" : "max-w-[720px]",
          )}
        >
          <div className="border-b bg-white px-4 py-3">
            <div className="flex items-center gap-2.5">
              <div className="flex size-8 items-center justify-center rounded-full bg-zinc-900 text-xs font-bold text-white">
                C
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold">Newsletter</p>
                <p className="truncate text-xs text-muted-foreground">
                  newsletter@example.com
                </p>
              </div>
            </div>
          </div>
          <div className="bg-zinc-100 p-3">
            <iframe
              ref={iframeRef}
              title="Email preview"
              srcDoc={previewHtml}
              scrolling="no"
              sandbox="allow-same-origin"
              onLoad={measureIframe}
              className="w-full rounded-lg border bg-white shadow-sm"
              style={{ height: iframeHeight }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
