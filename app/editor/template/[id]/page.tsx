"use client";

import * as React from "react";
import { useParams, useRouter } from "next/navigation";
import { EditorBackLink } from "@/components/editor/editor-back-link";
import { EditorShell } from "@/components/editor/editor-shell";
import { Spinner } from "@/components/ui/spinner";
import { type EmailDocument } from "@/lib/email/document";

export default function EditTemplatePage() {
  const params = useParams();
  const id = params.id as string;
  const router = useRouter();

  const [initialDoc, setInitialDoc] = React.useState<EmailDocument | null>(null);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    localStorage.setItem("letterstack-return-to", "/dashboard/templates");
  }, []);

  React.useEffect(() => {
    async function loadTemplate() {
      try {
        const r = await fetch(`/api/templates/${id}`);
        const data = await r.json();
        if (data.ok && data.template) {
          setInitialDoc(data.template.document);
        } else {
          alert("Failed to load template");
          router.push("/dashboard/templates");
        }
      } catch (err) {
        console.error(err);
        alert("Failed to load template");
        router.push("/dashboard/templates");
      } finally {
        setLoading(false);
      }
    }
    loadTemplate();
  }, [id, router]);

  async function handleSave(doc: EmailDocument) {
    try {
      const r = await fetch(`/api/templates/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ document: doc }),
      });
      const data = await r.json();
      if (!data.ok) {
        alert(data.error || "Failed to save template");
      }
    } catch (err) {
      console.error(err);
      alert("Failed to save template");
    }
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
    <>
      <EditorBackLink />
      <EditorShell
        mode="template-editor"
        initialDocument={initialDoc}
        onSave={handleSave}
        onExit={handleExit}
      />
    </>
  );
}
