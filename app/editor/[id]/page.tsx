"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { EditorShell } from "@/components/editor/editor-shell";
import { initialEmailDocument, type EmailDocument } from "@/lib/email/document";
import { isCampaignEditable } from "@/lib/editor/campaign-editable";
import {
  changedCampaignFields,
  pickCampaignFields,
  type CampaignFields,
} from "@/lib/editor/campaign-fields";
import { discardCampaignHandoff } from "@/lib/editor/local-draft";
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
    // The campaign page leaves a copy of the design in localStorage before
    // opening this editor. This editor loads from the server, so drop it
    // before the next /editor visit picks it up as a template.
    try {
      discardCampaignHandoff(window.localStorage);
    } catch {
      // Storage blocked: nothing was left there.
    }
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

  // A campaign that has started sending is the record of what went out, and
  // the PATCH refuses it. It used to open fully editable anyway, so every
  // edit autosaved into a request that failed. Open it read-only instead,
  // with the way forward.
  if (!isCampaignEditable(campaign.status)) {
    return (
      <EditorShell
        initialDocument={initialDoc}
        readOnly
        banner={<SentCampaignBanner campaignId={campaign.id} status={campaign.status} />}
        onExit={handleExit}
      />
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

// Uses the campaign page's "Reuse campaign" action (POST /reuse), which
// copies the design, subject, sender and audience into a new draft.
function SentCampaignBanner({ campaignId, status }: { campaignId: string; status: string }) {
  const router = useRouter();
  const [duplicating, setDuplicating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function duplicate() {
    setDuplicating(true);
    setError(null);
    try {
      const r = await fetch(`/api/campaigns/${campaignId}/reuse`, { method: "POST" });
      const data = await r.json().catch(() => null);
      if (!r.ok || !data?.ok || typeof data.id !== "string") {
        setError(data?.error || "Could not duplicate this campaign.");
        setDuplicating(false);
        return;
      }
      router.push(`/editor/${data.id}`);
    } catch {
      setError("Could not reach the server.");
      setDuplicating(false);
    }
  }

  const message =
    status === "sending"
      ? "This campaign is being sent, so its design can no longer change. Duplicate it to make changes."
      : status === "failed"
        ? "This campaign's send failed, so its design is kept as it went out. Duplicate it to make changes."
        : "This campaign was sent — duplicate it to make changes.";

  return (
    <div
      role="status"
      className="flex shrink-0 flex-wrap items-center justify-center gap-x-3 gap-y-1 border-y border-border bg-muted/60 px-4 py-2 text-sm"
    >
      <span className="text-muted-foreground">{message}</span>
      <Button size="sm" variant="outline" className="h-7" onClick={duplicate} disabled={duplicating}>
        {duplicating ? <Spinner data-icon="inline-start" /> : null}
        {duplicating ? "Duplicating…" : "Duplicate campaign"}
      </Button>
      {error ? <span className="text-destructive">{error}</span> : null}
    </div>
  );
}
