"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Spinner } from "@/components/ui/spinner";
import { EditorShell } from "@/components/editor/editor-shell";
import { type EmailDocument } from "@/lib/email/document";
import { patchDocument } from "@/lib/editor/save-request";

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
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const r = await fetch(`/api/campaigns/${id}`);
      const data = await r.json();
      if (data.ok) {
        setCampaign(data.campaign);
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
  const handleSave = useCallback(async (doc: EmailDocument) => {
    await patchDocument(`/api/campaigns/${id}`, { document: doc });
  }, [id]);

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

  if (error || !campaign) {
    return (
      <div className="flex min-h-screen items-center justify-center p-8 text-sm text-zinc-400">
        {error || "Campaign not found."}
      </div>
    );
  }

  return (
    <EditorShell
      initialDocument={campaign.document ?? undefined}
      onSave={handleSave}
      onExit={handleExit}
    />
  );
}
