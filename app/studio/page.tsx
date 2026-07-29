"use client";

// /studio — the agentic editor.
//
// A parallel surface to /editor so the agent panel can be developed without
// touching the editor people actually use. It shares EditorShell rather than
// forking it, so canvas, inspector, undo and autosave stay identical and only
// the assistant is new.

import { useEffect } from "react";
import { useRouter } from "next/navigation";

import { EditorBackLink } from "@/components/editor/editor-back-link";
import { EditorShell } from "@/components/editor/editor-shell";
import { AgentPanel } from "@/components/editor/agent/agent-panel";
import { STORAGE_KEY, type EmailDocument } from "@/lib/email/document";

export default function StudioPage() {
  const router = useRouter();

  useEffect(() => {
    localStorage.setItem("letterstack-return-to", "/dashboard/templates");
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
        alert(data.error || "Failed to save template");
      }
    } catch (err) {
      console.error(err);
      alert("An error occurred while saving the template");
    }
  }

  return (
    <>
      <EditorBackLink />
      <EditorShell
        mode="template-creator"
        onSaveAsTemplate={handleSaveAsTemplate}
        onExit={() => router.push("/dashboard/templates")}
        renderAssistant={({ document, updateDocument }) => (
          <AgentPanel document={document} updateDocument={updateDocument} />
        )}
      />
    </>
  );
}
