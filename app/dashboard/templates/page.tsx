"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  ChevronDownIcon,
  Code2Icon,
  Edit2Icon,
  FileArchiveIcon,
  MailIcon,
  PlusIcon,
  SearchIcon,
  SendIcon,
  Share2Icon,
  Trash2Icon,
  UploadIcon,
} from "lucide-react";
import { IconStack } from "@/components/reui/icon-stack";

import {
  PREBUILT_TEMPLATES,
  TEMPLATE_CATEGORIES,
  blankDocument,
  documentFromHtml,
  type PrebuiltTemplate,
  type TemplateCategory,
} from "@/lib/email/templates";
import {
  normalizeDocument,
  STORAGE_KEY,
  type EmailDocument,
} from "@/lib/email/document";
import { compileEmailDocument } from "@/lib/email/compiler";
import { confirmDialog, promptDialog } from "@/components/app-dialogs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
} from "@/components/ui/card";
import {
  Dialog,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogPanel,
  DialogPopup,
  DialogTitle,
} from "@/components/ui/coss-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Spinner } from "@/components/ui/spinner";
import { PageLoader } from "@/components/bar-spinner";
import { cn } from "@/lib/utils";

type Tab = "letterstack" | "saved" | "recent";
type CategoryKey = TemplateCategory | "all";
type SavedTemplate = {
  id: string;
  name: string;
  updatedAt: string | Date;
  document: EmailDocument | null;
};

const TAB_KEYS: Tab[] = ["letterstack", "saved", "recent"];

