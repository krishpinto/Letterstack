"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  FilterIcon,
  MailIcon,
  MoreHorizontalIcon,
  PlusIcon,
  SearchIcon,
  Trash2Icon,
} from "lucide-react";

import { PREBUILT_TEMPLATES } from "@/lib/email/templates";
import { onOrganizationChanged } from "@/lib/dashboard-events";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { confirmDialog } from "@/components/app-dialogs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
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
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { IconStack } from "@/components/reui/icon-stack";
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import { Spinner } from "@/components/ui/spinner";
import { PageLoader } from "@/components/bar-spinner";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

type Campaign = {
  id: string;
  name: string;
  subject: string;
  fromName: string;
  fromEmail: string;
  status: string;
  createdAt: string;
  scheduledAt: string | null;
  sentAt: string | null;
  audienceCount: number;
  sentCount: number;
};

type StatusKey = "all" | "draft" | "scheduled" | "sending" | "sent";

const STATUS_LABELS: Record<StatusKey, string> = {
  all: "All",
  draft: "Draft",
  scheduled: "Scheduled",
  sending: "Sending",
  sent: "Sent",
};

const STATUS_BADGE_VARIANTS = {
  draft: "secondary",
  scheduled: "outline",
  sending: "outline",
  sent: "default",
} as const;

const STATUS_DESCRIPTIONS: Record<Exclude<StatusKey, "all">, string> = {
  draft: "Not sent yet",
  scheduled: "Waiting for send time",
  sending: "Queued / in progress",
  sent: "Completed",
};

const PAGE_SIZE = 8;

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

const STATUS_KEYS: StatusKey[] = ["all", "draft", "scheduled", "sending", "sent"];

