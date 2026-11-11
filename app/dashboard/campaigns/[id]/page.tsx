"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeftIcon } from "lucide-react";

import { PageLoader } from "@/components/bar-spinner";
import { ErrorState, useAsyncData } from "@/components/data-state";
import { toast } from "@/components/toast";
import { Button } from "@/components/ui/button";
import { ApiError, fetchJson } from "@/lib/fetch-json";
import { CampaignDetail, type CampaignData } from "./campaign-detail";

export default function CampaignDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [notFound, setNotFound] = useState(false);

  const state = useAsyncData(async () => {
    try {
      const data = await fetchJson<{ campaign: CampaignData }>(
        `/api/campaigns/${id}`,
      );
      setNotFound(false);
      return data.campaign;
    } catch (error) {
      setNotFound(error instanceof ApiError && error.status === 404);
      throw error;
    }
  }, [id]);

  const { reload } = state;
  // Called after send / schedule / cancel.
  const refresh = useCallback(() => {
    void reload();
  }, [reload]);

  // A failed refresh keeps the campaign on screen (useAsyncData keeps the
  // last data) and says so, instead of silently showing stale state.
  const refreshError =
    state.status === "error" && state.data ? state.error : null;
  useEffect(() => {
    if (refreshError) {
      toast.error("Couldn't refresh this campaign", { description: refreshError });
    }
  }, [refreshError]);

  if (state.status === "loading") {
    return <PageLoader label="Loading campaign…" />;
  }

  if (state.status === "error" && !state.data) {
    return (
      <ErrorState
        title={notFound ? "Campaign not found" : "Couldn't load this campaign"}
        message={
          notFound
            ? "It may have been deleted, or it belongs to a different workspace."
            : state.error
        }
        onRetry={notFound ? undefined : refresh}
        retrying={state.refreshing}
        action={
          <Button variant={notFound ? "default" : "ghost"} asChild>
            <Link href="/dashboard/campaigns">
              <ArrowLeftIcon data-icon="inline-start" />
              Back to campaigns
            </Link>
          </Button>
        }
      />
    );
  }

  return <CampaignDetail campaign={state.data!} onRefresh={refresh} />;
}
