"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ChevronDownIcon,
  Code2Icon,
  Edit2Icon,
  FileArchiveIcon,
  MailIcon,
  PlusIcon,
  Share2Icon,
  Trash2Icon,
  UploadIcon,
} from "lucide-react";

import {
  PREBUILT_TEMPLATES,
  TEMPLATE_CATEGORIES,
  blankDocument,
  documentFromHtml,
  type PrebuiltTemplate,
  type TemplateCategory,
} from "@/lib/email/templates";
import {
  STORAGE_KEY,
  type EmailBlock,
  type EmailDocument,
} from "@/lib/email/document";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import { Textarea } from "@/components/ui/textarea";
import { Spinner } from "@/components/ui/spinner";
import { cn } from "@/lib/utils";

type Tab = "letterstack" | "saved";
type CategoryKey = TemplateCategory | "all";
type SavedTemplate = {
  id: string;
  name: string;
  updatedAt: string | Date;
  document: EmailDocument | null;
};

export default function TemplatesPage() {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("letterstack");
  const [category, setCategory] = useState<CategoryKey>("all");
  const [importOpen, setImportOpen] = useState(false);

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

  function openDoc(doc: EmailDocument) {
    try {
      const existing = localStorage.getItem(STORAGE_KEY);
      if (existing && existing !== "null") {
        const ok = window.confirm(
          "Opening this will replace your current editor draft. Continue?",
        );
        if (!ok) return;
      }
      localStorage.setItem(STORAGE_KEY, JSON.stringify(doc));
      localStorage.setItem("letterstack-return-to", "/dashboard/templates");
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
      await navigator.clipboard.writeText(url).catch(() => {
        window.prompt("Copy this share link:", url);
      });
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
    if (!confirm("Are you sure you want to delete this template?")) return;
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

  const filtered = useMemo(
    () =>
      category === "all"
        ? PREBUILT_TEMPLATES
        : PREBUILT_TEMPLATES.filter((template) => template.category === category),
    [category],
  );

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex flex-col justify-between gap-3 md:flex-row md:items-end">
        <div>
          <h1 className="text-2xl font-semibold tracking-normal">Templates</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Start from a LetterStack template, your own HTML, or a blank canvas.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
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

      <Tabs value={tab} onValueChange={(value) => setTab(value as Tab)} className="flex flex-col gap-6">
        <TabsList variant="line">
          <TabsTrigger value="letterstack">
            LetterStack templates
            <Badge
              variant="outline"
              className="ml-1.5 px-1.5 py-0 text-[10px] font-normal tabular-nums"
            >
              {PREBUILT_TEMPLATES.length}
            </Badge>
          </TabsTrigger>
          <TabsTrigger value="saved">
            Saved
            <Badge
              variant="outline"
              className="ml-1.5 px-1.5 py-0 text-[10px] font-normal tabular-nums"
            >
              {loadingSaved ? "…" : savedTemplates.length}
            </Badge>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="letterstack" className="pt-4">
          <div className="flex flex-col gap-6 md:flex-row md:items-start">
            {/* Sidebar Category Selector (Desktop) */}
            <aside className="hidden w-56 shrink-0 flex-col gap-1 md:flex">
              <h2 className="px-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Categories</h2>
              {TEMPLATE_CATEGORIES.map((item) => {
                const isActive = category === item.key;
                const count = item.key === "all" 
                  ? PREBUILT_TEMPLATES.length 
                  : PREBUILT_TEMPLATES.filter((t) => t.category === item.key).length;
                
                return (
                  <Button
                    key={item.key}
                    variant={isActive ? "secondary" : "ghost"}
                    className={cn(
                      "justify-between font-semibold h-9 text-sm px-3",
                      isActive ? "bg-muted text-foreground" : "text-muted-foreground hover:text-foreground"
                    )}
                    onClick={() => setCategory(item.key)}
                  >
                    <span>{item.label}</span>
                    <Badge variant="outline" className="ml-auto text-[10px] px-1.5 py-0 pointer-events-none shrink-0 font-normal">
                      {count}
                    </Badge>
                  </Button>
                );
              })}
            </aside>

            {/* Mobile Category Selector */}
            <div className="flex flex-col gap-2 md:hidden w-full overflow-hidden">
              <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground px-1">Categories</h2>
              <div className="flex gap-1.5 overflow-x-auto pb-1.5 scrollbar-none snap-x">
                {TEMPLATE_CATEGORIES.map((item) => {
                  const isActive = category === item.key;
                  return (
                    <Button
                      key={item.key}
                      variant={isActive ? "default" : "outline"}
                      size="sm"
                      className="snap-start text-xs shrink-0 rounded-full h-8 px-3"
                      onClick={() => setCategory(item.key)}
                    >
                      {item.label}
                    </Button>
                  );
                })}
              </div>
            </div>

            {/* Templates Grid */}
            <div className="flex-1 min-w-0">
              {filtered.length > 0 ? (
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
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
                      Try choosing a different template category.
                    </EmptyDescription>
                  </EmptyHeader>
                </Empty>
              )}
            </div>
          </div>
        </TabsContent>

        <TabsContent value="saved" className="pt-4">
          <SavedTab
            loading={loadingSaved}
            templates={savedTemplates}
            onDelete={handleDeleteSavedTemplate}
            onShare={handleShareTemplate}
            copiedShareId={copiedShareId}
            onEditTemplate={(id) => router.push(`/editor/template/${id}`)}
          />
        </TabsContent>
      </Tabs>

      <ImportHtmlDialog
        open={importOpen}
        onOpenChange={setImportOpen}
        onImport={(html) => openDoc(documentFromHtml(html))}
      />
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
    <Card
      role="button"
      tabIndex={0}
      onClick={onOpen}
      onKeyDown={(event) => {
        if (event.key === "Enter") onOpen();
      }}
      className="cursor-pointer gap-0 py-0 transition-all duration-300 hover:shadow-md hover:border-muted-foreground/30 relative flex flex-col h-full rounded-xl overflow-hidden group border bg-card text-card-foreground"
    >
      <div className="group relative overflow-hidden rounded-t-xl border-b border-border bg-muted/30">
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
      <CardContent className="flex flex-1 flex-col gap-3 p-4">
        <div className="flex flex-col gap-1">
          <div className="font-semibold text-sm text-foreground">{template.title}</div>
          <p className="line-clamp-2 text-xs leading-relaxed text-muted-foreground mt-0.5">
            {template.description}
          </p>
        </div>
        <div className="mt-auto flex items-center gap-2 pt-2">
          <Badge variant="outline" className="text-[10px] px-1.5 py-0">
            <MailIcon className="size-3" />
            Email
          </Badge>
          <Badge variant="secondary" className="text-[10px] px-1.5 py-0 font-medium">Free</Badge>
        </div>
      </CardContent>
    </Card>
  );
}

function TemplateThumb({ template }: { template: PrebuiltTemplate }) {
  const doc = useMemo(() => template.build(), [template]);

  return (
    <div
      className="flex h-44 items-start justify-center overflow-hidden border-b border-border p-4 transition-transform duration-500 group-hover:scale-105"
      style={{ backgroundColor: doc.settings.backgroundColor }}
    >
      <div className="flex w-full max-w-44 flex-col gap-2 rounded-md bg-background p-3 shadow-sm ring-1 ring-foreground/10">
        {doc.blocks.slice(0, 6).map((block) => (
          <Silhouette key={block.id} block={block} accent={template.accent} />
        ))}
      </div>
    </div>
  );
}

function Silhouette({
  block,
  accent,
}: {
  block: EmailBlock;
  accent: string;
}) {
  switch (block.type) {
    case "logo":
      return <div className="h-2 w-12 rounded bg-muted-foreground/30" />;
    case "heading":
      return <div className="h-2.5 w-2/3 rounded bg-muted-foreground/50" />;
    case "text":
      return (
        <div className="flex flex-col gap-1">
          <div className="h-1.5 w-1/3 rounded bg-muted-foreground/30" />
          <div className="h-2 w-3/4 rounded bg-muted-foreground/50" />
          <div className="h-1.5 w-full rounded bg-muted" />
        </div>
      );
    case "paragraph":
      return (
        <div className="flex flex-col gap-1">
          <div className="h-1.5 w-full rounded bg-muted" />
          <div className="h-1.5 w-5/6 rounded bg-muted" />
        </div>
      );
    case "image":
      return <div className="h-12 w-full rounded bg-muted" />;
    case "articleCard":
      return (
        <div className="flex gap-2">
          <div className="h-8 w-10 shrink-0 rounded bg-muted" />
          <div className="flex flex-1 flex-col gap-1 pt-0.5">
            <div className="h-1.5 w-3/4 rounded bg-muted-foreground/50" />
            <div className="h-1.5 w-full rounded bg-muted" />
            <div className="h-1.5 w-2/3 rounded bg-muted" />
          </div>
        </div>
      );
    case "button":
      return (
        <div
          className="h-3 w-20 rounded"
          style={{ backgroundColor: accent }}
        />
      );
    case "divider":
      return <div className="h-px w-full bg-border" />;
    case "footer":
      return (
        <div className="flex flex-col gap-1 pt-1">
          <div className="h-1.5 w-1/2 rounded bg-muted" />
          <div className="h-1.5 w-1/3 rounded bg-muted" />
        </div>
      );
    default:
      return <div className="h-2 w-1/2 rounded bg-muted" />;
  }
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
    <Card
      role="button"
      tabIndex={0}
      onClick={onOpen}
      className="cursor-pointer gap-0 py-0 transition-all duration-300 hover:shadow-md hover:border-muted-foreground/30 relative flex flex-col h-full rounded-xl overflow-hidden group border bg-card text-card-foreground"
    >
      <div className="group relative overflow-hidden rounded-t-xl border-b border-border bg-muted/30">
        {/* Silhouette preview */}
        <div
          className="flex h-44 items-start justify-center overflow-hidden border-b border-border p-4 transition-transform duration-500 group-hover:scale-105"
          style={{ backgroundColor: template.document?.settings?.backgroundColor || "#f4f4f5" }}
        >
          <div className="flex w-full max-w-44 flex-col gap-2 rounded-md bg-background p-3 shadow-sm ring-1 ring-foreground/10">
            {template.document?.blocks?.slice(0, 6).map((block: EmailBlock) => (
              <Silhouette key={block.id} block={block} accent={template.document?.settings?.accentColor || "#18181b"} />
            ))}
          </div>
        </div>

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
      <CardContent className="flex flex-1 flex-col gap-3 p-4">
        <div className="flex flex-col gap-1 min-w-0">
          <div className="font-semibold text-sm text-foreground truncate">{template.name}</div>
          <p className="text-xs text-muted-foreground mt-0.5">
            Last edited {new Date(template.updatedAt).toLocaleDateString()}
          </p>
        </div>
        <div className="mt-auto flex items-center justify-between pt-2">
          <Badge variant="outline" className="text-[10px] px-1.5 py-0">
            Custom
          </Badge>
          <div className="flex items-center gap-1">
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
      </CardContent>
    </Card>
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
        <div className="flex justify-center items-center py-12 gap-2 text-muted-foreground text-sm">
          <Spinner />
          Loading templates...
        </div>
      ) : templates.length > 0 ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
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
          <CardContent className="flex flex-col items-center justify-center p-12 text-center">
            <div className="flex size-12 items-center justify-center rounded-full bg-muted text-muted-foreground mb-4">
              <MailIcon className="size-6" />
            </div>
            <h3 className="font-semibold text-base text-foreground">No saved templates</h3>
            <p className="text-sm text-muted-foreground mt-1 max-w-sm">
              Create a custom template in the editor, and click "Save as template" to see it here!
            </p>
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
      <DialogContent className="sm:max-w-lg p-6">
        <DialogHeader className="p-0 pb-4">
          <DialogTitle>Import HTML</DialogTitle>
          <DialogDescription>
            Import your custom email HTML template. It opens in the editor as a custom block.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4 py-2">
          <Tabs value={mode} onValueChange={(v) => setMode(v as "upload" | "paste")} className="w-full">
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
        </div>

        <DialogFooter className="p-0 pt-4">
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
      </DialogContent>
    </Dialog>
  );
}