export default function CampaignsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [list, setList] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [page, setPage] = useState(1);

  // The status filter lives in the URL (?status=draft) so the module sidebar
  // views (Drafts / Scheduled / Sent) can drive it and deep links work.
  const statusParam = searchParams.get("status") as StatusKey | null;
  const statusFilter: StatusKey =
    statusParam && STATUS_KEYS.includes(statusParam) ? statusParam : "all";

  const setStatusFilter = useCallback(
    (next: StatusKey) => {
      router.replace(
        next === "all"
          ? "/dashboard/campaigns"
          : `/dashboard/campaigns?status=${next}`,
      );
    },
    [router],
  );

  const loadCampaigns = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/campaigns");
      const data = await response.json();
      setList(data.ok ? data.campaigns : []);
    } catch {
      setList([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadCampaigns();
  }, [loadCampaigns]);

  useEffect(() => {
    return onOrganizationChanged(() => {
      setSelected(new Set());
      setQuery("");
      setStatusFilter("all");
      setPage(1);
      void loadCampaigns();
    });
  }, [loadCampaigns]);

  const counts = useMemo(() => {
    const c: Record<StatusKey, number> = {
      all: list.length,
      draft: 0,
      scheduled: 0,
      sending: 0,
      sent: 0,
    };

    list.forEach((item) => {
      if (
        item.status === "draft" ||
        item.status === "scheduled" ||
        item.status === "sending" ||
        item.status === "sent"
      ) {
        c[item.status]++;
      }
    });

    return c;
  }, [list]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();

    return list.filter((campaign) => {
      if (statusFilter !== "all" && campaign.status !== statusFilter) {
        return false;
      }

      if (
        q &&
        !`${campaign.name} ${campaign.subject}`.toLowerCase().includes(q)
      ) {
        return false;
      }

      return true;
    });
  }, [list, query, statusFilter]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pageStart = (page - 1) * PAGE_SIZE;
  const pageItems = filtered.slice(pageStart, pageStart + PAGE_SIZE);
  const firstShown = filtered.length === 0 ? 0 : pageStart + 1;
  const lastShown = Math.min(pageStart + pageItems.length, filtered.length);

  useEffect(() => {
    setPage(1);
  }, [query, statusFilter]);

  useEffect(() => {
    if (page > pageCount) {
      setPage(pageCount);
    }
  }, [page, pageCount]);

  const allVisibleSelected =
    pageItems.length > 0 &&
    pageItems.every((campaign) => selected.has(campaign.id));
  const someVisibleSelected = pageItems.some((campaign) =>
    selected.has(campaign.id),
  );

  function toggleOne(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAll() {
    setSelected((prev) => {
      const next = new Set(prev);
      const ids = pageItems.map((campaign) => campaign.id);
      const allOn = ids.length > 0 && ids.every((id) => next.has(id));
      ids.forEach((id) => (allOn ? next.delete(id) : next.add(id)));
      return next;
    });
  }

  async function deleteCampaigns(ids: string[]) {
    const results = await Promise.all(
      ids.map((id) =>
        fetch(`/api/campaigns/${id}`, { method: "DELETE" })
          .then((r) => r.json())
          .then((d) => ({ id, ok: Boolean(d.ok) }))
          .catch(() => ({ id, ok: false })),
      ),
    );
    const deleted = new Set(
      results.filter((result) => result.ok).map((result) => result.id),
    );

    setList((prev) => prev.filter((campaign) => !deleted.has(campaign.id)));
    setSelected((prev) => {
      const next = new Set(prev);
      deleted.forEach((id) => next.delete(id));
      return next;
    });
  }

  async function handleBulkDelete() {
    const ids = [...selected];
    if (ids.length === 0) return;

    const ok = await confirmDialog({
      title: `Delete ${ids.length} campaign${ids.length === 1 ? "" : "s"}?`,
      description: "This cannot be undone.",
      confirmLabel: "Delete",
      destructive: true,
    });
    if (!ok) return;

    await deleteCampaigns(ids);
  }

  async function handleRowDelete(campaign: Campaign) {
    const ok = await confirmDialog({
      title: `Delete ${campaign.name || "this campaign"}?`,
      description: "This cannot be undone.",
      confirmLabel: "Delete",
      destructive: true,
    });
    if (!ok) return;

    await deleteCampaigns([campaign.id]);
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col justify-between gap-3 md:flex-row md:items-end">
        <div>
          <h1 className="text-2xl font-semibold tracking-normal">Campaigns</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Create, review, and monitor email campaigns from one workspace.
          </p>
        </div>
        <Button onClick={() => setCreateOpen(true)}>
          <PlusIcon data-icon="inline-start" />
          Create
        </Button>
      </div>

      <section className="flex flex-col gap-4">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <p className="text-sm text-muted-foreground">
            {filtered.length} of {list.length} campaign
            {list.length === 1 ? "" : "s"} shown
          </p>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <div className="relative min-w-0 sm:w-72">
              <SearchIcon className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search campaigns..."
                className="pl-8"
              />
            </div>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline">
                  <FilterIcon data-icon="inline-start" />
                  Filter
                  {statusFilter !== "all" && (
                    <Badge variant="secondary">
                      {STATUS_LABELS[statusFilter]}
                    </Badge>
                  )}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuLabel>Status</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuGroup>
                  {(["all", "draft", "scheduled", "sending", "sent"] as StatusKey[]).map(
                    (key) => (
                      <DropdownMenuItem
                        key={key}
                        onClick={() => setStatusFilter(key)}
                      >
                        <span>{STATUS_LABELS[key]}</span>
                        <span className="ml-auto text-xs tabular-nums text-muted-foreground">
                          {counts[key]}
                        </span>
                      </DropdownMenuItem>
                    ),
                  )}
                </DropdownMenuGroup>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        <div className="overflow-hidden rounded-lg border border-border bg-card">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="w-10">
                  <Checkbox
                    checked={
                      allVisibleSelected
                        ? true
                        : someVisibleSelected
                          ? "indeterminate"
                          : false
                    }
                    onCheckedChange={toggleAll}
                    aria-label="Select all visible campaigns"
                  />
                </TableHead>
                <TableHead>Campaign</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="hidden lg:table-cell">Recipients</TableHead>
                <TableHead className="hidden xl:table-cell">Created</TableHead>
                <TableHead className="w-10" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading && (
                <TableRow>
                  <TableCell colSpan={6} className="h-32">
                    <PageLoader className="min-h-0" label="Loading campaigns..." />
                  </TableCell>
                </TableRow>
              )}

              {!loading && filtered.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6}>
                    <CampaignEmptyState hasCampaigns={list.length > 0} />
                  </TableCell>
                </TableRow>
              )}

              {!loading &&
                pageItems.map((campaign) => {
                  const status =
                    campaign.status === "scheduled" ||
                    campaign.status === "sending" ||
                    campaign.status === "sent"
                      ? campaign.status
                      : "draft";
                  const isDraft =
                    campaign.status === "draft" ||
                    campaign.status === "scheduled";

                  return (
                    <TableRow
                      key={campaign.id}
                      data-state={selected.has(campaign.id) ? "selected" : undefined}
                      className="cursor-pointer"
                      onClick={() => router.push(`/dashboard/campaigns/${campaign.id}`)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter") {
                          router.push(`/dashboard/campaigns/${campaign.id}`);
                        }
                      }}
                      role="button"
                      tabIndex={0}
                    >
                      <TableCell onClick={(event) => event.stopPropagation()}>
                        <Checkbox
                          checked={selected.has(campaign.id)}
                          onCheckedChange={() => toggleOne(campaign.id)}
                          aria-label={`Select ${campaign.name || "campaign"}`}
                        />
                      </TableCell>
                      <TableCell className="min-w-64">
                        <div className="flex min-w-0 items-center gap-3">
                          <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                            <MailIcon className="size-4" />
                          </span>
                          <span className="min-w-0">
                            <span className="block truncate font-medium text-foreground">
                              {campaign.name || "Untitled Campaign"}
                            </span>
                            <span className="block truncate text-xs text-muted-foreground">
                              {campaign.subject || "No subject"}
                            </span>
                          </span>
                        </div>
                      </TableCell>

                      <TableCell>
                        <div className="flex flex-col items-start gap-1">
                          <Badge variant={STATUS_BADGE_VARIANTS[status]}>
                            <span className="size-1.5 rounded-full bg-current" />
                            {STATUS_LABELS[status]}
                          </Badge>
                          <span className="text-xs text-muted-foreground">
                            {status === "scheduled" && campaign.scheduledAt
                              ? `Sends ${new Date(campaign.scheduledAt).toLocaleString(undefined, { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" })}`
                              : STATUS_DESCRIPTIONS[status]}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="hidden tabular-nums text-muted-foreground lg:table-cell">
                        {campaign.audienceCount === 0 ? (
                          <span>—</span>
                        ) : isDraft ? (
                          <span>
                            {campaign.audienceCount} recipient
                            {campaign.audienceCount === 1 ? "" : "s"}
                          </span>
                        ) : (
                          <span>
                            {campaign.sentCount}/{campaign.audienceCount}
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="hidden text-muted-foreground xl:table-cell">
                        {formatDate(campaign.createdAt)}
                      </TableCell>
                      <TableCell
                        className="text-right"
                        onClick={(event) => event.stopPropagation()}
                      >
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              aria-label={`Open actions for ${campaign.name || "campaign"}`}
                            >
                              <MoreHorizontalIcon />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuLabel>Actions</DropdownMenuLabel>
                            <DropdownMenuGroup>
                              <DropdownMenuItem
                                onClick={() =>
                                  router.push(`/dashboard/campaigns/${campaign.id}`)
                                }
                              >
                                Open campaign
                              </DropdownMenuItem>
                            </DropdownMenuGroup>
                            <DropdownMenuSeparator />
                            <DropdownMenuGroup>
                              <DropdownMenuItem
                                variant="destructive"
                                onClick={() => handleRowDelete(campaign)}
                              >
                                <Trash2Icon data-icon="inline-start" />
                                Delete
                              </DropdownMenuItem>
                            </DropdownMenuGroup>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  );
                })}
            </TableBody>
          </Table>
        </div>

        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <p className="text-sm text-muted-foreground">
            Showing {firstShown}-{lastShown} of {filtered.length}
          </p>
          {pageCount > 1 && (
            <Pagination className="mx-0 w-auto">
              <PaginationContent>
                <PaginationItem>
                  <PaginationPrevious
                    href="#"
                    onClick={(event) => {
                      event.preventDefault();
                      setPage((current) => Math.max(1, current - 1));
                    }}
                    aria-disabled={page === 1}
                    tabIndex={page === 1 ? -1 : undefined}
                  />
                </PaginationItem>
                {Array.from({ length: pageCount }, (_, index) => index + 1).map(
                  (pageNumber) => (
                    <PaginationItem key={pageNumber}>
                      <PaginationLink
                        href="#"
                        isActive={pageNumber === page}
                        onClick={(event) => {
                          event.preventDefault();
                          setPage(pageNumber);
                        }}
                      >
                        {pageNumber}
                      </PaginationLink>
                    </PaginationItem>
                  ),
                )}
                <PaginationItem>
                  <PaginationNext
                    href="#"
                    onClick={(event) => {
                      event.preventDefault();
                      setPage((current) => Math.min(pageCount, current + 1));
                    }}
                    aria-disabled={page === pageCount}
                    tabIndex={page === pageCount ? -1 : undefined}
                  />
                </PaginationItem>
              </PaginationContent>
            </Pagination>
          )}
        </div>

        {selected.size > 0 && (
          <Alert>
            <AlertDescription className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <span>
                {selected.size} campaign{selected.size === 1 ? "" : "s"} selected
              </span>
              <span className="flex gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setSelected(new Set())}
                >
                  Clear
                </Button>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={handleBulkDelete}
                >
                  <Trash2Icon data-icon="inline-start" />
                  Delete
                </Button>
              </span>
            </AlertDescription>
          </Alert>
        )}
      </section>

      <CreateCampaignDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
      />
    </div>
  );
}

