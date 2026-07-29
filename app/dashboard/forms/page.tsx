"use client";

import {
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { MailPlusIcon, PlusIcon, SearchIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { Input } from "@/components/ui/input";
import { PageLoader } from "@/components/bar-spinner";
import { FormCard } from "@/components/dashboard/forms/form-card";
import type { SignupFormRow } from "@/components/dashboard/forms/types";
import type { FormType } from "@/db/signup-forms";

type TypeKey = "all" | FormType;

const TYPE_LABELS: Record<TypeKey, string> = {
  all: "All",
  static: "Static",
  popup: "Popup",
  animated: "Animated",
};

const TYPE_ORDER: FormType[] = ["static", "popup", "animated"];

function FormsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [forms, setForms] = useState<SignupFormRow[]>([]);
  const [baseUrl, setBaseUrl] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState<TypeKey>("all");

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/forms");
      const data = await res.json();
      if (data.ok) {
        setForms(data.forms);
        setBaseUrl(data.baseUrl);
      } else {
        setError(data.error ?? "Could not load your forms.");
      }
    } catch {
      setError("Could not reach the server.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  // Honor ?create=1 from the sidebar's "New form" by forwarding into the
  // create flow (type → template → editor).
  useEffect(() => {
    if (searchParams.get("create") === "1") {
      router.replace("/dashboard/forms/new");
    }
  }, [searchParams, router]);

  function openCreate() {
    router.push("/dashboard/forms/new");
  }

  function openEdit(form: SignupFormRow) {
    router.push(`/editor/form/${form.id}`);
  }

  function handleDeleted(id: string) {
    setForms((prev) => prev.filter((f) => f.id !== id));
  }

  // Query narrows first; the type chips show per-type counts of the searched
  // set so search and type filters compose visibly (same as campaigns).
  const searched = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return forms;
    return forms.filter((form) =>
      `${form.name} ${form.headline}`.toLowerCase().includes(q),
    );
  }, [forms, query]);

  const typeCounts = useMemo(() => {
    const counts: Record<FormType, number> = {
      static: 0,
      popup: 0,
      animated: 0,
    };
    for (const form of searched) {
      counts[form.formType ?? "static"] += 1;
    }
    return counts;
  }, [searched]);

  const filtered = useMemo(
    () =>
      typeFilter === "all"
        ? searched
        : searched.filter((form) => (form.formType ?? "static") === typeFilter),
    [searched, typeFilter],
  );

  return (
    // Full-bleed like campaigns/audience: toolbar band, scrolling card grid,
    // footer band — the page manages its own scroll.
    <div className="flex min-h-0 flex-1 flex-col bg-background">
      {/* ── Toolbar ── */}
      <div className="flex shrink-0 flex-col gap-3 border-b border-border px-4 py-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex min-w-0 items-center gap-1 overflow-x-auto whitespace-nowrap">
          <TypeChip
            label={TYPE_LABELS.all}
            count={searched.length}
            active={typeFilter === "all"}
            onClick={() => setTypeFilter("all")}
          />
          {TYPE_ORDER.map((type) => (
            <TypeChip
              key={type}
              label={TYPE_LABELS[type]}
              count={typeCounts[type]}
              active={typeFilter === type}
              onClick={() =>
                setTypeFilter(typeFilter === type ? "all" : type)
              }
            />
          ))}
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <div className="relative min-w-0 sm:w-72">
            <SearchIcon className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search forms..."
              className="pl-8"
            />
          </div>
          <Button onClick={openCreate}>
            <PlusIcon data-icon="inline-start" />
            New form
          </Button>
        </div>
      </div>

      {/* ── Card grid ── */}
      <div className="min-h-0 flex-1 overflow-y-auto p-4">
        {loading ? (
          <PageLoader label="Loading forms..." />
        ) : error ? (
          <p className="text-sm text-destructive">{error}</p>
        ) : filtered.length === 0 ? (
          <FormsEmptyState hasForms={forms.length > 0} onCreate={openCreate} />
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {filtered.map((form) => (
              <FormCard
                key={form.id}
                form={form}
                baseUrl={baseUrl}
                onEdit={openEdit}
                onDeleted={handleDeleted}
              />
            ))}
          </div>
        )}
      </div>

      {/* ── Footer ── */}
      <div className="flex shrink-0 items-center border-t border-border px-4 py-2">
        <p className="text-sm text-muted-foreground">
          Showing {filtered.length} of {forms.length}{" "}
          {forms.length === 1 ? "form" : "forms"}
        </p>
      </div>
    </div>
  );
}

function TypeChip({
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

function FormsEmptyState({
  hasForms,
  onCreate,
}: {
  hasForms: boolean;
  onCreate: () => void;
}) {
  return (
    <Empty className="border-0 py-14">
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <MailPlusIcon />
        </EmptyMedia>
        <EmptyTitle>
          {hasForms ? "No forms match your filters" : "No forms yet"}
        </EmptyTitle>
        <EmptyDescription>
          {hasForms
            ? "Try a different search or type filter."
            : "Create a signup form, then drop its one-line snippet onto any website. People who subscribe get added to your audience after they confirm their email."}
        </EmptyDescription>
      </EmptyHeader>
      {!hasForms && (
        <EmptyContent>
          <Button onClick={onCreate}>
            <PlusIcon data-icon="inline-start" />
            Create your first form
          </Button>
        </EmptyContent>
      )}
    </Empty>
  );
}

export default function FormsPageWrapper() {
  // useSearchParams needs a Suspense boundary for prerendering.
  return (
    <Suspense fallback={null}>
      <FormsPage />
    </Suspense>
  );
}
