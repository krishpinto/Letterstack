"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  BanIcon,
  CheckIcon,
  ChevronDownIcon,
  DownloadIcon,
  Edit2Icon,
  FilterIcon,
  FolderIcon,
  FolderPlusIcon,
  FolderOpenIcon,
  PlusIcon,
  SearchIcon,
  TagIcon,
  Trash2Icon,
  UploadIcon,
  UserRoundIcon,
  XIcon,
} from "lucide-react";

import { ImportWizard } from "./import-wizard";
import { onOrganizationChanged } from "@/lib/dashboard-events";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
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
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
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
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
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
type Contact = Recipient & { status: "subscribed" | "bounced" | "suppressed" };
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

const PAGE_SIZE = 8;

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

export default function AudiencePage() {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [mappings, setMappings] = useState<Mapping[]>([]);
  
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusKey>("all");
  const [activeCategoryFilter, setActiveCategoryFilter] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [toast, setToast] = useState<string | null>(null);
  
  // Importers / Single contact add dialogs
  const [addOpen, setAddOpen] = useState(false);
  const [addEmail, setAddEmail] = useState("");
  const [addName, setAddName] = useState("");
  const [addError, setAddError] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  
  // Folder quick create dialog
  const [createFolderOpen, setCreateFolderOpen] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");
  const [creatingFolder, setCreatingFolder] = useState(false);
  
  // Sheet categories see-more dialog
  const [seeMoreOpen, setSeeMoreOpen] = useState(false);
  const [editingCategoryId, setEditingCategoryId] = useState<string | null>(null);
  const [editingCategoryName, setEditingCategoryName] = useState("");
  
  // Selection mapping dialog
  const [manageCategoriesOpen, setManageCategoriesOpen] = useState(false);
  const [selectedMappingCategories, setSelectedMappingCategories] = useState<Set<string>>(new Set());
  const [savingMapping, setSavingMapping] = useState(false);

  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const loadCategories = useCallback(async () => {
    try {
      const r = await fetch("/api/audience/categories");
      const data = await r.json();
      if (data.ok) {
        setCategories(data.categories);
        setMappings(data.mappings);
      }
    } catch (err) {
      console.error("Failed to load categories:", err);
    }
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [recipientResponse, suppressionResponse] = await Promise.all([
        fetch("/api/audience").then((response) => response.json()),
        fetch("/api/audience/suppression").then((response) => response.json()),
      ]);

      if (!recipientResponse.ok || !suppressionResponse.ok) {
        setContacts([]);
        return;
      }

      const suppMap = new Map<string, string>();
      (suppressionResponse.suppressed as SuppressedEntry[]).forEach((entry) =>
        suppMap.set(entry.email, entry.reason),
      );

      const merged: Contact[] = (recipientResponse.recipients as Recipient[]).map(
        (recipient) => {
          const reason = suppMap.get(recipient.email);
          let status: Contact["status"] = "subscribed";
          if (reason === "bounce" || reason === "complaint") {
            status = "bounced";
          } else if (reason) {
            status = "suppressed";
          }
          return { ...recipient, status };
        },
      );

      setContacts(merged);
      await loadCategories();
    } catch {
      setContacts([]);
    } finally {
      setLoading(false);
    }
  }, [loadCategories]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    return onOrganizationChanged(() => {
      setSelected(new Set());
      setQuery("");
      setStatusFilter("all");
      setActiveCategoryFilter(null);
      setPage(1);
      void load();
    });
  }, [load]);

  useEffect(() => {
    setPage(1);
  }, [query, statusFilter, activeCategoryFilter]);

  const showToast = useCallback((message: string) => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToast(message);
    toastTimer.current = setTimeout(() => setToast(null), 2600);
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    
    const categoryRecipientIds = activeCategoryFilter
      ? new Set(mappings.filter((m) => m.categoryId === activeCategoryFilter).map((m) => m.recipientId))
      : null;

    return contacts.filter((contact) => {
      if (statusFilter !== "all" && contact.status !== statusFilter) return false;
      if (categoryRecipientIds && !categoryRecipientIds.has(contact.id)) return false;
      if (
        q &&
        !`${contact.name || ""} ${contact.email}`.toLowerCase().includes(q)
      ) {
        return false;
      }
      return true;
    });
  }, [contacts, query, statusFilter, activeCategoryFilter, mappings]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pageStart = (page - 1) * PAGE_SIZE;
  const pageItems = filtered.slice(pageStart, pageStart + PAGE_SIZE);
  const firstShown = filtered.length > 0 ? pageStart + 1 : 0;
  const lastShown = Math.min(pageStart + PAGE_SIZE, filtered.length);

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

  async function removeContact(id: string) {
    const response = await fetch(`/api/audience?id=${id}`, {
      method: "DELETE",
    }).then((result) => result.json());

    if (response.ok) {
      showToast("Contact removed");
      setSelected((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
      await load();
    }
  }

  async function bulkDelete() {
    const ids = [...selected];
    if (ids.length === 0) return;

    for (const id of ids) {
      await fetch(`/api/audience?id=${id}`, { method: "DELETE" });
    }

    showToast(`${ids.length} contact${ids.length === 1 ? "" : "s"} removed`);
    clearSelection();
    await load();
  }

  async function bulkSuppress() {
    const emails = contacts
      .filter((contact) => selected.has(contact.id))
      .map((contact) => contact.email);
    if (emails.length === 0) return;

    for (const email of emails) {
      await fetch("/api/audience/suppression", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
    }

    showToast(`${emails.length} contact${emails.length === 1 ? "" : "s"} suppressed`);
    clearSelection();
    await load();
  }

  function exportContacts() {
    const escapeCsv = (value: string) => `"${value.replaceAll('"', '""')}"`;
    const rows = [
      ["Name", "Email", "Status", "Added"],
      ...contacts.map((contact) => [
        contact.name ?? "",
        contact.email,
        contact.status,
        contact.createdAt,
      ]),
    ];
    const csv = rows
      .map((row) => row.map((value) => escapeCsv(String(value))).join(","))
      .join("\r\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "letterstack-audience.csv";
    anchor.click();
    URL.revokeObjectURL(url);
  }

  async function addContact() {
    setAdding(true);
    setAddError(null);

    try {
      const response = await fetch("/api/audience", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: addEmail, name: addName || undefined }),
      }).then((result) => result.json());

      if (!response.ok) {
        setAddError(response.error);
        return;
      }

      setAddEmail("");
      setAddName("");
      setAddOpen(false);
      showToast("Contact added");
      await load();
    } finally {
      setAdding(false);
    }
  }

  // ── Category Actions ────────────────────────────────────────────────────────

  async function handleCreateCategory() {
    if (!newFolderName.trim()) return;
    setCreatingFolder(true);
    try {
      const r = await fetch("/api/audience/categories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "create", name: newFolderName }),
      });
      const data = await r.json();
      if (data.ok) {
        showToast("Folder created");
        setNewFolderName("");
        setCreateFolderOpen(false);
        await loadCategories();
      } else {
        showToast(data.error || "Failed to create category");
      }
    } catch {
      showToast("Failed to create category");
    } finally {
      setCreatingFolder(false);
    }
  }

  async function handleRenameCategory(id: string, name: string) {
    if (!name.trim()) return;
    try {
      const r = await fetch("/api/audience/categories", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, name }),
      });
      const data = await r.json();
      if (data.ok) {
        showToast("Folder renamed");
        setEditingCategoryId(null);
        await loadCategories();
      } else {
        showToast(data.error || "Failed to rename folder");
      }
    } catch {
      showToast("Failed to rename folder");
    }
  }

  async function handleDeleteCategory(id: string) {
    if (!confirm("Are you sure you want to delete this folder? Contacts inside will not be deleted.")) return;
    try {
      const r = await fetch(`/api/audience/categories?id=${id}`, {
        method: "DELETE",
      });
      const data = await r.json();
      if (data.ok) {
        showToast("Folder deleted");
        if (activeCategoryFilter === id) {
          setActiveCategoryFilter(null);
        }
        await loadCategories();
      } else {
        showToast(data.error || "Failed to delete folder");
      }
    } catch {
      showToast("Failed to delete folder");
    }
  }

  async function handleSaveMapping() {
    setSavingMapping(true);
    try {
      const r = await fetch("/api/audience/categories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "map",
          recipientIds: Array.from(selected),
          categoryIds: Array.from(selectedMappingCategories),
        }),
      });
      const data = await r.json();
      if (data.ok) {
        showToast("Categories updated");
        setManageCategoriesOpen(false);
        clearSelection();
        await loadCategories();
      } else {
        showToast(data.error || "Failed to update categories");
      }
    } catch {
      showToast("Failed to update categories");
    } finally {
      setSavingMapping(false);
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-64 items-center justify-center gap-2 text-sm text-muted-foreground">
        <Spinner />
        Loading audience...
      </div>
    );
  }

  const top3 = categories.slice(0, 3);
  const activeFilterName = activeCategoryFilter
    ? categories.find((c) => c.id === activeCategoryFilter)?.name
    : null;

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex flex-col justify-between gap-3 md:flex-row md:items-end">
        <div>
          <h1 className="text-2xl font-semibold tracking-normal">Audience</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            <span className="font-medium text-foreground">{contacts.length}</span>{" "}
            contacts in this organization: {counts.subscribed} subscribed, {counts.bounced} bounced,
            and {counts.suppressed} suppressed.
          </p>
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

      {/* Folders Grid - Compact Padding */}
      <div className="flex flex-col gap-2.5">
        <div className="flex items-center justify-between">
          <h2 className="text-xs font-semibold tracking-wide uppercase text-muted-foreground">Folders</h2>
          {categories.length > 3 && (
            <Button variant="ghost" size="sm" onClick={() => setSeeMoreOpen(true)} className="h-7 text-xs text-primary hover:text-primary p-0">
              See more ({categories.length - 3})
            </Button>
          )}
        </div>
        <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
          {top3.map((cat, idx) => {
            const color = FOLDER_COLORS[idx % FOLDER_COLORS.length]!;
            const isFiltered = activeCategoryFilter === cat.id;
            return (
              <Card
                key={cat.id}
                className={cn(
                  "cursor-pointer transition-all hover:bg-muted/10 active:scale-[0.98] p-0",
                  isFiltered && "ring-2 ring-primary bg-muted/20 hover:bg-muted/20"
                )}
                onClick={() => setActiveCategoryFilter(isFiltered ? null : cat.id)}
              >
                <CardContent className="flex items-center gap-3 p-3">
                  <div className={cn("flex size-9 shrink-0 items-center justify-center rounded-lg", color.bg)}>
                    {isFiltered ? (
                      <FolderOpenIcon className={cn("size-4.5", color.text)} />
                    ) : (
                      <FolderIcon className={cn("size-4.5", color.text)} />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <h3 className="truncate text-xs font-semibold text-foreground">{cat.name}</h3>
                    <p className="mt-0.5 text-[10px] text-muted-foreground">
                      {categoryCounts[cat.id] || 0} contact{(categoryCounts[cat.id] || 0) === 1 ? "" : "s"}
                    </p>
                  </div>
                </CardContent>
              </Card>
            );
          })}

          <Card
            className="border-dashed cursor-pointer transition-all hover:bg-muted/10 active:scale-[0.98] flex items-center justify-center h-[62px]"
            onClick={() => setCreateFolderOpen(true)}
          >
            <CardContent className="flex items-center gap-2 p-0 text-muted-foreground text-xs font-medium">
              <FolderPlusIcon className="size-4" />
              New folder
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Main Table section */}
      <section className="flex flex-col gap-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-2">
            <p className="text-sm text-muted-foreground">
              {filtered.length} of {contacts.length} contact{contacts.length === 1 ? "" : "s"} shown
            </p>
            {activeFilterName && (
              <Badge variant="secondary" className="gap-1 pl-2 pr-1">
                Folder: {activeFilterName}
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-3.5 p-0 hover:bg-muted"
                  onClick={() => setActiveCategoryFilter(null)}
                >
                  <XIcon className="size-2.5" />
                </Button>
              </Badge>
            )}
          </div>

          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <div className="relative min-w-0 sm:w-72">
              <SearchIcon className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search name or email..."
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
                  {(["all", "subscribed", "bounced", "suppressed"] as StatusKey[]).map(
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

        {/* Table wrapper with scroll to prevent page scroll */}
        <div className="overflow-auto max-h-[450px] rounded-lg border border-border bg-card">
          <Table>
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
                            <span className="block truncate font-medium text-foreground">
                              {contact.name || contact.email.split("@")[0]}
                            </span>
                            <span className="block truncate text-xs text-muted-foreground">
                              {contact.email}
                            </span>
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
                        <StatusBadge status={contact.status} />
                      </TableCell>
                      <TableCell className="hidden text-muted-foreground md:table-cell">
                        {formatDate(contact.createdAt)}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          onClick={() => removeContact(contact.id)}
                          title="Remove contact"
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
                      onClear={() => {
                        setQuery("");
                        setStatusFilter("all");
                        setActiveCategoryFilter(null);
                      }}
                    />
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>

        {/* Pagination bar styled exactly like campaigns list */}
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

        {/* Selected contacts options alert placed below pagination */}
        {selected.size > 0 && (
          <Alert>
            <AlertDescription className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <span>
                {selected.size} contact{selected.size === 1 ? "" : "s"} selected
              </span>
              <span className="flex gap-2">
                <Button variant="ghost" size="sm" onClick={clearSelection}>
                  Clear
                </Button>
                <Button variant="outline" size="sm" onClick={() => {
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
                }}>
                  <TagIcon data-icon="inline-start" />
                  Add to folders
                </Button>
                <Button variant="outline" size="sm" onClick={bulkSuppress}>
                  <BanIcon data-icon="inline-start" />
                  Suppress
                </Button>
                <Button variant="destructive" size="sm" onClick={bulkDelete}>
                  <Trash2Icon data-icon="inline-start" />
                  Delete
                </Button>
              </span>
            </AlertDescription>
          </Alert>
        )}
      </section>

      {/* dialog for single contact add */}
      <AddContactDialog
        open={addOpen}
        onOpenChange={setAddOpen}
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
      />

      {/* CSV importer */}
      {importOpen && (
        <ImportWizard
          onClose={() => setImportOpen(false)}
          onDone={(summary) => {
            setImportOpen(false);
            showToast(
              `${summary.imported} contact${summary.imported === 1 ? "" : "s"} imported`,
            );
            load();
          }}
        />
      )}

      {/* Folder quick create dialog */}
      <Dialog open={createFolderOpen} onOpenChange={setCreateFolderOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>New folder</DialogTitle>
            <DialogDescription>
              Create a new category folder to organize your contacts.
            </DialogDescription>
          </DialogHeader>
          <FieldGroup className="py-2">
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
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateFolderOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreateCategory} disabled={creatingFolder || !newFolderName.trim()}>
              {creatingFolder && <Spinner data-icon="inline-start" />}
              {creatingFolder ? "Creating..." : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Manage categories dialog for selection */}
      <Dialog open={manageCategoriesOpen} onOpenChange={setManageCategoriesOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add to folders</DialogTitle>
            <DialogDescription>
              Associate the {selected.size} selected contact{selected.size === 1 ? "" : "s"} with folders.
            </DialogDescription>
          </DialogHeader>
          {categories.length > 0 ? (
            <FieldGroup className="py-2">
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
          <DialogFooter>
            <Button variant="outline" onClick={() => setManageCategoriesOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveMapping} disabled={savingMapping || categories.length === 0 || selectedMappingCategories.size === 0}>
              {savingMapping && <Spinner data-icon="inline-start" />}
              {savingMapping ? "Saving..." : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
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
              <Button size="icon-sm" onClick={handleCreateCategory} disabled={!newFolderName.trim()}>
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
                    const isFiltered = activeCategoryFilter === cat.id;

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
                                setActiveCategoryFilter(isFiltered ? null : cat.id);
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

      {/* Toast notification */}
      {toast && (
        <div className="fixed bottom-6 left-1/2 z-[60] -translate-x-1/2 rounded-lg border border-border bg-card px-4 py-3 text-sm font-medium text-card-foreground shadow-lg">
          {toast}
        </div>
      )}
    </div>
  );
}

function StatusBadge({ status }: { status: Contact["status"] }) {
  return (
    <Badge variant={STATUS_BADGE_VARIANTS[status]}>
      <span className="size-1.5 rounded-full bg-current" />
      {STATUS_LABELS[status]}
    </Badge>
  );
}

function ContactsEmptyState({
  hasContacts,
  onClear,
}: {
  hasContacts: boolean;
  onClear: () => void;
}) {
  return (
    <Empty className="border-0 py-14">
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <UserRoundIcon />
        </EmptyMedia>
        <EmptyTitle>
          {hasContacts ? "No contacts match your filters" : "No audience contacts yet"}
        </EmptyTitle>
        <EmptyDescription>
          {hasContacts
            ? "Try a different search term or clear the active filter."
            : "Import a list or add recipients one at a time."}
        </EmptyDescription>
      </EmptyHeader>
      {hasContacts && (
        <EmptyContent>
          <Button variant="outline" onClick={onClear}>
            Clear filters
          </Button>
        </EmptyContent>
      )}
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
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add recipient</DialogTitle>
          <DialogDescription>
            Add a single recipient or jump into the importer for a larger list.
          </DialogDescription>
        </DialogHeader>

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

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={onAdd} disabled={adding || !email.trim()}>
            {adding && <Spinner data-icon="inline-start" />}
            {adding ? "Adding..." : "Add contact"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