function CampaignEmptyState({ hasCampaigns }: { hasCampaigns: boolean }) {
  return (
    <Empty className="border-0 py-14">
      <EmptyHeader>
        <EmptyMedia>
          <IconStack aria-hidden="true" className="h-24 w-22">
            <MailIcon className="size-5" />
          </IconStack>
        </EmptyMedia>
        <EmptyTitle>
          {hasCampaigns ? "No campaigns match your filters" : "No campaigns yet"}
        </EmptyTitle>
        <EmptyDescription>
          {hasCampaigns ? (
            "Try a different search or status filter."
          ) : (
            <>
              Compose one in the{" "}
              <Link href="/editor">editor</Link>, then send it.
            </>
          )}
        </EmptyDescription>
      </EmptyHeader>
      {!hasCampaigns && (
        <EmptyContent>
          <Button asChild>
            <Link href="/editor">Open editor</Link>
          </Button>
        </EmptyContent>
      )}
    </Empty>
  );
}

function CreateCampaignDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const router = useRouter();
  const defaultName = useMemo(
    () =>
      `Email Campaign - ${new Date().toLocaleString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
        hour: "numeric",
        minute: "2-digit",
      })}`,
    [],
  );
  const [name, setName] = useState(defaultName);
  const [templateId, setTemplateId] = useState("blank");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Sender options: the shared LetterStack address plus the org's own
  // verified domains (with a freely chosen local part).
  const [sharedFromEmail, setSharedFromEmail] = useState("");
  const [domains, setDomains] = useState<
    { domain: string; readyToSend: boolean }[]
  >([]);
  // "shared" or one of the connected domain names.
  const [senderSource, setSenderSource] = useState("shared");
  const [customLocal, setCustomLocal] = useState("");
  const [savedTemplates, setSavedTemplates] = useState<
    { id: string; name: string }[]
  >([]);

  useEffect(() => {
    if (!open) return;
    fetch("/api/templates")
      .then((r) => r.json())
      .then((data) => {
        if (data.ok) {
          setSavedTemplates(
            (data.templates ?? []).map((t: { id: string; name: string }) => ({
              id: t.id,
              name: t.name,
            })),
          );
        }
      })
      .catch(() => {});
    fetch("/api/domains")
      .then((r) => r.json())
      .then((data) => {
        if (!data.ok) return;
        setSharedFromEmail(data.sharedFromEmail ?? "");
        const list: { domain: string; readyToSend: boolean }[] =
          data.domains ?? [];
        setDomains(list);
        const firstVerified = list.find((d) => d.readyToSend);
        if (firstVerified) setSenderSource(firstVerified.domain);
      })
      .catch(() => {});
  }, [open]);

  const fromEmail =
    senderSource !== "shared"
      ? `${customLocal.trim() || "hello"}@${senderSource}`
      : sharedFromEmail;

  async function create() {
    setCreating(true);
    setError(null);

    try {
      const res = await fetch("/api/campaigns", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim() || "Untitled Campaign",
          templateId,
          fromEmail: fromEmail || undefined,
        }),
      });
      const data = await res.json();

      if (!data.ok) {
        setError(data.error || "Could not create campaign");
        setCreating(false);
        return;
      }

      router.push(`/dashboard/campaigns/${data.id}`);
    } catch {
      setError("Could not reach the server.");
      setCreating(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Create a new email</DialogTitle>
          <DialogDescription>
            Choose a starting point and name the campaign before opening the editor.
          </DialogDescription>
        </DialogHeader>

        <FieldGroup className="gap-5">
          <Field>
            <FieldLabel>Type</FieldLabel>
            <div className="flex items-start gap-3 rounded-lg border border-border bg-muted/40 p-3">
              <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg bg-background text-muted-foreground">
                <MailIcon className="size-4" />
              </span>
              <span>
                <span className="block text-sm font-medium">Regular email</span>
                <FieldDescription>
                  Design an on-brand email to promote a product, announce an
                  event, or share news.
                </FieldDescription>
              </span>
            </div>
          </Field>

          <Field>
            <FieldLabel htmlFor="campaign-name">Internal name</FieldLabel>
            <Input
              id="campaign-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
            />
          </Field>

          <Field>
            <FieldLabel htmlFor="campaign-sender">Send from</FieldLabel>
            <Select value={senderSource} onValueChange={setSenderSource}>
              <SelectTrigger id="campaign-sender" className="w-full">
                <SelectValue placeholder="Choose a sender" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="shared">
                  {sharedFromEmail || "Shared LetterStack address"} — shared
                </SelectItem>
                {domains.map((entry) => (
                  <SelectItem
                    key={entry.domain}
                    value={entry.domain}
                    disabled={!entry.readyToSend}
                  >
                    {entry.domain} — your domain
                    {entry.readyToSend ? "" : " (pending verification)"}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {senderSource !== "shared" && (
              <div className="flex items-center gap-1">
                <Input
                  value={customLocal}
                  onChange={(event) =>
                    setCustomLocal(
                      event.target.value.toLowerCase().replace(/[^a-z0-9._+-]/g, ""),
                    )
                  }
                  placeholder="hello"
                  className="min-w-0 flex-1"
                  aria-label="Sender address name"
                />
                <span className="shrink-0 text-sm text-muted-foreground">
                  @{senderSource}
                </span>
              </div>
            )}
            <FieldDescription>
              {domains.length > 0
                ? "Pick any address name on your domain — updates, applications, hello…"
                : "Connect your own domain on the Domains page to send from a branded address."}
            </FieldDescription>
          </Field>

          <Field>
            <FieldLabel htmlFor="campaign-template">Start from</FieldLabel>
            <Select value={templateId} onValueChange={setTemplateId}>
              <SelectTrigger id="campaign-template" className="w-full">
                <SelectValue placeholder="Choose a starting point" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="blank">Blank — start from scratch</SelectItem>
                <SelectGroup>
                  <SelectLabel>LetterStack templates</SelectLabel>
                  {PREBUILT_TEMPLATES.map((template) => (
                    <SelectItem key={template.id} value={template.id}>
                      {template.title}
                    </SelectItem>
                  ))}
                </SelectGroup>
                {savedTemplates.length > 0 && (
                  <SelectGroup>
                    <SelectLabel>Your templates</SelectLabel>
                    {savedTemplates.map((template) => (
                      <SelectItem key={template.id} value={template.id}>
                        {template.name}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                )}
              </SelectContent>
            </Select>
          </Field>

          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
        </FieldGroup>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={creating}
          >
            Cancel
          </Button>
          <Button onClick={create} disabled={creating}>
            {creating && <Spinner data-icon="inline-start" />}
            {creating ? "Creating..." : "Begin"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}






