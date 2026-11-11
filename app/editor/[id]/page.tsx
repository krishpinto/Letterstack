"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Spinner } from "@/components/ui/spinner";
import { EditorShell } from "@/components/editor/editor-shell";
import { initialEmailDocument, type EmailDocument } from "@/lib/email/document";
import {
  changedCampaignFields,
  pickCampaignFields,
  type CampaignFields,
} from "@/lib/editor/campaign-fields";
import { patchDocument, patchDocumentOnUnload } from "@/lib/editor/save-request";

type Campaign = {
  id: string;
  name: string;
  subject: string;
  fromName: string;
  fromEmail: string;
  status: string;
  document: EmailDocument | null;
};

export default function CampaignEditorPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [initialDoc, setInitialDoc] = useState<EmailDocument | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // What every save is checked against (see db/content-version.ts): the
  // version this tab last loaded or saved. A save from a tab that missed
  // someone else's save gets a 409 instead of overwriting it.
  const versionRef = useRef("");
  // Name, subject and sender as the editor last loaded or saved them. A save
  // sends only the ones changed since, so a stale copy in this tab's document
  // can't overwrite a change made on the campaign page.
  const baselineRef = useRef<CampaignFields | null>(null);

  const load = useCallback(async () => {
    try {
      const r = await fetch(`/api/campaigns/${id}`);
      const data = await r.json();
      if (data.ok) {
        const loaded: Campaign = data.campaign;
        // A campaign without a design opens on the default document, but with
        // its own name and sender rather than the default's placeholders.
        const doc = loaded.document ?? {
          ...initialEmailDocument,
          ...pickCampaignFields(loaded),
        };
        versionRef.current = typeof data.version === "string" ? data.version : "";
        baselineRef.current = pickCampaignFields(doc);
        setInitialDoc(doc);
        setCampaign(loaded);
      } else {
        setError(data.error || "Campaign not found");
      }
    } catch {
      setError("Could not load campaign");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  // Rejects on any failure (a 404 for a campaign that is no longer a draft,
  // a 401 after the session expired, a login page instead of JSON). This used
  // to log and resolve, so the editor reported "Saved" and disarmed its
  // unsaved-changes guard for edits that never reached the server.
  const saveBody = useCallback((doc: EmailDocument) => {
    const baseline = baselineRef.current ?? pickCampaignFields(doc);
    return {
      document: doc,
      baseVersion: versionRef.current,
      ...changedCampaignFields(doc, baseline),
    };
  }, []);

  const recordSaved = useCallback((doc: EmailDocument, version: string | null) => {
    if (version) versionRef.current = version;
    baselineRef.current = pickCampaignFields(doc);
  }, []);

  const handleSave = useCallback(async (doc: EmailDocument) => {
    const version = await patchDocument(`/api/campaigns/${id}`, saveBody(doc));
    recordSaved(doc, version);
  }, [id, saveBody, recordSaved]);

  const handleSaveOnUnload = useCallback((doc: EmailDocument) => {
    // If the page survives (an in-app unmount), keep the version current so
    // the next save from this tab is not mistaken for a stale one.
    void patchDocumentOnUnload(`/api/campaigns/${id}`, saveBody(doc)).then((version) => {
      if (version) recordSaved(doc, version);
    });
  }, [id, saveBody, recordSaved]);

  const handleExit = useCallback(() => {
    router.push(`/dashboard/campaigns/${id}`);
  }, [id, router]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center gap-2 text-sm text-zinc-400">
        <Spinner />
        Loading design…
      </div>
    );
  }

  if (error || !campaign || !initialDoc) {
    return (
      <div className="flex min-h-screen items-center justify-center p-8 text-sm text-zinc-400">
        {error || "Campaign not found."}
      </div>
    );
  }

  return (
    <EditorShell
      initialDocument={initialDoc}
      onSave={handleSave}
      onSaveOnUnload={handleSaveOnUnload}
      onExit={handleExit}
    />
  );
}
