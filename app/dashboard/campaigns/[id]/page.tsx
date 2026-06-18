"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { CampaignMonitor } from "./campaign-monitor";
import { CampaignSendView, type DraftCampaign } from "./campaign-send-view";

// One campaign. A draft shows the structured send page; once it's sending/sent
// it shows the live monitor.
export default function CampaignDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [campaign, setCampaign] = useState<DraftCampaign | null>(null);
  const [notFound, setNotFound] = useState(false);

  const load = useCallback(async () => {
    const res = await fetch(`/api/campaigns/${id}`);
    const data = await res.json();
    if (data.ok) setCampaign(data.campaign);
    else setNotFound(true);
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  if (notFound) return <div className="p-8 text-sm text-zinc-500">Campaign not found.</div>;
  if (!campaign) return <div className="p-8 text-sm text-zinc-500">Loading…</div>;

  if (campaign.status === "draft") {
    return <CampaignSendView campaign={campaign} onSent={load} />;
  }
  return <CampaignMonitor />;
}
