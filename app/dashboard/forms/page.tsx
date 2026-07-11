"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Loader2Icon, MailPlusIcon, PlusIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { FormCard } from "@/components/dashboard/forms/form-card";
import { FormSettingsDialog } from "@/components/dashboard/forms/form-settings-dialog";
import { FormTemplatePicker } from "@/components/dashboard/forms/form-template-picker";
import type {
  SignupFormRow,
  SignupFormSettingsInput,
} from "@/components/dashboard/forms/types";

function FormsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [forms, setForms] = useState<SignupFormRow[]>([]);
  const [baseUrl, setBaseUrl] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [pickerOpen, setPickerOpen] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<SignupFormRow | null>(null);
  const [preset, setPreset] = useState<SignupFormSettingsInput | null>(null);

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

  // Honor ?create=1 from the sidebar's "New form", then strip it so a refresh
  // doesn't reopen the picker.
  useEffect(() => {
    if (searchParams.get("create") === "1") {
      setPickerOpen(true);
      router.replace("/dashboard/forms");
    }
  }, [searchParams, router]);

  // Creating a form is two steps: pick a template, then customize it.
  function openCreate() {
    setPickerOpen(true);
  }

  function handlePickTemplate(settings: SignupFormSettingsInput) {
    setPreset(settings);
    setEditing(null);
    setPickerOpen(false);
    setDialogOpen(true);
  }

  function openEdit(form: SignupFormRow) {
    setEditing(form);
    setDialogOpen(true);
  }

  function handleSaved(saved: SignupFormRow) {
    setForms((prev) => {
      const exists = prev.some((f) => f.id === saved.id);
      return exists
        ? prev.map((f) => (f.id === saved.id ? saved : f))
        : [saved, ...prev];
    });
  }

  function handleDeleted(id: string) {
    setForms((prev) => prev.filter((f) => f.id !== id));
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-lg font-semibold">Signup forms</h1>
          <p className="text-sm text-muted-foreground">
            Embeddable subscribe forms for your website — new subscribers flow
            straight into your audience.
          </p>
        </div>
        {forms.length > 0 && (
          <Button onClick={openCreate}>
            <PlusIcon data-icon="inline-start" />
            New form
          </Button>
        )}
      </div>

      {loading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2Icon className="size-4 animate-spin" />
          Loading forms…
        </div>
      ) : error ? (
        <p className="text-sm text-destructive">{error}</p>
      ) : forms.length === 0 ? (
        <Empty className="border">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <MailPlusIcon />
            </EmptyMedia>
            <EmptyTitle>No forms yet</EmptyTitle>
            <EmptyDescription>
              Create a signup form, then drop its one-line snippet onto any
              website. People who subscribe get added to your audience after they
              confirm their email.
            </EmptyDescription>
          </EmptyHeader>
          <EmptyContent>
            <Button onClick={openCreate}>
              <PlusIcon data-icon="inline-start" />
              Create your first form
            </Button>
          </EmptyContent>
        </Empty>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {forms.map((form) => (
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

      <FormTemplatePicker
        open={pickerOpen}
        onOpenChange={setPickerOpen}
        onSelect={handlePickTemplate}
      />

      <FormSettingsDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        initial={editing}
        preset={preset}
        onSaved={handleSaved}
      />
    </div>
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
