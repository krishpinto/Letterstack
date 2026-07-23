"use client";

import { Fragment, useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  ChevronRightIcon,
  CircleCheckIcon,
  CircleDashedIcon,
  ClockIcon,
  Loader2Icon,
  MailIcon,
  MoreHorizontalIcon,
  PlusIcon,
  SearchIcon,
  Trash2Icon,
} from "lucide-react";

import { PREBUILT_TEMPLATES } from "@/lib/email/templates";
import { onOrganizationChanged } from "@/lib/dashboard-events";
import { paginationRange } from "@/lib/pagination";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { confirmDialog } from "@/components/app-dialogs";
import { SelectionPill } from "@/components/selection-pill";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
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
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import { Progress } from "@/components/ui/progress";
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

type SectionKey = Exclude<StatusKey, "all">;

// The pipeline strip reads left-to-right in lifecycle order; the table groups
// campaigns attention-first (live sends on top, finished work at the bottom).
const PIPELINE_ORDER: SectionKey[] = ["draft", "scheduled", "sending", "sent"];
const SECTION_ORDER: SectionKey[] = ["sending", "scheduled", "draft", "sent"];

const SECTION_META: Record<
  SectionKey,
  {
    icon: typeof MailIcon;
    iconClass: string;
    barClass: string;
  }
> = {
  sending: {
    icon: Loader2Icon,
    iconClass: "animate-spin text-sky-500",
    barClass: "[&_[data-slot=progress-indicator]]:bg-sky-500",
  },
  scheduled: {
    icon: ClockIcon,
    iconClass: "text-amber-500",
    barClass: "[&_[data-slot=progress-indicator]]:bg-amber-500",
  },
  draft: {
    icon: CircleDashedIcon,
    iconClass: "text-muted-foreground",
    barClass: "",
  },
  sent: {
    icon: CircleCheckIcon,
    iconClass: "text-emerald-500",
    barClass: "[&_[data-slot=progress-indicator]]:bg-emerald-500",
  },
};

function normalizeStatus(status: string): SectionKey {
  return status === "scheduled" || status === "sending" || status === "sent"
    ? status
    : "draft";
}

