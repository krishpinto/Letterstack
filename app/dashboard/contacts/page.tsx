"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  BanIcon,
  CheckIcon,
  ChevronDownIcon,
  DownloadIcon,
  Edit2Icon,
  FolderIcon,
  PlusIcon,
  RotateCcwIcon,
  SearchIcon,
  Trash2Icon,
  UploadIcon,
  UserRoundIcon,
  XIcon,
} from "lucide-react";

import { ImportWizard } from "./import-wizard";
import { InlineEditCell, suggestEmailFix } from "./inline-edit-cell";
import {
  buildContactsCsv,
  canUnsuppress,
  chunk,
  exportFileName,
  lockedSuppressionExplanation,
  statusForSuppression,
  summarizeBulk,
  suppressionLabel,
} from "./contacts-helpers";
import { dispatchAudienceChanged, onOrganizationChanged } from "@/lib/dashboard-events";
import { paginationRange } from "@/lib/pagination";
import { alertDialog, confirmDialog } from "@/components/app-dialogs";
import { ErrorState, useAsyncData } from "@/components/data-state";
import { toast } from "@/components/toast";
import { errorMessage, fetchJson } from "@/lib/fetch-json";
import { SelectionPill } from "@/components/selection-pill";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
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
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { IconStack } from "@/components/reui/icon-stack";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
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
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { cn } from "@/lib/utils";

type Recipient = {
  id: string;
  email: string;
  name: string | null;
  sentAt: string | null;
  createdAt: string;
};

type SuppressedEntry = { email: string; reason: string };
type Contact = Recipient & {
  status: "subscribed" | "bounced" | "suppressed";
  /** suppressed_emails.reason, or null when the address is not suppressed. */
  suppressionReason: string | null;
};
type StatusKey = "all" | "subscribed" | "bounced" | "suppressed";

type Category = {
  id: string;
  name: string;
  createdAt: string;
};

type Mapping = {
  id: string;
  recipientId: string;
  categoryId: string;
};

const STATUS_LABELS: Record<StatusKey, string> = {
  all: "All",
  subscribed: "Subscribed",
  bounced: "Bounced",
  suppressed: "Suppressed",
};

const STATUS_BADGE_VARIANTS = {
  subscribed: "default",
  bounced: "destructive",
  suppressed: "outline",
} as const;

const FOLDER_COLORS = [
  { text: "text-amber-500", bg: "bg-amber-500/10" },
  { text: "text-violet-500", bg: "bg-violet-500/10" },
  { text: "text-cyan-500", bg: "bg-cyan-500/10" },
];

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PAGE_SIZE_OPTIONS = [25, 50, 100];
// Bulk requests are capped server-side at 1,000; stay well under it.
const BULK_CHUNK = 500;

type AudienceData = {
  contacts: Contact[];
  categories: Category[];
  mappings: Mapping[];
};

type CategoriesResponse = { categories: Category[]; mappings: Mapping[] };

// Contacts, their suppression state and their folders load together: the
// folder filter needs the mappings, so a page showing contacts without them
// would render a filtered folder as empty. Any one failing is an error.
async function loadAudience(): Promise<AudienceData> {
  const [recipientResponse, suppressionResponse, categoryResponse] = await Promise.all([
    fetchJson<{ recipients: Recipient[] }>("/api/audience"),
    fetchJson<{ suppressed: SuppressedEntry[] }>("/api/audience/suppression"),
    fetchJson<CategoriesResponse>("/api/audience/categories"),
  ]);

  const reasons = new Map<string, string>();
  for (const entry of suppressionResponse.suppressed) {
    reasons.set(entry.email, entry.reason);
  }

  return {
    contacts: recipientResponse.recipients.map((recipient) => {
      const reason = reasons.get(recipient.email) ?? null;
      return {
        ...recipient,
        status: statusForSuppression(reason),
        suppressionReason: reason,
      };
    }),
    categories: categoryResponse.categories ?? [],
    mappings: categoryResponse.mappings ?? [],
  };
}

