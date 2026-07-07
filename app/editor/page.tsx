"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { alertDialog } from "@/components/app-dialogs";
import { EditorBackLink } from "@/components/editor/editor-back-link";
import { EditorShell } from "@/components/editor/editor-shell";
import { STORAGE_KEY, type EmailDocument } from "@/lib/email/document";

export default function EditorPage() {
  const router = useRouter();

  useEffect(() => {
    localStorage.setItem("letterstack-return-to", "/dashboard/templates");
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

  return (
    <>
      <EditorBackLink />
      <EditorShell
        mode="template-creator"
        onSaveAsTemplate={handleSaveAsTemplate}
        onExit={() => router.push("/dashboard/templates")}
      />
    </>
  );
}