export default function TemplatesPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [tab, setTab] = useState<Tab>("letterstack");
  const [category, setCategory] = useState<CategoryKey>("all");
  const [importOpen, setImportOpen] = useState(false);

  // The module sidebar is the only tab switcher (?tab=saved etc.) — no param
  // means the Gallery view.
  useEffect(() => {
    const requested = searchParams.get("tab") as Tab | null;
    setTab(requested && TAB_KEYS.includes(requested) ? requested : "letterstack");
  }, [searchParams]);

  const [savedTemplates, setSavedTemplates] = useState<SavedTemplate[]>([]);
  const [loadingSaved, setLoadingSaved] = useState(false);

  const loadSavedTemplates = async () => {
    setLoadingSaved(true);
    try {
      const r = await fetch("/api/templates");
      const data = await r.json();
      if (data.ok) {
        setSavedTemplates(data.templates);
      }
    } catch (err) {
      console.error("Failed to load saved templates:", err);
    } finally {
      setLoadingSaved(false);
    }
  };

  // Load on mount (not on tab switch) so the Saved tab count is right away.
  useEffect(() => {
    loadSavedTemplates();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function openDoc(doc: EmailDocument) {
    try {
      const existing = localStorage.getItem(STORAGE_KEY);
      if (existing && existing !== "null") {
        const ok = await confirmDialog({
          title: "Replace your current draft?",
          description:
            "Opening this template will replace the draft currently in the editor.",
          confirmLabel: "Open template",
        });
        if (!ok) return;
      }
      localStorage.setItem(STORAGE_KEY, JSON.stringify(doc));
    } catch {
      // If storage is unavailable, the editor falls back to its default document.
    }
    router.push("/editor");
  }

  const [copiedShareId, setCopiedShareId] = useState<string | null>(null);

  async function handleShareTemplate(id: string) {
    try {
      const r = await fetch(`/api/templates/${id}/share`, { method: "POST" });
      const data = await r.json();
      if (!data.ok) return;
      const url = `${window.location.origin}/templates/shared/${data.shareToken}`;
      await navigator.clipboard.writeText(url).catch(() =>
        promptDialog({
          title: "Copy this share link",
          description: "Clipboard access was blocked — copy it manually.",
          defaultValue: url,
        }),
      );
      setCopiedShareId(id);
      setTimeout(
        () => setCopiedShareId((current) => (current === id ? null : current)),
        2000,
      );
    } catch (err) {
      console.error("Failed to share template:", err);
    }
  }

  async function handleDeleteSavedTemplate(id: string) {
    const ok = await confirmDialog({
      title: "Delete this template?",
      description: "This permanently removes the template. This can't be undone.",
      confirmLabel: "Delete",
      destructive: true,
    });
    if (!ok) return;
    try {
      const r = await fetch(`/api/templates/${id}`, {
        method: "DELETE",
      });
      const data = await r.json();
      if (data.ok) {
        setSavedTemplates((prev) => prev.filter((t) => t.id !== id));
      }
    } catch (err) {
      console.error("Failed to delete template:", err);
    }
  }

  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return PREBUILT_TEMPLATES.filter(
      (template) =>
        (category === "all" || template.category === category) &&
        (!q ||
          `${template.title} ${template.description}`
            .toLowerCase()
            .includes(q)),
    );
  }, [category, query]);

  return (
    <div className="flex flex-col gap-6">
      {/* One toolbar: search + category filters on the left (gallery only),
          create actions pinned to the far right. The module sidebar owns the
          page title and the Gallery / Saved / Recently sent switch. */}
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
        {tab === "letterstack" && (
          <>
            <div className="relative w-full shrink-0 lg:w-64">
              <SearchIcon className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search templates..."
                className="pl-8"
              />
            </div>
            <div className="scrollbar-none flex min-w-0 flex-1 snap-x gap-1.5 overflow-x-auto pb-1">
              {TEMPLATE_CATEGORIES.map((item) => {
                const isActive = category === item.key;
                return (
                  <Button
                    key={item.key}
                    variant={isActive ? "default" : "outline"}
                    size="sm"
                    className="h-8 shrink-0 snap-start rounded-full px-3 text-xs"
                    onClick={() => setCategory(item.key)}
                  >
                    {item.label}
                  </Button>
                );
              })}
            </div>
          </>
        )}

        <div className="flex shrink-0 items-center gap-2 lg:ml-auto">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline">
                <Code2Icon data-icon="inline-start" />
                Code your own
                <ChevronDownIcon data-icon="inline-end" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuItem onClick={() => setImportOpen(true)}>
                <Code2Icon />
                Import HTML
              </DropdownMenuItem>
              <DropdownMenuItem disabled>
                <FileArchiveIcon />
                Import ZIP
                <Badge variant="outline" className="ml-auto text-[10px] px-1.5 py-0.5">
                  Soon
                </Badge>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <Button onClick={() => openDoc(blankDocument())}>
            <PlusIcon data-icon="inline-start" />
            Create from scratch
          </Button>
        </div>
      </div>

      <Tabs value={tab} onValueChange={(value) => setTab(value as Tab)} className="gap-5">

        <TabsContent value="saved" className="pt-0">
          <SavedTab
            loading={loadingSaved}
            templates={savedTemplates}
            onDelete={handleDeleteSavedTemplate}
            onShare={handleShareTemplate}
            copiedShareId={copiedShareId}
            onEditTemplate={(id) => router.push(`/editor/template/${id}`)}
          />
        </TabsContent>

        <TabsContent value="recent" className="pt-0">
          <RecentlySentTab />
        </TabsContent>

        <TabsContent value="letterstack" className="pt-0">

        {/* Templates Grid */}
        {filtered.length > 0 ? (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
            {filtered.map((template) => (
              <TemplateCard
                key={template.id}
                template={template}
                onOpen={() => openDoc(template.build())}
              />
            ))}
          </div>
        ) : (
          <Empty className="py-12 border border-dashed rounded-xl">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <MailIcon />
              </EmptyMedia>
              <EmptyTitle>No templates found</EmptyTitle>
              <EmptyDescription>
                Try a different search or template category.
              </EmptyDescription>
            </EmptyHeader>
          </Empty>
        )}
        </TabsContent>
      </Tabs>

      <ImportHtmlDialog
        open={importOpen}
        onOpenChange={setImportOpen}
        onImport={(html) => {
          // Close this dialog BEFORE openDoc, which raises a "replace your
          // current draft?" confirm whenever the editor already holds one.
          // Stacked modals leave that confirm portaled outside this dialog's
          // focus trap — it renders, but clicks never reach it, so the import
          // just appears to do nothing.
          setImportOpen(false);
          openDoc(documentFromHtml(html));
        }}
      />
    </div>
  );
}

type SentCampaign = {
  id: string;
  name: string;
  subject: string;
  status: string;
  sentAt: string | null;
  sentCount: number;
  audienceCount: number;
};