const PAGE_SIZE_OPTIONS = [25, 50, 100];

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
  const [pageSize, setPageSize] = useState(PAGE_SIZE_OPTIONS[0]);

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

  // The module sidebar's "New campaign" buttons land here as ?create=1 —
  // open the dialog and strip the flag (keeping any status filter).
  useEffect(() => {
    if (searchParams.get("create") !== "1") return;
    setCreateOpen(true);
    const next = new URLSearchParams(searchParams);
    next.delete("create");
    const qs = next.toString();
    router.replace(qs ? `/dashboard/campaigns?${qs}` : "/dashboard/campaigns");
  }, [searchParams, router]);

  useEffect(() => {
    return onOrganizationChanged(() => {
      setSelected(new Set());
      setQuery("");
      setStatusFilter("all");
      setPage(1);
      void loadCampaigns();
    });
  }, [loadCampaigns, setStatusFilter]);

  // Query narrows first; the pipeline chips show per-stage counts of the
  // searched set so search and stage filters compose visibly.
  const searched = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return list;
    return list.filter((campaign) =>
      `${campaign.name} ${campaign.subject}`.toLowerCase().includes(q),
    );
  }, [list, query]);

  const stageCounts = useMemo(() => {
    const counts: Record<SectionKey, number> = {
      draft: 0,
      scheduled: 0,
      sending: 0,
      sent: 0,
    };
    for (const campaign of searched) {
      counts[normalizeStatus(campaign.status)] += 1;
    }
    return counts;
  }, [searched]);

  // Rows come out bucketed by status in attention-first order so the table
  // can render one section header per group.
  const filtered = useMemo(() => {
    const buckets = new Map<SectionKey, Campaign[]>(
      SECTION_ORDER.map((key) => [key, []]),
    );
    for (const campaign of searched) {
      const status = normalizeStatus(campaign.status);
      if (statusFilter !== "all" && status !== statusFilter) continue;
      buckets.get(status)?.push(campaign);
    }
    return SECTION_ORDER.flatMap((key) => buckets.get(key) ?? []);
  }, [searched, statusFilter]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize));
  const pageStart = (page - 1) * pageSize;
  const pageItems = filtered.slice(pageStart, pageStart + pageSize);
  const firstShown = filtered.length === 0 ? 0 : pageStart + 1;
  const lastShown = Math.min(pageStart + pageItems.length, filtered.length);

  useEffect(() => {
    setPage(1);
  }, [query, statusFilter, pageSize]);

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
    // Full-bleed: the shell skips its padding for this route, so the page
    // itself becomes the table — toolbar band, scrolling rows, footer band.
    <div className="flex min-h-0 flex-1 flex-col bg-background">
        <div className="flex shrink-0 flex-col gap-3 border-b border-border px-4 py-3 lg:flex-row lg:items-center lg:justify-between">
          {/* Lifecycle strip: each stage is a filter chip, like a pipeline
              breadcrumb. Clicking the active stage clears the filter. */}
          <div className="flex min-w-0 items-center gap-1 overflow-x-auto whitespace-nowrap">
            <PipelineChip
              label="All"
              count={searched.length}
              active={statusFilter === "all"}
              onClick={() => setStatusFilter("all")}
            />
            {PIPELINE_ORDER.map((stage) => (
              <Fragment key={stage}>
                <ChevronRightIcon className="size-3.5 shrink-0 text-muted-foreground/60" />
                <PipelineChip
                  label={STATUS_LABELS[stage]}
                  count={stageCounts[stage]}
                  active={statusFilter === stage}
                  onClick={() =>
                    setStatusFilter(statusFilter === stage ? "all" : stage)
                  }
                />
              </Fragment>
            ))}
          </div>
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
            <Button onClick={() => setCreateOpen(true)}>
              <PlusIcon data-icon="inline-start" />
              Create
            </Button>
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto">
          <Table className="[&_td:first-child]:pl-4 [&_td:last-child]:pr-4 [&_th:first-child]:pl-4 [&_th:last-child]:pr-4">
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
                <TableHead>Name</TableHead>
                <TableHead className="hidden lg:table-cell">Recipients</TableHead>
                <TableHead>Delivery</TableHead>
                <TableHead className="hidden xl:table-cell">Created</TableHead>
                <TableHead className="w-10" />
                <TableHead className="w-10" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading && (
                <TableRow>
                  <TableCell colSpan={7} className="h-32">
                    <PageLoader className="min-h-0" label="Loading campaigns..." />
                  </TableCell>
                </TableRow>
              )}

              {!loading && filtered.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7}>
                    <CampaignEmptyState hasCampaigns={list.length > 0} />
                  </TableCell>
                </TableRow>
              )}

              {!loading &&
                pageItems.map((campaign, index) => {
                  const status = normalizeStatus(campaign.status);
                  const meta = SECTION_META[status];
                  const StatusIcon = meta.icon;
                  // A section header opens each status group — also at the
                  // top of every page, since a group can span pages.
                  const previousStatus =
                    index > 0
                      ? normalizeStatus(pageItems[index - 1].status)
                      : null;
                  const showSectionHeader = status !== previousStatus;

                  return (
                    <Fragment key={campaign.id}>
                    {showSectionHeader && (
                      <TableRow className="bg-muted/50 hover:bg-muted/50">
                        <TableCell colSpan={7} className="py-2">
                          <div className="flex items-center justify-between">
                            <span className="flex items-center gap-2 text-xs font-medium">
                              <StatusIcon className={`size-3.5 ${meta.iconClass}`} />
                              {STATUS_LABELS[status]}
                            </span>
                            <span className="text-xs tabular-nums text-muted-foreground">
                              {stageCounts[status]}
                            </span>
                          </div>
                        </TableCell>
                      </TableRow>
                    )}
                    <TableRow
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

                      <TableCell className="hidden tabular-nums text-muted-foreground lg:table-cell">
                        {campaign.audienceCount === 0
                          ? "—"
                          : campaign.audienceCount.toLocaleString()}
                      </TableCell>
                      <TableCell>
                        {status === "draft" ? (
                          <span className="text-muted-foreground">—</span>
                        ) : status === "scheduled" ? (
                          <span className="text-xs text-muted-foreground">
                            {campaign.scheduledAt
                              ? `Sends ${new Date(campaign.scheduledAt).toLocaleString(undefined, { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" })}`
                              : "Waiting for send time"}
                          </span>
                        ) : (
                          <div className="flex items-center gap-2">
                            <Progress
                              value={
                                campaign.audienceCount > 0
                                  ? Math.round(
                                      (campaign.sentCount /
                                        campaign.audienceCount) *
                                        100,
                                    )
                                  : 0
                              }
                              className={`h-1.5 w-20 ${meta.barClass}`}
                            />
                            <span className="text-xs tabular-nums text-muted-foreground">
                              {campaign.sentCount}/{campaign.audienceCount}
                            </span>
                          </div>
                        )}
                      </TableCell>
                      <TableCell className="hidden text-muted-foreground xl:table-cell">
                        {formatDate(campaign.createdAt)}
                      </TableCell>
                      <TableCell>
                        <StatusIcon
                          className={`size-4 ${meta.iconClass}`}
                          aria-label={STATUS_LABELS[status]}
                        />
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
                    </Fragment>
                  );
                })}
            </TableBody>
          </Table>
        </div>

        <div className="flex shrink-0 flex-col gap-3 border-t border-border px-4 py-2 md:flex-row md:items-center md:justify-between">
          <p className="text-sm text-muted-foreground">
            Showing {firstShown}-{lastShown} of {filtered.length}
          </p>
          <div className="flex items-center gap-3">
          <Select
            value={String(pageSize)}
            onValueChange={(value) => setPageSize(Number(value))}
          >
            <SelectTrigger className="h-8 w-fit gap-1 text-xs" aria-label="Rows per page">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PAGE_SIZE_OPTIONS.map((option) => (
                <SelectItem key={option} value={String(option)}>
                  {option} / page
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
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
                {paginationRange(page, pageCount).map((entry, index) =>
                  entry === "ellipsis" ? (
                    <PaginationItem key={`ellipsis-${index}`}>
                      <PaginationEllipsis />
                    </PaginationItem>
                  ) : (
                    <PaginationItem key={entry}>
                      <PaginationLink
                        href="#"
                        isActive={entry === page}
                        onClick={(event) => {
                          event.preventDefault();
                          setPage(entry);
                        }}
                      >
                        {entry}
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
        </div>

        <SelectionPill
          count={selected.size}
          onClear={() => setSelected(new Set())}
        >
          <Button
            variant="ghost"
            size="sm"
            className="rounded-full text-destructive hover:text-destructive"
            onClick={handleBulkDelete}
          >
            <Trash2Icon data-icon="inline-start" />
            Delete
          </Button>
        </SelectionPill>

      <CreateCampaignDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
      />
    </div>
  );
}

function PipelineChip({
  label,
  count,
  active,
  onClick,
}: {
  label: string;
  count: number;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`flex shrink-0 cursor-pointer items-center gap-1.5 rounded-md px-2.5 py-1 text-sm transition-colors ${
        active
          ? "bg-secondary font-medium text-secondary-foreground"
          : "text-muted-foreground hover:bg-muted hover:text-foreground"
      }`}
    >
      {label}
      <span className="text-xs tabular-nums opacity-70">{count}</span>
    </button>
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
      <DialogPopup className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Create a new email</DialogTitle>
          <DialogDescription>
            Choose a starting point and name the campaign before opening the editor.
          </DialogDescription>
        </DialogHeader>

        <DialogPanel>
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
        </DialogPanel>

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
      </DialogPopup>
    </Dialog>
  );
}






