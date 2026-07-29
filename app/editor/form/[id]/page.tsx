"use client";

import * as React from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { CheckIcon, ChevronLeftIcon, Loader2Icon } from "lucide-react";

import { alertDialog } from "@/components/app-dialogs";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { FormFields } from "@/components/dashboard/forms/form-fields";
import { FormPreview } from "@/components/dashboard/forms/form-preview";
import {
  DEFAULT_FORM_SETTINGS,
  type SignupFormSettingsInput,
} from "@/components/dashboard/forms/types";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarInset,
  SidebarProvider,
} from "@/components/ui/sidebar";

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
        // Saving is "I'm done here" — land back on the forms list.
        router.push("/dashboard/forms");
        return;
      }
      setError(data.error ?? "Could not save the form.");
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
    <SidebarProvider
      // Inline style is the documented shadcn way to size the sidebar —
      // the provider reads this CSS variable.
      style={
        {
          "--sidebar-width": "23rem",
        } as React.CSSProperties
      }
      className="min-h-0 h-screen w-screen !bg-background flex flex-col overflow-hidden"
    >
      {/* Top Header */}
      <header className="flex h-12 shrink-0 items-center justify-between bg-background px-4">
        {/* Left: Back chevron + Title */}
        <div className="flex items-center gap-3">
          <Link
            href="/dashboard/forms"
            className="flex size-7 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
          >
            <ChevronLeftIcon className="size-4" />
          </Link>
          <span className="text-sm font-semibold text-foreground tracking-tight select-none">
            {values.name || "Untitled Form"}
          </span>
        </div>



        {/* Right: Status & Actions */}
        <div className="flex items-center gap-3">
          {savedAt && (
            <span className="flex items-center gap-1 text-xs font-medium text-emerald-500 select-none mr-1.5">
              <CheckIcon className="size-3.5" />
              Saved
            </span>
          )}
          {error && (
            <span className="text-xs text-destructive select-none truncate max-w-[200px] mr-1.5">
              {error}
            </span>
          )}
          <Button
            onClick={() => void save()}
            disabled={busy}
            size="sm"
            className="h-8 px-4 font-semibold shadow-xs"
          >
            {busy && <Loader2Icon className="mr-1.5 size-3.5 animate-spin" />}
            Save
          </Button>
        </div>
      </header>

      {/* Main Workspace below header */}
      <div className="flex-1 min-h-0 flex relative">
        {/* Left Sidebar for Controls */}
        <Sidebar
          variant="inset"
          collapsible="none"
          className="top-12 h-[calc(100vh-3rem)] bg-background [&>div]:bg-background"
        >
          <SidebarContent className="overflow-y-auto">
            <SidebarGroup className="min-h-0 flex-1 p-0">
              <div className="p-5">
                <div className="mb-5">
                  <p className="text-sm font-bold text-foreground">Form controls</p>
                  <p className="text-[11px] text-muted-foreground/75 mt-0.5">
                    Configure layout, content, styles, and field inputs.
                  </p>
                </div>
                <FormFields values={values} set={set} />
              </div>
            </SidebarGroup>
          </SidebarContent>
        </Sidebar>

        {/* Live Preview Area inside SidebarInset */}
        <SidebarInset className="min-h-0 overflow-hidden flex flex-col !bg-muted/30 !m-[1px] !w-auto rounded-xl border border-border">
          <div className="relative flex min-h-0 flex-1 overflow-hidden">
            <div className="flex flex-1 items-center justify-center p-8 overflow-auto">
              <div className="w-full max-w-md overflow-hidden rounded-xl border border-border shadow-sm bg-card">
                <FormPreview settings={preview} className="min-h-[320px] w-full" />
              </div>
            </div>
          </div>
        </SidebarInset>
      </div>
    </SidebarProvider>
  );
}
