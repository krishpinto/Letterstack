"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { alertDialog, confirmDialog } from "@/components/app-dialogs";
import { EditorShell } from "@/components/editor/editor-shell";
import { Spinner } from "@/components/ui/spinner";
import { type EmailDocument } from "@/lib/email/document";
import {
  clearLocalDraft,
  clearOtherUsersDrafts,
  localDraftKey,
  readLocalDraft,
  takeEditorHandoff,
  writeLocalDraft,
} from "@/lib/editor/local-draft";
import { SaveError } from "@/lib/editor/save-queue";

// The workspace the draft belongs to. The active workspace lives in an
// httpOnly cookie, so ask the server. Null when there is none or the request
// fails; the draft is then kept under "no workspace".
async function fetchActiveOrganizationId(): Promise<string | null> {
  try {
    const r = await fetch("/api/organizations");
    const data = await r.json();
    return typeof data?.organization?.id === "string" ? data.organization.id : null;
  } catch {
    return null;
  }
}

function browserStorage(): Storage | null {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

export default function EditorPage() {
  const router = useRouter();
  const { data: session, status } = useSession();
  const userId = session?.user?.id ?? null;

  // What the editor opens, and the key this browser's draft lives under. A
  // new template has no server copy until "Save as template", so its draft
  // stays on this device, scoped to the user, the workspace and the kind of
  // document — never the global key the other editors used to share.
  const [start, setStart] = useState<{ doc?: EmailDocument; key: string } | null>(null);
  // Set once the template is on the server, so a late autosave can't put the
  // draft back after it was cleared.
  const finishedRef = useRef(false);

  useEffect(() => {
    if (status === "loading") return;
    if (!userId) {
      router.replace("/login?callbackUrl=/editor");
      return;
    }
    let cancelled = false;
    void (async () => {
      const organizationId = await fetchActiveOrganizationId();
      if (cancelled) return;
      const key = localDraftKey({ userId, organizationId }, "template");
      const storage = browserStorage();
      if (!storage) {
        setStart({ key });
        return;
      }
      clearOtherUsersDrafts(storage, userId);

      // The templates gallery ("Use template", "Create from scratch", "Import
      // HTML") hands the chosen document over through STORAGE_KEY; it is
      // read once and deleted. EditorShell only reads `initialDocument` at
      // mount, so this must happen before it renders.
      const handoff = takeEditorHandoff(storage);
      const draft = readLocalDraft(storage, key);

      let doc = handoff ?? draft?.document;
      if (handoff && draft?.edited) {
        const replace = await confirmDialog({
          title: "Replace your draft?",
          description:
            "You have an unsaved template draft in this browser. Opening the template you picked will replace it.",
          confirmLabel: "Open template",
          cancelLabel: "Keep my draft",
        });
        doc = replace ? handoff : draft.document;
      }
      if (handoff && doc === handoff) {
        // Keep the pick across a reload, but as unedited, so opening another
        // template later does not ask about it.
        try {
          writeLocalDraft(storage, key, { document: handoff, edited: false });
        } catch {
          // Storage full: the editor still opens it.
        }
      }
      // With neither, the editor opens its blank default document.
      setStart({ doc, key });
    })();
    return () => {
      cancelled = true;
    };
  }, [status, userId, router]);

  const draftKey = start?.key ?? null;

  const handleSave = useCallback(
    async (doc: EmailDocument) => {
      if (!draftKey || finishedRef.current) return;
      try {
        const storage = browserStorage();
        if (!storage) throw new Error("unavailable");
        writeLocalDraft(storage, draftKey, { document: doc, edited: true });
      } catch {
        throw new SaveError(
          "failed",
          "This browser would not store the draft (storage is full or blocked). Use Save as template to keep it.",
        );
      }
    },
    [draftKey],
  );

  // localStorage is synchronous, so the same write works while the page is
  // being torn down.
  const handleSaveOnUnload = useCallback(
    (doc: EmailDocument) => {
      void handleSave(doc).catch(() => {});
    },
    [handleSave],
  );

  async function handleSaveAsTemplate(doc: EmailDocument, name: string) {
    try {
      const r = await fetch("/api/templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, document: doc }),
      });
      const data = await r.json();
      if (data.ok) {
        finishedRef.current = true;
        const storage = browserStorage();
        if (storage && draftKey) clearLocalDraft(storage, draftKey);
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
  if (!start) {
    return (
      <div className="flex h-screen items-center justify-center gap-2 bg-background text-sm text-muted-foreground">
        <Spinner />
        Opening editor...
      </div>
    );
  }

  return (
    <EditorShell
      mode="template-creator"
      initialDocument={start.doc}
      onSave={handleSave}
      onSaveOnUnload={handleSaveOnUnload}
      // Autosave here only reaches this browser; the template exists for the
      // workspace once "Save as template" is used. Plain "Saved" said otherwise.
      savedLabel="Draft saved on this device"
      onSaveAsTemplate={handleSaveAsTemplate}
      onExit={() => router.push("/dashboard/templates")}
    />
  );
}
