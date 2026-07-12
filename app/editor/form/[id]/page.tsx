"use client";

import * as React from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeftIcon, Loader2Icon } from "lucide-react";

import { alertDialog } from "@/components/app-dialogs";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { FormFields } from "@/components/dashboard/forms/form-fields";
import { FormPreview } from "@/components/dashboard/forms/form-preview";
import {
  DEFAULT_FORM_SETTINGS,
  type SignupFormSettingsInput,
} from "@/components/dashboard/forms/types";

export default function EditFormPage() {
  const params = useParams();
  const id = params.id as string;
  const router = useRouter();

  const [values, setValues] = React.useState<SignupFormSettingsInput | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [savedAt, setSavedAt] = React.useState<number | null>(null);

  React.useEffect(() => {
    let active = true;
    (async () => {
      try {
        const res = await fetch(`/api/forms/${id}`);
        const data = await res.json();
        if (!active) return;
        if (data.ok && data.form) {
          const f = data.form;
          setValues({
            name: f.name,
            formType: f.formType ?? "static",
            headline: f.headline,
            description: f.description,
            buttonLabel: f.buttonLabel,
            successMessage: f.successMessage,
            accentColor: f.accentColor,
            collectName: f.collectName,
            layout: f.layout,
            theme: f.theme,
            cornerStyle: f.cornerStyle,
          });
        } else {
          await alertDialog({ title: "Form not found" });
          router.push("/dashboard/forms");
        }
      } catch {
        if (!active) return;
        await alertDialog({ title: "Could not load this form" });
        router.push("/dashboard/forms");
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [id, router]);

  function set<K extends keyof SignupFormSettingsInput>(
    key: K,
    value: SignupFormSettingsInput[K],
  ) {
    setValues((prev) => (prev ? { ...prev, [key]: value } : prev));
    setSavedAt(null);
  }

  async function save() {
    if (!values) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/forms/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });
      const data = await res.json();
      if (data.ok) {
        setSavedAt(Date.now());
      } else {
        setError(data.error ?? "Could not save the form.");
      }
    } catch {
      setError("Could not reach the server.");
    } finally {
      setBusy(false);
    }
  }

  if (loading || !values) {
    return (
      <div className="flex h-screen items-center justify-center gap-2 bg-background text-sm text-muted-foreground">
        <Spinner />
        Loading form…
      </div>
    );
  }

  const preview = values ?? DEFAULT_FORM_SETTINGS;

  return (
    <div className="flex h-screen flex-col bg-background">
      <header className="flex items-center justify-between gap-3 border-b border-border px-4 py-3">
        <div className="flex min-w-0 items-center gap-3">
          <Button variant="ghost" size="sm" asChild>
            <Link href="/dashboard/forms">
              <ArrowLeftIcon data-icon="inline-start" />
              Forms
            </Link>
          </Button>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold">
              {values.name || "Untitled form"}
            </p>
            <p className="text-xs text-muted-foreground">Signup form editor</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {savedAt && <span className="text-xs font-medium text-emerald-500">Saved</span>}
          <Button onClick={() => void save()} disabled={busy}>
            {busy && <Loader2Icon data-icon="inline-start" className="animate-spin" />}
            Save changes
          </Button>
        </div>
      </header>

      <div className="grid flex-1 overflow-hidden md:grid-cols-[minmax(0,440px)_minmax(0,1fr)]">
        {/* Controls */}
        <div className="overflow-y-auto border-b border-border p-6 md:border-b-0 md:border-r">
          <FormFields values={values} set={set} />
          {error && <p className="mt-4 text-sm text-destructive">{error}</p>}
        </div>

        {/* Live preview */}
        <div className="flex flex-col overflow-hidden bg-muted/30">
          <div className="border-b border-border px-4 py-2.5">
            <p className="text-xs font-medium text-muted-foreground">Live preview</p>
          </div>
          <div className="flex flex-1 items-center justify-center overflow-y-auto p-8">
            <div className="w-full max-w-md overflow-hidden rounded-xl border border-border shadow-sm">
              <FormPreview settings={preview} className="min-h-[320px] w-full" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