/** Sent campaigns as reusable starting points — one click clones to a draft. */
function RecentlySentTab() {
  const router = useRouter();
  const [campaigns, setCampaigns] = useState<SentCampaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [reusingId, setReusingId] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/campaigns")
      .then((r) => r.json())
      .then((data) => {
        if (data.ok) {
          setCampaigns(
            (data.campaigns as SentCampaign[]).filter(
              (c) => c.status === "sent" || c.status === "sending",
            ),
          );
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  async function reuse(id: string) {
    setReusingId(id);
    try {
      const r = await fetch(`/api/campaigns/${id}/reuse`, { method: "POST" });
      const data = await r.json();
      if (data.ok) {
        router.push(`/dashboard/campaigns/${data.id}`);
        return;
      }
    } catch {
      // fall through to reset
    }
    setReusingId(null);
  }

  if (loading) {
    return (
      <PageLoader className="min-h-0 py-12" label="Loading sent campaigns..." />
    );
  }

  if (campaigns.length === 0) {
    return (
      <Empty className="rounded-xl border border-dashed py-12">
        <EmptyHeader>
          <EmptyMedia>
            <IconStack aria-hidden="true" className="h-24 w-22">
              <SendIcon className="size-5" />
            </IconStack>
          </EmptyMedia>
          <EmptyTitle>Nothing sent yet</EmptyTitle>
          <EmptyDescription>
            Once a campaign is sent, it shows up here so you can reuse it as a
            starting point.
          </EmptyDescription>
        </EmptyHeader>
      </Empty>
    );
  }

  return (
    <div className="overflow-hidden rounded-xl border border-border">
      <div className="divide-y divide-border">
        {campaigns.map((campaign) => (
          <div
            key={campaign.id}
            className="flex items-center justify-between gap-3 px-4 py-3"
          >
            <button
              type="button"
              className="min-w-0 flex-1 text-left"
              onClick={() => router.push(`/dashboard/campaigns/${campaign.id}`)}
            >
              <span className="block truncate text-sm font-medium">
                {campaign.name || "Untitled Campaign"}
              </span>
              <span className="block truncate text-xs text-muted-foreground">
                {campaign.subject || "No subject"}
                {campaign.sentAt &&
                  ` · sent ${new Date(campaign.sentAt).toLocaleDateString()}`}
                {` · ${campaign.sentCount}/${campaign.audienceCount} delivered to`}
              </span>
            </button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => reuse(campaign.id)}
              disabled={reusingId !== null}
            >
              {reusingId === campaign.id ? (
                <Spinner data-icon="inline-start" />
              ) : (
                <PlusIcon data-icon="inline-start" />
              )}
              Reuse
            </Button>
          </div>
        ))}
      </div>
    </div>
  );
}

function TemplateCard({
  template,
  onOpen,
}: {
  template: PrebuiltTemplate;
  onOpen: () => void;
}) {
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onOpen}
      onKeyDown={(event) => {
        if (event.key === "Enter") onOpen();
      }}
      className="group cursor-pointer"
    >
      <div className="relative overflow-hidden rounded-2xl border border-border/60 bg-muted/40 transition-colors duration-300 group-hover:border-muted-foreground/40">
        <TemplateThumb template={template} />
        {/* Hover Overlay */}
        <div className="absolute inset-0 flex items-center justify-center bg-background/60 opacity-0 backdrop-blur-[2px] transition-all duration-300 group-hover:opacity-100">
          <Button size="sm" onClick={(e) => {
            e.stopPropagation();
            onOpen();
          }} className="shadow-lg transform translate-y-2 transition-transform duration-300 group-hover:translate-y-0">
            <PlusIcon data-icon="inline-start" />
            Use template
          </Button>
        </div>
      </div>
      <div className="mt-2.5 flex items-start justify-between gap-2 px-1">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-foreground">
            {template.title}
          </p>
          <p className="truncate font-mono text-xs text-muted-foreground">
            {template.id}
          </p>
        </div>
        <Badge variant="secondary" className="mt-0.5 shrink-0 text-[10px] px-1.5 py-0">
          Email
        </Badge>
      </div>
    </div>
  );
}

