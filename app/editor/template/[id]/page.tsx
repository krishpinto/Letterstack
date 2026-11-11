"use client";

import * as React from "react";
import { useParams, useRouter } from "next/navigation";
import { alertDialog } from "@/components/app-dialogs";
import { EditorShell } from "@/components/editor/editor-shell";
import { Spinner } from "@/components/ui/spinner";
import { type EmailDocument } from "@/lib/email/document";
import { patchDocument, patchDocumentOnUnload } from "@/lib/editor/save-request";

export default function EditTemplatePage() {
  const params = useParams();
  const id = params.id as string;
  const router = useRouter();

  const [initialDoc, setInitialDoc] = React.useState<EmailDocument | null>(null);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    async function loadTemplate() {
      try {
        const r = await fetch(`/api/templates/${id}`);
        const data = await r.json();
        if (data.ok && data.template) {
          setInitialDoc(data.template.document);
        } else {
          await alertDialog({ title: "Failed to load template" });
          router.push("/dashboard/templates");
        }
      } catch (err) {
        console.error(err);
        await alertDialog({ title: "Failed to load template" });
        router.push("/dashboard/templates");
      } finally {
        setLoading(false);
      }
    }
    loadTemplate();
  }, [id, router]);

  // Rejects on any failure so the editor keeps the edit marked unsaved and
  // shows the error with Retry in its header. It used to resolve after an
  // alert, so the editor then reported "Saved" — and since autosave calls it,
  // a dead connection meant a fresh alert every 1.5 seconds.
  async function handleSave(doc: EmailDocument) {
    await patchDocument(`/api/templates/${id}`, { document: doc });
  }

  function handleSaveOnUnload(doc: EmailDocument) {
    void patchDocumentOnUnload(`/api/templates/${id}`, { document: doc });
  }

  async function handleExit() {
    router.push("/dashboard/templates");
  }

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center gap-2 text-sm text-muted-foreground bg-background">
        <Spinner />
        Loading template...
      </div>
    );
  }

  if (!initialDoc) return null;

  return (
    <EditorShell
      mode="template-editor"
      initialDocument={initialDoc}
      onSave={handleSave}
      onSaveOnUnload={handleSaveOnUnload}
      onExit={handleExit}
    />
  );
}
