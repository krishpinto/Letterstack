"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { PageLoader } from "@/components/bar-spinner";
import { CampaignDetail, type CampaignData } from "./campaign-detail";

export default function CampaignDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [campaign, setCampaign] = useState<CampaignData | null>(null);
  const [notFound, setNotFound] = useState(false);

  const load = useCallback(async () => {
    const r = await fetch(`/api/campaigns/${id}`);
    const data = await r.json();
    if (data.ok) setCampaign(data.campaign);
    else setNotFound(true);
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  if (notFound) {
    return (
      <div className="p-8 text-sm text-muted-foreground">
        Campaign not found.
      </div>
    );
  }

  if (!campaign) {
    return (
      <PageLoader label="Loading campaign…" />
    );
  }

  return <CampaignDetail campaign={campaign} onRefresh={load} />;
}