/**
 * Live thumbnail, Resend-style: the compiled email renders as a white sheet
 * that peeks in from the top of the tile with side margins and is cropped at
 * the bottom — only the top of the email shows. Real compiled HTML in a
 * sandboxed iframe, no screenshot pipeline. Inert to the page so clicking
 * the card still works.
 */
function HtmlThumb({ html, title }: { html: string; title: string }) {
  return (
    <div className="pointer-events-none relative aspect-[16/11] w-full select-none">
      <div className="absolute inset-x-8 top-7 bottom-0 overflow-hidden rounded-t-md bg-white shadow-[0_8px_32px_rgba(0,0,0,0.35)]">
        <iframe
          title={`Preview of ${title}`}
          srcDoc={html}
          sandbox=""
          scrolling="no"
          tabIndex={-1}
          aria-hidden
          className="absolute left-0 top-0 origin-top-left border-0"
          style={{ width: "250%", height: "800%", transform: "scale(0.4)" }}
        />
      </div>
    </div>
  );
}

function TemplateThumb({ template }: { template: PrebuiltTemplate }) {
  const html = useMemo(
    () => compileEmailDocument(template.build()).html,
    [template],
  );

  return <HtmlThumb html={html} title={template.title} />;
}

function SavedTemplateThumb({ template }: { template: SavedTemplate }) {
  const html = useMemo(() => {
    if (!template.document) return null;
    try {
      return compileEmailDocument(normalizeDocument(template.document)).html;
    } catch {
      return null; // partial/legacy document — fall back to the empty state
    }
  }, [template.document]);

  if (!html) {
    return (
      <div className="flex aspect-[16/11] w-full items-center justify-center">
        <MailIcon className="size-8 text-muted-foreground/40" />
      </div>
    );
  }
  return <HtmlThumb html={html} title={template.name} />;
}

function SavedTemplateCard({
  template,
  onOpen,
  onDelete,
  onShare,
  shareCopied,
}: {
  template: SavedTemplate;
  onOpen: () => void;
  onDelete: () => void;
  onShare: () => void;
  shareCopied: boolean;
}) {
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onOpen}
      className="group cursor-pointer"
    >
      <div className="relative overflow-hidden rounded-2xl border border-border/60 bg-muted/40 transition-colors duration-300 group-hover:border-muted-foreground/40">
        <SavedTemplateThumb template={template} />

        {/* Hover Overlay */}
        <div className="absolute inset-0 flex items-center justify-center bg-background/60 opacity-0 backdrop-blur-[2px] transition-all duration-300 group-hover:opacity-100">
          <Button size="sm" onClick={(e) => {
            e.stopPropagation();
            onOpen();
          }} className="shadow-lg transform translate-y-2 transition-transform duration-300 group-hover:translate-y-0">
            <Edit2Icon className="size-3.5" data-icon="inline-start" />
            Edit template
          </Button>
        </div>
      </div>
      <div className="mt-2.5 flex items-start justify-between gap-2 px-1">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-foreground">
            {template.name}
          </p>
          <p className="truncate text-xs text-muted-foreground">
            Edited {new Date(template.updatedAt).toLocaleDateString()}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          {shareCopied && (
            <span className="text-[10px] font-medium text-primary">
              Link copied!
            </span>
          )}
          <Button
            variant="ghost"
            size="icon-sm"
            className="size-7 p-0 text-muted-foreground hover:text-foreground"
            title="Copy share link"
            onClick={(e) => {
              e.stopPropagation();
              onShare();
            }}
          >
            <Share2Icon className="size-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            className="hover:bg-destructive/10 hover:text-destructive size-7 p-0 text-muted-foreground"
            onClick={(e) => {
              e.stopPropagation();
              onDelete();
            }}
          >
            <Trash2Icon className="size-3.5" />
          </Button>
        </div>
      </div>
    </div>
  );
}

