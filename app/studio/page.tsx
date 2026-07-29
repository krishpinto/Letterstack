"use client";

// /studio — the agentic editor.
//
// A parallel surface to /editor so the assistant can be developed without
// touching the editor people actually use. It mirrors /editor exactly and adds
// only `renderAssistant`, sharing EditorShell rather than forking it so canvas,
// inspector, undo and autosave stay identical.

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { alertDialog } from "@/components/app-dialogs";
import { AgentPanel } from "@/components/editor/agent/agent-panel";
import { EditorShell } from "@/components/editor/editor-shell";
import { Spinner } from "@/components/ui/spinner";
import {
  isEmailDocument,
  normalizeDocument,
  STORAGE_KEY,
  type EmailDocument,
} from "@/lib/email/document";

export default function StudioPage() {
  const router = useRouter();

  // Same reason as /editor: EditorShell reads `initialDocument` once at mount,
  // so the draft has to be loaded before it renders or every template opens as
  // the shell's built-in default.
  const [initialDoc, setInitialDoc] = useState<EmailDocument | undefined>(
    undefined,
  );
  const [ready, setReady] = useState(false);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved && saved !== "null") {
        const parsed = JSON.parse(saved);
        if (isEmailDocument(parsed)) {
          setInitialDoc(normalizeDocument(parsed));
        }
      }
    } catch {
      localStorage.removeItem(STORAGE_KEY);
    }
    setReady(true);
  }, []);

  async function handleSaveAsTemplate(doc: EmailDocument, name: string) {
    try {
      const response = await fetch("/api/templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, document: doc }),
      });
      const data = await response.json();
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

  if (!ready) {
    return (
      <div className="flex h-screen items-center justify-center gap-2 bg-background text-sm text-muted-foreground">
        <Spinner />
        Opening studio...
      </div>
    );
  }

  return (
    <EditorShell
      mode="template-creator"
      initialDocument={initialDoc}
      onSaveAsTemplate={handleSaveAsTemplate}
      onExit={() => router.push("/dashboard/templates")}
      renderAssistant={({ document, updateDocument }) => (
        <AgentPanel document={document} updateDocument={updateDocument} />
      )}
    />
  );
}
