"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { alertDialog } from "@/components/app-dialogs";
import { EditorBackLink } from "@/components/editor/editor-back-link";
import { EditorShell } from "@/components/editor/editor-shell";
import { Spinner } from "@/components/ui/spinner";
import {
  isEmailDocument,
  normalizeDocument,
  STORAGE_KEY,
  type EmailDocument,
} from "@/lib/email/document";

export default function EditorPage() {
  const router = useRouter();

  // The templates gallery ("Use template", "Create from scratch", "Import HTML")
  // writes the chosen document to STORAGE_KEY and navigates here. EditorShell only
  // reads its `initialDocument` prop once, at mount, so we must load that draft
  // BEFORE rendering it — otherwise the shell falls back to its built-in default
  // and every template opens as the same "Welcome to LetterStack" doc.
  const [initialDoc, setInitialDoc] = useState<EmailDocument | undefined>(
    undefined,
  );
  const [ready, setReady] = useState(false);

  useEffect(() => {
    localStorage.setItem("letterstack-return-to", "/dashboard/templates");
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved && saved !== "null") {
        const parsed = JSON.parse(saved);
        if (isEmailDocument(parsed)) {
          setInitialDoc(normalizeDocument(parsed));
        }
      }
    } catch {
      // Corrupt draft — drop it and let the shell open its default document.
      localStorage.removeItem(STORAGE_KEY);
    }
    setReady(true);
  }, []);

  async function handleSaveAsTemplate(doc: EmailDocument, name: string) {
    try {
      const r = await fetch("/api/templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, document: doc }),
      });
      const data = await r.json();
      if (data.ok) {
        localStorage.removeItem(STORAGE_KEY);
        router.push("/dashboard/templates");
      } else {
        await alertDialog({
          title: "Could not save template",
          description: data.error || "Something went wrong. Please try again.",
        });
      }
    } catch (err) {
      console.error(err);
      await alertDialog({
        title: "Could not save template",
        description: "An error occurred while saving. Please try again.",
      });
    }
  }

  // Hold the editor until the draft is read, so EditorShell mounts once with the
  // right document instead of flashing the default first.
  if (!ready) {
    return (
      <div className="flex h-screen items-center justify-center gap-2 bg-background text-sm text-muted-foreground">
        <Spinner />
        Opening editor...
      </div>
    );
  }

  return (
    <>
      <EditorBackLink />
      <EditorShell
        mode="template-creator"
        initialDocument={initialDoc}
        onSaveAsTemplate={handleSaveAsTemplate}
        onExit={() => router.push("/dashboard/templates")}
      />
    </>
  );
}