function SavedTab({
  loading,
  templates,
  onDelete,
  onShare,
  copiedShareId,
  onEditTemplate,
}: {
  loading: boolean;
  templates: SavedTemplate[];
  onDelete: (id: string) => void;
  onShare: (id: string) => void;
  copiedShareId: string | null;
  onEditTemplate: (id: string) => void;
}) {
  return (
    <div className="flex flex-col gap-6 w-full py-2">
      {loading ? (
        <PageLoader className="min-h-0 py-12" label="Loading templates..." />
      ) : templates.length > 0 ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
          {templates.map((template) => (
            <SavedTemplateCard
              key={template.id}
              template={template}
              onOpen={() => onEditTemplate(template.id)}
              onDelete={() => onDelete(template.id)}
              onShare={() => onShare(template.id)}
              shareCopied={copiedShareId === template.id}
            />
          ))}
        </div>
      ) : (
        <Card className="border-dashed border-2">
          <CardContent className="p-0">
            <Empty className="border-0 py-12">
              <EmptyHeader>
                <EmptyMedia>
                  <IconStack aria-hidden="true" className="h-24 w-22">
                    <MailIcon className="size-5" />
                  </IconStack>
                </EmptyMedia>
                <EmptyTitle>No saved templates</EmptyTitle>
                <EmptyDescription>
                  Create a custom template in the editor, and click &quot;Save
                  as template&quot; to see it here!
                </EmptyDescription>
              </EmptyHeader>
            </Empty>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function ImportHtmlDialog({
  open,
  onOpenChange,
  onImport,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImport: (html: string) => void;
}) {
  const [html, setHtml] = useState("");
  const [dragActive, setDragActive] = useState(false);
  const [mode, setMode] = useState<"upload" | "paste">("upload");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const canImport = html.trim().length > 0;

  function onFile(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    file.text().then((text) => {
      setHtml(text);
      setMode("paste");
    });
  }

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const file = e.dataTransfer.files[0];
      file.text().then((text) => {
        setHtml(text);
        setMode("paste");
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogPopup className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Import HTML</DialogTitle>
          <DialogDescription>
            Import your custom email HTML template. It opens in the editor as a custom block.
          </DialogDescription>
        </DialogHeader>

        <DialogPanel className="flex flex-col gap-4">
          <Tabs
            value={mode}
            onValueChange={(v) => setMode(v as "upload" | "paste")}
            className="w-full"
          >
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="upload">Upload HTML file</TabsTrigger>
              <TabsTrigger value="paste">Paste code</TabsTrigger>
            </TabsList>

            <TabsContent value="upload" className="pt-4">
              <div
                onDragEnter={handleDrag}
                onDragOver={handleDrag}
                onDragLeave={handleDrag}
                onDrop={handleDrop}
                className={cn(
                  "flex flex-col items-center justify-center border-2 border-dashed rounded-xl p-8 transition-colors duration-200 cursor-pointer text-center",
                  dragActive ? "border-primary bg-primary/5" : "border-border hover:bg-muted/30"
                )}
                onClick={() => fileInputRef.current?.click()}
              >
                <div className="flex size-10 items-center justify-center rounded-xl bg-muted text-muted-foreground mb-3">
                  <UploadIcon className="size-5" />
                </div>
                <p className="text-sm font-semibold text-foreground">Drag & drop your HTML file here</p>
                <p className="text-xs text-muted-foreground mt-1">or click to browse local files</p>
                <p className="text-[10px] text-muted-foreground/60 mt-3">Supports .html and .txt files</p>
              </div>
              <input
                ref={fileInputRef}
                id="html-import-file"
                type="file"
                accept=".html,text/html,.txt"
                className="hidden"
                onChange={onFile}
              />
            </TabsContent>

            <TabsContent value="paste" className="pt-4 flex flex-col gap-4">
              <FieldGroup>
                <Field>
                  <FieldLabel htmlFor="html-import">Email HTML Code</FieldLabel>
                  <Textarea
                    id="html-import"
                    value={html}
                    onChange={(event) => setHtml(event.target.value)}
                    placeholder="<table>...</table>"
                    spellCheck={false}
                    className="min-h-44 font-mono text-xs p-3 rounded-lg border border-border"
                  />
                  <FieldDescription>
                    Full HTML documents or smaller HTML body fragments are accepted.
                  </FieldDescription>
                </Field>
              </FieldGroup>
            </TabsContent>
          </Tabs>
        </DialogPanel>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={() => onImport(html)}
            disabled={!canImport}
          >
            Open in editor
          </Button>
        </DialogFooter>
      </DialogPopup>
    </Dialog>
  );
}