function getInitials(name: string | null, email: string) {
  if (name) {
    const parts = name.trim().split(/\s+/);
    return (parts[0]?.[0] + (parts[1]?.[0] || "")).toUpperCase();
  }
  return email[0]?.toUpperCase() ?? "?";
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

const STATUS_KEYS: StatusKey[] = ["all", "subscribed", "bounced", "suppressed"];

export default function AudiencePage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  // Bumped on a workspace switch: a new workspace is a new resource, so the
  // page shows the loader instead of the previous workspace's contacts.
  const [organizationVersion, setOrganizationVersion] = useState(0);
  const audience = useAsyncData(loadAudience, [organizationVersion]);
  const { reload: reloadAudience, setData: setAudienceData } = audience;
  const contacts = useMemo(() => audience.data?.contacts ?? [], [audience.data]);
  const categories = useMemo(() => audience.data?.categories ?? [], [audience.data]);
  const mappings = useMemo(() => audience.data?.mappings ?? [], [audience.data]);

  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusKey>("all");
  // Mailchimp-style always-visible filters: folders are multi-select,
  // "added" is a rolling window, status mirrors the sidebar via ?status=.
  const [folderFilter, setFolderFilter] = useState<Set<string>>(new Set());
  const [addedFilter, setAddedFilter] = useState<"any" | "7d" | "30d" | "90d">("any");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(PAGE_SIZE_OPTIONS[0]);
  
  const [selected, setSelected] = useState<Set<string>>(new Set());
  // Which bulk action is in flight, so its button can't be pressed twice.
  const [bulkBusy, setBulkBusy] = useState<"delete" | "suppress" | "unsuppress" | null>(null);
  const [filterReferenceTime] = useState(() => Date.now());
  
  // Importers / Single contact add dialogs
  const [addOpen, setAddOpen] = useState(false);
  const [addEmail, setAddEmail] = useState("");
  const [addName, setAddName] = useState("");
  const [addError, setAddError] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [importOpen, setImportOpen] = useState(false);

  // Folders to drop the new contact into, chosen right in the add dialog.
  const [addFolders, setAddFolders] = useState<Set<string>>(new Set());
  const [addNewFolder, setAddNewFolder] = useState("");
  const [addCreatingFolder, setAddCreatingFolder] = useState(false);

  // Build a URL that keeps the current filters while changing/removing a couple
  // of query params. One-shot params (dialogs, import) never carry over.
  const buildHref = useCallback(
    (updates: Record<string, string | null>) => {
      const sp = new URLSearchParams(searchParams.toString());
      for (const [key, value] of Object.entries(updates)) {
        if (value === null) sp.delete(key);
        else sp.set(key, value);
      }
      sp.delete("newFolder");
      sp.delete("manageFolders");
      sp.delete("import");
      const qs = sp.toString();
      return qs ? `${pathname}?${qs}` : pathname;
    },
    [searchParams, pathname],
  );

  // The module sidebar drives the page through the URL: ?status= and ?folder=
  // filter the list; ?import=1 / ?newFolder=1 / ?manageFolders=1 open flows.
  useEffect(() => {
    const status = searchParams.get("status") as StatusKey | null;
    setStatusFilter(status && STATUS_KEYS.includes(status) ? status : "all");

    const folder = searchParams.get("folder");
    setFolderFilter(folder ? new Set([folder]) : new Set());

    if (searchParams.get("import") === "1") setImportOpen(true);
  }, [searchParams]);

  // Folder quick create dialog
  const [createFolderOpen, setCreateFolderOpen] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");
  const [creatingFolder, setCreatingFolder] = useState(false);
  
  // Sheet categories see-more dialog
  const [seeMoreOpen, setSeeMoreOpen] = useState(false);
  const [editingCategoryId, setEditingCategoryId] = useState<string | null>(null);
  const [editingCategoryName, setEditingCategoryName] = useState("");

  // One-shot dialog opens from the sidebar links (?newFolder / ?manageFolders),
  // stripped from the URL after firing so a refresh doesn't reopen them.
  useEffect(() => {
    if (searchParams.get("newFolder") === "1") {
      setCreateFolderOpen(true);
      router.replace(pathname);
    } else if (searchParams.get("manageFolders") === "1") {
      setSeeMoreOpen(true);
      router.replace(pathname);
    }
  }, [searchParams, pathname, router]);
  
  // Selection mapping dialog
  const [manageCategoriesOpen, setManageCategoriesOpen] = useState(false);
  const [selectedMappingCategories, setSelectedMappingCategories] = useState<Set<string>>(new Set());
  const [savingMapping, setSavingMapping] = useState(false);

  // Folder mutations only need the folder list and mappings re-read.
  const loadCategories = useCallback(async () => {
    try {
      const data = await fetchJson<CategoriesResponse>("/api/audience/categories");
      setAudienceData((current) => ({
        ...current,
        categories: data.categories ?? [],
        mappings: data.mappings ?? [],
      }));
    } catch (error) {
      toast.error("Couldn't refresh folders", { description: errorMessage(error) });
    }
  }, [setAudienceData]);

  const load = useCallback(() => reloadAudience(), [reloadAudience]);

  // A failed background refresh keeps the list on screen and says so.
  const refreshError =
    audience.status === "error" && audience.data ? audience.error : null;
  useEffect(() => {
    if (refreshError) {
      toast.error("Couldn't refresh contacts", { description: refreshError });
    }
  }, [refreshError]);

  useEffect(() => {
    return onOrganizationChanged(() => {
      setSelected(new Set());
      setQuery("");
      setStatusFilter("all");
      setFolderFilter(new Set());
      setAddedFilter("any");
      setPage(1);
      setOrganizationVersion((version) => version + 1);
    });
  }, []);

  useEffect(() => {
    setPage(1);
  }, [query, statusFilter, folderFilter, addedFilter, pageSize]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();

    const categoryRecipientIds =
      folderFilter.size > 0
        ? new Set(
            mappings
              .filter((m) => folderFilter.has(m.categoryId))
              .map((m) => m.recipientId),
          )
        : null;

    const addedDays = { "7d": 7, "30d": 30, "90d": 90 }[
      addedFilter as "7d" | "30d" | "90d"
    ];
    const addedSince =
      addedFilter === "any"
        ? null
        : filterReferenceTime - addedDays * 24 * 60 * 60 * 1000;

    return contacts.filter((contact) => {
      if (statusFilter !== "all" && contact.status !== statusFilter) return false;
      if (categoryRecipientIds && !categoryRecipientIds.has(contact.id)) return false;
      if (addedSince && new Date(contact.createdAt).getTime() < addedSince) {
        return false;
      }
      if (
        q &&
        !`${contact.name || ""} ${contact.email}`.toLowerCase().includes(q)
      ) {
        return false;
      }
      return true;
    });
  }, [contacts, query, statusFilter, folderFilter, addedFilter, mappings, filterReferenceTime]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize));
  // After a bulk delete the old page number can point past the end; showing
  // the last real page beats an empty table that reads like data loss.
  const currentPage = Math.min(page, pageCount);
  const pageStart = (currentPage - 1) * pageSize;
  const pageItems = filtered.slice(pageStart, pageStart + pageSize);
  const firstShown = filtered.length > 0 ? pageStart + 1 : 0;
  const lastShown = Math.min(pageStart + pageSize, filtered.length);

  const counts = useMemo(() => {
    const count = { all: contacts.length, subscribed: 0, bounced: 0, suppressed: 0 };
    contacts.forEach((contact) => count[contact.status]++);
    return count;
  }, [contacts]);

  const categoryCounts = useMemo(() => {
    const countMap: Record<string, number> = {};
    mappings.forEach((m) => {
      countMap[m.categoryId] = (countMap[m.categoryId] || 0) + 1;
    });
    return countMap;
  }, [mappings]);

  const contactCategories = useMemo(() => {
    const map: Record<string, Category[]> = {};
    mappings.forEach((m) => {
      if (!map[m.recipientId]) map[m.recipientId] = [];
      const cat = categories.find((c) => c.id === m.categoryId);
      if (cat) map[m.recipientId].push(cat);
    });
    return map;
  }, [mappings, categories]);

  const selectedHasSuppressed = contacts.some(
    (contact) => selected.has(contact.id) && contact.suppressionReason !== null,
  );

  const allFilteredSelected =
    pageItems.length > 0 && pageItems.every((contact) => selected.has(contact.id));
  const someFilteredSelected = pageItems.some((contact) => selected.has(contact.id));

  function toggleRow(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAll() {
    const ids = pageItems.map((contact) => contact.id);
    const allOn = ids.length > 0 && ids.every((id) => selected.has(id));
    setSelected((prev) => {
      const next = new Set(prev);
      ids.forEach((id) => {
        if (allOn) next.delete(id);
        else next.add(id);
      });
      return next;
    });
  }

  function clearSelection() {
    setSelected(new Set());
  }

  // Inline cell edits land here; the return value is the editor's error line.
  async function updateContactField(
    id: string,
    patch: { email?: string; name?: string },
  ): Promise<string | null> {
    try {
      const data = await fetchJson<{ recipient: { email: string; name: string | null } }>(
        "/api/audience",
        { method: "PATCH", json: { id, ...patch } },
      );

      setAudienceData((current) => ({
        ...current,
        contacts: current.contacts.map((contact) =>
          contact.id === id
            ? {
                ...contact,
                email: data.recipient.email,
                name: data.recipient.name,
                // PATCH refuses suppressed addresses, so a changed email
                // is always a clean subscriber again.
                ...(patch.email !== undefined
                  ? { status: "subscribed" as const, suppressionReason: null }
                  : {}),
              }
            : contact,
        ),
      }));
      dispatchAudienceChanged();
      toast.success("Contact updated");
      return null;
    } catch (error) {
      return errorMessage(error, "Could not update the contact.");
    }
  }

  async function removeContact(contact: Contact) {
    const ok = await confirmDialog({
      title: `Delete ${contact.email}?`,
      description:
        "The contact is removed from your audience and every folder. Campaigns already sent are not affected. This cannot be undone.",
      confirmLabel: "Delete contact",
      destructive: true,
    });
    if (!ok) return;

    try {
      await fetchJson(`/api/audience?id=${encodeURIComponent(contact.id)}`, {
        method: "DELETE",
      });
      toast.success("Contact deleted");
      setSelected((prev) => {
        const next = new Set(prev);
        next.delete(contact.id);
        return next;
      });
      dispatchAudienceChanged();
    } catch (error) {
      toast.error("Couldn't delete the contact", { description: errorMessage(error) });
    }
    await load();
  }

  function selectedContacts() {
    return contacts.filter((contact) => selected.has(contact.id));
  }

  // Selections can outlive a reload (another tab deleted some), so counts
  // come from the contacts still on the page, not the raw id set.
  async function bulkDelete() {
    const targets = selectedContacts();
    if (targets.length === 0 || bulkBusy) return;
    const count = targets.length;

    const ok = await confirmDialog({
      title: `Delete ${count.toLocaleString()} contact${count === 1 ? "" : "s"}?`,
      description:
        "They are removed from your audience and every folder. Campaigns already sent are not affected. This cannot be undone.",
      confirmLabel: `Delete ${count.toLocaleString()}`,
      destructive: true,
    });
    if (!ok) return;

    setBulkBusy("delete");
    const deleted = new Set<string>();
    const failed: string[] = [];
    try {
      for (const ids of chunk(targets.map((contact) => contact.id), BULK_CHUNK)) {
        try {
          const data = await fetchJson<{ deleted: string[]; notFound: string[] }>(
            "/api/audience",
            { method: "DELETE", json: { ids } },
          );
          data.deleted.forEach((id) => deleted.add(id));
          data.notFound.forEach(() => failed.push("Contact not found"));
        } catch (error) {
          ids.forEach(() => failed.push(errorMessage(error)));
        }
      }
    } finally {
      setBulkBusy(null);
    }

    const summary = summarizeBulk({
      verb: "Deleted",
      noun: "contact",
      total: count,
      done: deleted.size,
      failed,
    });
    toast[summary.kind](summary.message, { description: summary.description });
    // Keep the ones that failed selected so they can be retried.
    setSelected((prev) => new Set([...prev].filter((id) => !deleted.has(id))));
    if (deleted.size > 0) dispatchAudienceChanged();
    await load();
  }

  async function bulkSuppress() {
    const targets = selectedContacts();
    if (targets.length === 0 || bulkBusy) return;
    const fresh = targets.filter((contact) => !contact.suppressionReason);
    const already = targets.length - fresh.length;

    if (fresh.length === 0) {
      await alertDialog({
        title: "Already suppressed",
        description: `${targets.length === 1 ? "The selected contact is" : `All ${targets.length.toLocaleString()} selected contacts are`} already suppressed.`,
      });
      return;
    }

    const count = fresh.length;
    const ok = await confirmDialog({
      title: `Suppress ${count.toLocaleString()} contact${count === 1 ? "" : "s"}?`,
      description:
        "Suppressed contacts stay in your audience but are skipped by every campaign and automation until you unsuppress them." +
        (already > 0
          ? ` ${already.toLocaleString()} of the selected contacts ${already === 1 ? "is" : "are"} already suppressed and will be left as they are.`
          : ""),
      confirmLabel: `Suppress ${count.toLocaleString()}`,
    });
    if (!ok) return;

    setBulkBusy("suppress");
    let done = 0;
    const failed: string[] = [];
    try {
      for (const emails of chunk(fresh.map((contact) => contact.email), BULK_CHUNK)) {
        try {
          const data = await fetchJson<{ suppressed: number; alreadySuppressed: number }>(
            "/api/audience/suppression",
            { method: "POST", json: { emails } },
          );
          // "Already suppressed" here means it was suppressed in the
          // meantime; the address ends up suppressed either way.
          done += data.suppressed + data.alreadySuppressed;
        } catch (error) {
          emails.forEach(() => failed.push(errorMessage(error)));
        }
      }
    } finally {
      setBulkBusy(null);
    }

    const summary = summarizeBulk({ verb: "Suppressed", noun: "contact", total: count, done, failed });
    toast[summary.kind](summary.message, { description: summary.description });
    if (failed.length === 0) clearSelection();
    if (done > 0) dispatchAudienceChanged();
    await load();
  }

  // Undo a manual suppression. Bounces, complaints and unsubscribes are
  // refused by the server too; the dialog explains why up front.
  async function unsuppress(targets: Contact[]) {
    const suppressed = targets.filter((contact) => contact.suppressionReason);
    if (suppressed.length === 0 || bulkBusy) return;
    const allowed = suppressed.filter((contact) => canUnsuppress(contact.suppressionReason));
    const locked = suppressed.filter((contact) => !canUnsuppress(contact.suppressionReason));

    const lockedReasons = [
      ...new Set(
        locked
          .map((contact) => lockedSuppressionExplanation(contact.suppressionReason))
          .filter((reason): reason is string => Boolean(reason)),
      ),
    ];
    const lockedNote =
      locked.length === 0
        ? ""
        : locked.length === 1 && allowed.length === 0
          ? (lockedReasons[0] ?? "")
          : `${locked.length.toLocaleString()} of the selected can't be unsuppressed. ${lockedReasons.join(" ")}`;

    if (allowed.length === 0) {
      await alertDialog({
        title:
          locked.length === 1
            ? `${locked[0]!.email} can't be unsuppressed`
            : "These contacts can't be unsuppressed",
        description: lockedNote,
      });
      return;
    }

    const count = allowed.length;
    const ok = await confirmDialog({
      title:
        count === 1
          ? `Unsuppress ${allowed[0]!.email}?`
          : `Unsuppress ${count.toLocaleString()} contacts?`,
      description:
        `${count === 1 ? "This contact" : "They"} will receive campaigns and automations again.` +
        (lockedNote ? ` ${lockedNote}` : ""),
      confirmLabel: count === 1 ? "Unsuppress" : `Unsuppress ${count.toLocaleString()}`,
    });
    if (!ok) return;

    setBulkBusy("unsuppress");
    let done = 0;
    const failed: string[] = [];
    try {
      for (const emails of chunk(allowed.map((contact) => contact.email), BULK_CHUNK)) {
        try {
          const data = await fetchJson<{
            removed: string[];
            refused: { email: string; reason: string }[];
            notSuppressed: string[];
          }>("/api/audience/suppression", { method: "DELETE", json: { emails } });
          // Already unsuppressed elsewhere: the outcome the user wanted.
          done += data.removed.length + data.notSuppressed.length;
          data.refused.forEach((row) =>
            failed.push(
              lockedSuppressionExplanation(row.reason) ?? "This suppression can't be removed.",
            ),
          );
        } catch (error) {
          emails.forEach(() => failed.push(errorMessage(error)));
        }
      }
    } finally {
      setBulkBusy(null);
    }

    const summary = summarizeBulk({ verb: "Unsuppressed", noun: "contact", total: count, done, failed });
    toast[summary.kind](summary.message, { description: summary.description });
    if (failed.length === 0) clearSelection();
    if (done > 0) dispatchAudienceChanged();
    await load();
  }

  // Exports exactly what the table is showing across all pages: the current
  // folder, status, "added" window and search.
  function exportContacts() {
    if (filtered.length === 0) {
      toast.info("Nothing to export", {
        description: "No contacts match the current filters.",
      });
      return;
    }
    const csv = buildContactsCsv(
      filtered.map((contact) => ({
        name: contact.name,
        email: contact.email,
        status: suppressionLabel(contact.suppressionReason),
        folders: (contactCategories[contact.id] ?? []).map((folder) => folder.name),
        createdAt: contact.createdAt,
      })),
    );
    const folderName =
      folderFilter.size === 1
        ? (categories.find((folder) => folderFilter.has(folder.id))?.name ?? null)
        : null;
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = exportFileName(folderName);
    anchor.click();
    URL.revokeObjectURL(url);
    toast.success(
      `Exported ${filtered.length.toLocaleString()} contact${filtered.length === 1 ? "" : "s"}`,
    );
  }

  async function addContact() {
    setAdding(true);
    setAddError(null);

    try {
      let recipientId: string | undefined;
      try {
        const data = await fetchJson<{ recipient?: { id: string } }>("/api/audience", {
          method: "POST",
          json: { email: addEmail, name: addName || undefined },
        });
        recipientId = data.recipient?.id;
      } catch (error) {
        setAddError(errorMessage(error));
        return;
      }

      // Drop the new contact into any folders picked in the dialog. The
      // contact exists either way; a failure here is reported, not hidden.
      if (addFolders.size > 0 && recipientId) {
        try {
          await fetchJson("/api/audience/categories", {
            method: "POST",
            json: {
              action: "map",
              recipientIds: [recipientId],
              categoryIds: Array.from(addFolders),
            },
          });
        } catch (error) {
          toast.error("Contact added, but not to the folder", {
            description: errorMessage(error),
          });
        }
      }

      setAddEmail("");
      setAddName("");
      setAddFolders(new Set());
      setAddNewFolder("");
      setAddOpen(false);
      dispatchAudienceChanged();
      toast.success("Contact added");
      await load();
    } finally {
      setAdding(false);
    }
  }

  function toggleAddFolder(id: string) {
    setAddFolders((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  // Create a folder from inside the add dialog and pre-select it for the contact.
  async function createAddFolder() {
    const name = addNewFolder.trim();
    if (!name) return;
    setAddCreatingFolder(true);
    try {
      const data = await fetchJson<{ category?: Category }>("/api/audience/categories", {
        method: "POST",
        json: { action: "create", name },
      });
      setAddNewFolder("");
      dispatchAudienceChanged();
      await loadCategories();
      const created = data.category;
      if (created) setAddFolders((prev) => new Set(prev).add(created.id));
    } catch (error) {
      toast.error("Couldn't create the folder", { description: errorMessage(error) });
    } finally {
      setAddCreatingFolder(false);
    }
  }

  // ── Folder actions (folders are "categories" in the API and database) ──

  async function handleCreateCategory() {
    if (!newFolderName.trim()) return;
    setCreatingFolder(true);
    try {
      await fetchJson("/api/audience/categories", {
        method: "POST",
        json: { action: "create", name: newFolderName },
      });
      toast.success("Folder created");
      setNewFolderName("");
      setCreateFolderOpen(false);
      dispatchAudienceChanged();
      await loadCategories();
    } catch (error) {
      toast.error("Couldn't create the folder", { description: errorMessage(error) });
    } finally {
      setCreatingFolder(false);
    }
  }

  async function handleRenameCategory(id: string, name: string) {
    if (!name.trim()) return;
    try {
      await fetchJson("/api/audience/categories", {
        method: "PATCH",
        json: { id, name },
      });
      toast.success("Folder renamed");
      setEditingCategoryId(null);
      dispatchAudienceChanged();
      await loadCategories();
    } catch (error) {
      toast.error("Couldn't rename the folder", { description: errorMessage(error) });
    }
  }

  async function handleDeleteCategory(id: string) {
    const folder = categories.find((cat) => cat.id === id);
    const inside = categoryCounts[id] ?? 0;
    const ok = await confirmDialog({
      title: folder ? `Delete the folder "${folder.name}"?` : "Delete this folder?",
      description:
        inside > 0
          ? `The ${inside.toLocaleString()} contact${inside === 1 ? "" : "s"} inside stay in your audience; only the folder is removed.`
          : "Contacts inside will not be deleted.",
      confirmLabel: "Delete folder",
      destructive: true,
    });
    if (!ok) return;
    try {
      await fetchJson(`/api/audience/categories?id=${encodeURIComponent(id)}`, {
        method: "DELETE",
      });
      toast.success("Folder deleted");
      if (searchParams.get("folder") === id) {
        router.replace(buildHref({ folder: null }));
      }
      dispatchAudienceChanged();
      await loadCategories();
    } catch (error) {
      toast.error("Couldn't delete the folder", { description: errorMessage(error) });
    }
  }

  async function handleSaveMapping() {
    setSavingMapping(true);
    try {
      await fetchJson("/api/audience/categories", {
        method: "POST",
        json: {
          action: "map",
          recipientIds: Array.from(selected),
          categoryIds: Array.from(selectedMappingCategories),
        },
      });
      toast.success("Folders updated");
      setManageCategoriesOpen(false);
      clearSelection();
      dispatchAudienceChanged();
      await loadCategories();
    } catch (error) {
      toast.error("Couldn't update folders", { description: errorMessage(error) });
    } finally {
      setSavingMapping(false);
    }
  }

  if (audience.status === "loading") {
    return <PageLoader label="Loading audience..." />;
  }

  if (audience.status === "error" && !audience.data) {
    return (
      <div className="flex min-h-0 flex-1 flex-col bg-background">
        <ErrorState
          title="Couldn't load your audience"
          message={audience.error}
          onRetry={() => void load()}
          retrying={audience.refreshing}
        />
      </div>
    );
  }

  const ADDED_LABELS = {
    any: "Any time",
    "7d": "Last 7 days",
    "30d": "Last 30 days",
    "90d": "Last 90 days",
  } as const;
  const hasActiveFilters =
    folderFilter.size > 0 || statusFilter !== "all" || addedFilter !== "any";

  function clearAllFilters() {
    setAddedFilter("any");
    router.replace(buildHref({ folder: null, status: null }));
  }

  return (
    // Full-bleed: the shell skips its padding for this route, so the page
    // itself becomes the table — toolbar band, scrolling rows, footer band.
    <div className="flex min-h-0 flex-1 flex-col bg-background">
        {/* Mailchimp-style filter bar: everything visible, nothing hidden */}
        <div className="flex shrink-0 flex-col gap-2 border-b border-border px-4 py-3 xl:flex-row xl:items-center xl:justify-between">
          <div className="flex flex-1 flex-wrap items-center gap-2">
            <div className="relative w-full sm:w-64">
              <SearchIcon className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search contacts..."
                className="pl-8"
              />
            </div>

            {/* Folders live in the sidebar now — the page keeps the refining
                filters only (status, added, search). */}

            {/* Status: refines the current view via ?status= */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline">
                  Status
                  {statusFilter !== "all" && (
                    <Badge variant="secondary">{STATUS_LABELS[statusFilter]}</Badge>
                  )}
                  <ChevronDownIcon data-icon="inline-end" className="text-muted-foreground" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-48">
                <DropdownMenuRadioGroup
                  value={statusFilter}
                  onValueChange={(value) =>
                    router.replace(
                      buildHref({ status: value === "all" ? null : value }),
                    )
                  }
                >
                  {STATUS_KEYS.map((key) => (
                    <DropdownMenuRadioItem key={key} value={key}>
                      <span className="min-w-0 flex-1">{STATUS_LABELS[key]}</span>
                      <span className="ml-2 text-xs tabular-nums text-muted-foreground">
                        {counts[key]}
                      </span>
                    </DropdownMenuRadioItem>
                  ))}
                </DropdownMenuRadioGroup>
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Added: rolling window */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline">
                  Added
                  {addedFilter !== "any" && (
                    <Badge variant="secondary">{ADDED_LABELS[addedFilter]}</Badge>
                  )}
                  <ChevronDownIcon data-icon="inline-end" className="text-muted-foreground" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-44">
                <DropdownMenuRadioGroup
                  value={addedFilter}
                  onValueChange={(value) =>
                    setAddedFilter(value as typeof addedFilter)
                  }
                >
                  {(Object.keys(ADDED_LABELS) as (keyof typeof ADDED_LABELS)[]).map(
                    (key) => (
                      <DropdownMenuRadioItem key={key} value={key}>
                        {ADDED_LABELS[key]}
                      </DropdownMenuRadioItem>
                    ),
                  )}
                </DropdownMenuRadioGroup>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" onClick={exportContacts}>
              <DownloadIcon data-icon="inline-start" />
              Export
            </Button>
            <Button variant="outline" onClick={() => setImportOpen(true)}>
              <UploadIcon data-icon="inline-start" />
              Import
            </Button>
            <Button onClick={() => setAddOpen(true)}>
              <PlusIcon data-icon="inline-start" />
              Add contact
            </Button>
          </div>
        </div>

        {/* Active filters row */}
        {hasActiveFilters && (
          <div className="flex shrink-0 flex-wrap items-center gap-2 border-b border-border bg-muted/30 px-4 py-2">
            <span className="text-xs font-medium text-muted-foreground">
              Filtering:
            </span>
            {[...folderFilter].map((id) => {
              const cat = categories.find((c) => c.id === id);
              if (!cat) return null;
              return (
                <Badge key={id} variant="secondary" className="gap-1 pl-2 pr-1">
                  {cat.name}
                  <button
                    type="button"
                    aria-label={`Remove ${cat.name} filter`}
                    className="cursor-pointer rounded-full p-0.5 hover:bg-muted"
                    onClick={() => router.replace(buildHref({ folder: null }))}
                  >
                    <XIcon className="size-2.5" />
                  </button>
                </Badge>
              );
            })}
            {statusFilter !== "all" && (
              <Badge variant="secondary" className="gap-1 pl-2 pr-1">
                {STATUS_LABELS[statusFilter]}
                <button
                  type="button"
                  aria-label="Clear status filter"
                  className="cursor-pointer rounded-full p-0.5 hover:bg-muted"
                  onClick={() => router.replace(buildHref({ status: null }))}
                >
                  <XIcon className="size-2.5" />
                </button>
              </Badge>
            )}
            {addedFilter !== "any" && (
              <Badge variant="secondary" className="gap-1 pl-2 pr-1">
                {ADDED_LABELS[addedFilter]}
                <button
                  type="button"
                  aria-label="Clear added filter"
                  className="cursor-pointer rounded-full p-0.5 hover:bg-muted"
                  onClick={() => setAddedFilter("any")}
                >
                  <XIcon className="size-2.5" />
                </button>
              </Badge>
            )}
            <Button
              variant="ghost"
              size="sm"
              className="ml-auto h-6 px-2 text-xs"
              onClick={clearAllFilters}
            >
              Clear all
            </Button>
          </div>
        )}

        {/* The table fills the remaining height and scrolls on its own. */}
        <div className="min-h-0 flex-1 overflow-y-auto">
          <Table className="[&_td:first-child]:pl-4 [&_td:last-child]:pr-4 [&_th:first-child]:pl-4 [&_th:last-child]:pr-4">
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="w-10">
                  <Checkbox
                    checked={
                      allFilteredSelected
                        ? true
                        : someFilteredSelected
                          ? "indeterminate"
                          : false
                    }
                    onCheckedChange={toggleAll}
                    aria-label="Select all contacts"
                  />
                </TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Folders</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="hidden md:table-cell">Added</TableHead>
                <TableHead className="w-10" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {pageItems.length > 0 ? (
                pageItems.map((contact) => {
                  const isSelected = selected.has(contact.id);
                  const myCats = contactCategories[contact.id] || [];

                  return (
                    <TableRow
                      key={contact.id}
                      data-state={isSelected ? "selected" : undefined}
                    >
                      <TableCell>
                        <Checkbox
                          checked={isSelected}
                          onCheckedChange={() => toggleRow(contact.id)}
                          aria-label={`Select ${contact.email}`}
                        />
                      </TableCell>
                      <TableCell className="min-w-64">
                        <div className="flex min-w-0 items-center gap-3">
                          <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-medium text-muted-foreground">
                            {getInitials(contact.name, contact.email)}
                          </span>
                          <span className="min-w-0">
                            <InlineEditCell
                              value={contact.name ?? ""}
                              ariaLabel={`Edit name for ${contact.email}`}
                              placeholder="Add a name…"
                              onCommit={(next) =>
                                updateContactField(contact.id, { name: next })
                              }
                              display={
                                <span className="block truncate font-medium text-foreground">
                                  {contact.name || contact.email.split("@")[0]}
                                </span>
                              }
                            />
                            <InlineEditCell
                              value={contact.email}
                              ariaLabel={`Edit email ${contact.email}`}
                              validate={(next) => EMAIL_RE.test(next)}
                              invalidMessage="Enter a valid email address."
                              suggest={suggestEmailFix}
                              onCommit={(next) =>
                                updateContactField(contact.id, { email: next })
                              }
                              display={
                                <span className="block truncate text-xs text-muted-foreground">
                                  {contact.email}
                                </span>
                              }
                            />
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="max-w-[200px]">
                        <div className="flex flex-wrap gap-1">
                          {myCats.length > 0 ? (
                            myCats.map((c) => (
                              <Badge key={c.id} variant="secondary" className="text-[10px] px-1.5 py-0">
                                {c.name}
                              </Badge>
                            ))
                          ) : (
                            <span className="text-xs text-muted-foreground">—</span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <StatusBadge
                            status={contact.status}
                            reason={contact.suppressionReason}
                          />
                          {contact.suppressionReason &&
                            canUnsuppress(contact.suppressionReason) && (
                              <Button
                                variant="ghost"
                                size="icon-sm"
                                onClick={() => void unsuppress([contact])}
                                disabled={bulkBusy !== null}
                                aria-label={`Unsuppress ${contact.email}`}
                                title="Unsuppress"
                              >
                                <RotateCcwIcon />
                              </Button>
                            )}
                        </div>
                      </TableCell>
                      <TableCell className="hidden text-muted-foreground md:table-cell">
                        {formatDate(contact.createdAt)}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          onClick={() => void removeContact(contact)}
                          aria-label={`Delete ${contact.email}`}
                          title="Delete contact"
                        >
                          <Trash2Icon />
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })
              ) : (
                <TableRow>
                  <TableCell colSpan={6}>
                    <ContactsEmptyState
                      hasContacts={contacts.length > 0}
                      onImport={() => setImportOpen(true)}
                      onAdd={() => setAddOpen(true)}
                      onClear={() => {
                        setQuery("");
                        clearAllFilters();
                      }}
                    />
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>

        {/* Pagination bar styled exactly like campaigns list */}
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
                      setPage(Math.max(1, currentPage - 1));
                    }}
                    aria-disabled={currentPage === 1}
                    tabIndex={currentPage === 1 ? -1 : undefined}
                  />
                </PaginationItem>
                {paginationRange(currentPage, pageCount).map((entry, index) =>
                  entry === "ellipsis" ? (
                    <PaginationItem key={`ellipsis-${index}`}>
                      <PaginationEllipsis />
                    </PaginationItem>
                  ) : (
                    <PaginationItem key={entry}>
                      <PaginationLink
                        href="#"
                        isActive={entry === currentPage}
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
                      setPage(Math.min(pageCount, currentPage + 1));
                    }}
                    aria-disabled={currentPage === pageCount}
                    tabIndex={currentPage === pageCount ? -1 : undefined}
                  />
                </PaginationItem>
              </PaginationContent>
            </Pagination>
          )}
          </div>
        </div>

        <SelectionPill count={selected.size} onClear={clearSelection}>
          <Button
            variant="ghost"
            size="sm"
            className="rounded-full"
            onClick={() => {
              const initialCats = new Set<string>();
              selected.forEach((recipientId) => {
                mappings.forEach((m) => {
                  if (m.recipientId === recipientId) {
                    initialCats.add(m.categoryId);
                  }
                });
              });
              setSelectedMappingCategories(initialCats);
              setManageCategoriesOpen(true);
            }}
          >
            <FolderIcon data-icon="inline-start" />
            Add to folders
          </Button>
          {selectedHasSuppressed ? (
            <Button
              variant="ghost"
              size="sm"
              className="rounded-full"
              onClick={() => void unsuppress(selectedContacts())}
              disabled={bulkBusy !== null}
            >
              {bulkBusy === "unsuppress" ? (
                <Spinner data-icon="inline-start" />
              ) : (
                <RotateCcwIcon data-icon="inline-start" />
              )}
              Unsuppress
            </Button>
          ) : null}
          <Button
            variant="ghost"
            size="sm"
            className="rounded-full"
            onClick={() => void bulkSuppress()}
            disabled={bulkBusy !== null}
          >
            {bulkBusy === "suppress" ? (
              <Spinner data-icon="inline-start" />
            ) : (
              <BanIcon data-icon="inline-start" />
            )}
            Suppress
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="rounded-full text-destructive hover:text-destructive"
            onClick={() => void bulkDelete()}
            disabled={bulkBusy !== null}
          >
            {bulkBusy === "delete" ? (
              <Spinner data-icon="inline-start" />
            ) : (
              <Trash2Icon data-icon="inline-start" />
            )}
            Delete
          </Button>
        </SelectionPill>

      {/* dialog for single contact add */}
      <AddContactDialog
        open={addOpen}
        onOpenChange={(open) => {
          setAddOpen(open);
          if (!open) {
            setAddFolders(new Set());
            setAddNewFolder("");
            setAddError(null);
          }
        }}
        email={addEmail}
        name={addName}
        error={addError}
        adding={adding}
        onEmailChange={setAddEmail}
        onNameChange={setAddName}
        onAdd={addContact}
        onImport={() => {
          setAddOpen(false);
          setImportOpen(true);
        }}
        folders={categories}
        selectedFolders={addFolders}
        onToggleFolder={toggleAddFolder}
        newFolderValue={addNewFolder}
        onNewFolderChange={setAddNewFolder}
        onCreateFolder={createAddFolder}
        creatingFolder={addCreatingFolder}
      />

      {/* CSV importer */}
      {importOpen && (
        <ImportWizard
          onClose={() => setImportOpen(false)}
          onDone={(summary) => {
            setImportOpen(false);
            toast.success(
              `${summary.imported.toLocaleString()} contact${summary.imported === 1 ? "" : "s"} imported`,
            );
            dispatchAudienceChanged();
            void load();
          }}
        />
      )}

      {/* Folder quick create dialog */}
      <Dialog open={createFolderOpen} onOpenChange={setCreateFolderOpen}>
        <DialogPopup className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>New folder</DialogTitle>
            <DialogDescription>
              Folders group contacts so you can send a campaign to just one group.
            </DialogDescription>
          </DialogHeader>
          <DialogPanel>
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="folder-name">Folder name</FieldLabel>
              <Input
                id="folder-name"
                value={newFolderName}
                onChange={(event) => setNewFolderName(event.target.value)}
                placeholder="e.g. Newsletter, Customers, VIP"
                autoFocus
                onKeyDown={(event) => {
                  if (event.key === "Enter" && newFolderName.trim()) handleCreateCategory();
                }}
              />
            </Field>
          </FieldGroup>
          </DialogPanel>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateFolderOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreateCategory} disabled={creatingFolder || !newFolderName.trim()}>
              {creatingFolder && <Spinner data-icon="inline-start" />}
              {creatingFolder ? "Creating..." : "Create"}
            </Button>
          </DialogFooter>
        </DialogPopup>
      </Dialog>

      {/* "Add to folders" dialog for the selection */}
      <Dialog open={manageCategoriesOpen} onOpenChange={setManageCategoriesOpen}>
        <DialogPopup className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add to folders</DialogTitle>
            <DialogDescription>
              Associate the {selected.size} selected contact{selected.size === 1 ? "" : "s"} with folders.
            </DialogDescription>
          </DialogHeader>
          <DialogPanel>
          {categories.length > 0 ? (
            <FieldGroup>
              <Field>
                <FieldLabel>Select folders</FieldLabel>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className="w-full justify-between font-normal text-left h-auto min-h-9 py-1 px-3">
                      {selectedMappingCategories.size > 0 ? (
                        <div className="flex flex-wrap gap-1 max-w-[90%]">
                          {categories
                            .filter(cat => selectedMappingCategories.has(cat.id))
                            .map(cat => (
                              <Badge key={cat.id} variant="secondary" className="text-[10px] px-1.5 py-0 shrink-0">
                                {cat.name}
                              </Badge>
                            ))}
                        </div>
                      ) : (
                        <span className="text-muted-foreground">Select folders...</span>
                      )}
                      <ChevronDownIcon className="size-4 opacity-50 shrink-0 ml-2" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-80 p-0" align="start">
                    <Command>
                      <CommandInput placeholder="Search folders..." />
                      <CommandList className="max-h-[200px] overflow-y-auto">
                        <CommandEmpty>No folders found.</CommandEmpty>
                        <CommandGroup>
                          {categories.map((cat) => {
                            const isChecked = selectedMappingCategories.has(cat.id);
                            return (
                              <CommandItem
                                key={cat.id}
                                value={cat.name}
                                onSelect={() => {
                                  setSelectedMappingCategories((prev) => {
                                    const next = new Set(prev);
                                    if (next.has(cat.id)) next.delete(cat.id);
                                    else next.add(cat.id);
                                    return next;
                                  });
                                }}
                                className="flex items-center gap-2 cursor-pointer"
                              >
                                <Checkbox
                                  checked={isChecked}
                                  onCheckedChange={() => {}} // Controlled by onSelect
                                />
                                <span className="select-none">{cat.name}</span>
                              </CommandItem>
                            );
                          })}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
              </Field>
            </FieldGroup>
          ) : (
            <div className="text-sm text-muted-foreground text-center py-4">
              No folders created yet. Please create a folder first.
            </div>
          )}
          </DialogPanel>
          <DialogFooter>
            <Button variant="outline" onClick={() => setManageCategoriesOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveMapping} disabled={savingMapping || categories.length === 0 || selectedMappingCategories.size === 0}>
              {savingMapping && <Spinner data-icon="inline-start" />}
              {savingMapping ? "Saving..." : "Save"}
            </Button>
          </DialogFooter>
        </DialogPopup>
      </Dialog>

      {/* Folders CRUD see-more sidebar Sheet - With Padding */}
      <Sheet open={seeMoreOpen} onOpenChange={setSeeMoreOpen}>
        <SheetContent className="w-full sm:max-w-md p-6">
          <SheetHeader className="p-0 pb-4">
            <SheetTitle>All folders</SheetTitle>
            <SheetDescription>
              Create, rename, or delete folders to organize your audience.
            </SheetDescription>
          </SheetHeader>
          
          <div className="flex flex-col gap-4 py-4 min-h-0 flex-1 overflow-hidden">
            {/* Quick add category inside sidebar */}
            <div className="flex gap-2">
              <Input
                value={newFolderName}
                onChange={(event) => setNewFolderName(event.target.value)}
                placeholder="New folder name..."
                onKeyDown={(event) => {
                  if (event.key === "Enter" && newFolderName.trim()) handleCreateCategory();
                }}
              />
              <Button
                size="icon-sm"
                onClick={handleCreateCategory}
                disabled={!newFolderName.trim()}
                aria-label="Create folder"
              >
                <PlusIcon className="size-4" />
              </Button>
            </div>

            {/* Scrollable list of categories */}
            <div className="flex-1 overflow-y-auto pr-1">
              {categories.length > 0 ? (
                <div className="flex flex-col gap-2">
                  {categories.map((cat, idx) => {
                    const isEditing = editingCategoryId === cat.id;
                    const color = FOLDER_COLORS[idx % FOLDER_COLORS.length]!;
                    const isFiltered = folderFilter.has(cat.id);

                    return (
                      <div
                        key={cat.id}
                        className={cn(
                          "flex items-center justify-between p-3 rounded-lg border bg-card/50 transition-colors hover:bg-muted/10",
                          isFiltered && "border-primary/50 bg-primary/5"
                        )}
                      >
                        {isEditing ? (
                          <div className="flex flex-1 items-center gap-2">
                            <Input
                              value={editingCategoryName}
                              onChange={(e) => setEditingCategoryName(e.target.value)}
                              className="h-8 py-1"
                              autoFocus
                              onKeyDown={(e) => {
                                if (e.key === "Enter") handleRenameCategory(cat.id, editingCategoryName);
                                else if (e.key === "Escape") setEditingCategoryId(null);
                              }}
                            />
                            <Button
                              variant="ghost"
                              size="icon-sm"
                              className="text-emerald-500 hover:text-emerald-600 hover:bg-emerald-500/10"
                              onClick={() => handleRenameCategory(cat.id, editingCategoryName)}
                            >
                              <CheckIcon className="size-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon-sm"
                              className="text-muted-foreground"
                              onClick={() => setEditingCategoryId(null)}
                            >
                              <XIcon className="size-4" />
                            </Button>
                          </div>
                        ) : (
                          <>
                            <div
                              className="flex flex-1 items-center gap-3 cursor-pointer min-w-0"
                              onClick={() => {
                                router.replace(buildHref({ folder: cat.id }));
                                setSeeMoreOpen(false);
                              }}
                            >
                              <FolderIcon className={cn("size-4 shrink-0", color.text)} />
                              <span className="truncate text-sm font-semibold text-foreground">
                                {cat.name}
                              </span>
                              <span className="text-xs text-muted-foreground">
                                ({categoryCounts[cat.id] || 0})
                              </span>
                            </div>
                            <div className="flex items-center gap-1">
                              <Button
                                variant="ghost"
                                size="icon-sm"
                                onClick={() => {
                                  setEditingCategoryId(cat.id);
                                  setEditingCategoryName(cat.name);
                                }}
                              >
                                <Edit2Icon className="size-3.5 text-muted-foreground" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon-sm"
                                className="hover:bg-destructive/10 hover:text-destructive"
                                onClick={() => handleDeleteCategory(cat.id)}
                              >
                                <Trash2Icon className="size-3.5 text-muted-foreground hover:text-destructive" />
                              </Button>
                            </div>
                          </>
                        )}
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="text-sm text-muted-foreground text-center py-8">
                  No folders yet.
                </div>
              )}
            </div>
          </div>
        </SheetContent>
      </Sheet>

    </div>
  );
}

function StatusBadge({
  status,
  reason,
}: {
  status: Contact["status"];
  reason: string | null;
}) {
  // The label names the reason ("Unsubscribed", "Complained"), and a locked
  // suppression says on hover why it can't be undone.
  const explanation = lockedSuppressionExplanation(reason);
  return (
    <Badge variant={STATUS_BADGE_VARIANTS[status]} title={explanation ?? undefined}>
      <span className="size-1.5 rounded-full bg-current" />
      {reason ? suppressionLabel(reason) : STATUS_LABELS[status]}
    </Badge>
  );
}

function ContactsEmptyState({
  hasContacts,
  onImport,
  onAdd,
  onClear,
}: {
  hasContacts: boolean;
  onImport: () => void;
  onAdd: () => void;
  onClear: () => void;
}) {
  return (
    <Empty className="border-0 py-14">
      <EmptyHeader>
        <EmptyMedia>
          <IconStack aria-hidden="true" className="h-24 w-22">
            <UserRoundIcon className="size-5" />
          </IconStack>
        </EmptyMedia>
        <EmptyTitle>
          {hasContacts ? "No contacts match your filters" : "No contacts yet"}
        </EmptyTitle>
        <EmptyDescription>
          {hasContacts
            ? "Try a different search term or clear the active filter."
            : "Import a list or add contacts one at a time."}
        </EmptyDescription>
      </EmptyHeader>
      <EmptyContent>
        {hasContacts ? (
          <Button variant="outline" onClick={onClear}>
            Clear filters
          </Button>
        ) : (
          <div className="flex flex-wrap items-center justify-center gap-2">
            <Button onClick={onImport}>
              <UploadIcon data-icon="inline-start" />
              Import contacts
            </Button>
            <Button variant="outline" onClick={onAdd}>
              <PlusIcon data-icon="inline-start" />
              Add contact
            </Button>
          </div>
        )}
      </EmptyContent>
    </Empty>
  );
}

function AddContactDialog({
  open,
  onOpenChange,
  email,
  name,
  error,
  adding,
  onEmailChange,
  onNameChange,
  onAdd,
  onImport,
  folders,
  selectedFolders,
  onToggleFolder,
  newFolderValue,
  onNewFolderChange,
  onCreateFolder,
  creatingFolder,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  email: string;
  name: string;
  error: string | null;
  adding: boolean;
  onEmailChange: (value: string) => void;
  onNameChange: (value: string) => void;
  onAdd: () => void;
  onImport: () => void;
  folders: Category[];
  selectedFolders: Set<string>;
  onToggleFolder: (id: string) => void;
  newFolderValue: string;
  onNewFolderChange: (value: string) => void;
  onCreateFolder: () => void;
  creatingFolder: boolean;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogPopup className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add contact</DialogTitle>
          <DialogDescription>
            Add a single contact or jump into the importer for a larger list.
          </DialogDescription>
        </DialogHeader>

        <DialogPanel>
        <FieldGroup className="gap-5">
          <Field>
            <FieldLabel htmlFor="contact-email">Email</FieldLabel>
            <Input
              id="contact-email"
              value={email}
              onChange={(event) => onEmailChange(event.target.value)}
              placeholder="email@example.com"
              autoFocus
              onKeyDown={(event) => {
                if (event.key === "Enter" && email.trim()) onAdd();
              }}
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="contact-name">Name (optional)</FieldLabel>
            <Input
              id="contact-name"
              value={name}
              onChange={(event) => onNameChange(event.target.value)}
              placeholder="Jane Doe"
              onKeyDown={(event) => {
                if (event.key === "Enter" && email.trim()) onAdd();
              }}
            />
          </Field>

          <Field>
            <FieldLabel>Add to folder (optional)</FieldLabel>
            {folders.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {folders.map((folder) => {
                  const on = selectedFolders.has(folder.id);
                  return (
                    <button
                      key={folder.id}
                      type="button"
                      onClick={() => onToggleFolder(folder.id)}
                      className={cn(
                        "rounded-full border px-2.5 py-1 text-xs font-medium transition-colors",
                        on
                          ? "border-primary bg-primary/10 text-foreground"
                          : "border-border text-muted-foreground hover:border-muted-foreground/50 hover:text-foreground",
                      )}
                    >
                      {folder.name}
                    </button>
                  );
                })}
              </div>
            )}
            <div className="flex gap-2">
              <Input
                value={newFolderValue}
                onChange={(event) => onNewFolderChange(event.target.value)}
                placeholder={
                  folders.length > 0
                    ? "Or create a new folder…"
                    : "Create a folder…"
                }
                onKeyDown={(event) => {
                  if (event.key === "Enter" && newFolderValue.trim()) {
                    event.preventDefault();
                    onCreateFolder();
                  }
                }}
              />
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={onCreateFolder}
                disabled={creatingFolder || !newFolderValue.trim()}
                aria-label="Create folder"
              >
                {creatingFolder ? <Spinner /> : <PlusIcon className="size-4" />}
              </Button>
            </div>
          </Field>

          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <Button variant="outline" onClick={onImport}>
            <UploadIcon data-icon="inline-start" />
            Import CSV / XLSX
          </Button>
        </FieldGroup>
        </DialogPanel>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={onAdd} disabled={adding || !email.trim()}>
            {adding && <Spinner data-icon="inline-start" />}
            {adding ? "Adding..." : "Add contact"}
          </Button>
        </DialogFooter>
      </DialogPopup>
    </Dialog>
  );
}
