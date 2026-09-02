"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { MailIcon, RefreshCwIcon } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  NativeSelect,
  NativeSelectOption,
} from "@/components/ui/native-select";
import { cn } from "@/lib/utils";
import { CampaignPreviewSheet } from "./campaign-preview-sheet";
import {
  formatDateTime,
  senderTypeLabel,
  type AdminCampaignRow,
} from "./types";

// The Campaigns tab: every campaign on the platform, and the email each one
// actually sent.
//
// This is the abuse-and-support view — what people are sending, through which
// channel, and to how many. Clicking a row opens the frozen html_snapshot,
// which is the exact copy recipients received.

type Filter = "all" | "sent" | "scheduled" | "draft" | "failing";
type Sort = "recent" | "size";

const FILTER_LABELS: Record<Filter, string> = {
  all: "All campaigns",
  sent: "Sent",
  scheduled: "Scheduled",
  draft: "Drafts",
  failing: "Has failures",
};

const SORT_LABELS: Record<Sort, string> = {
  recent: "Most recent",
  size: "Largest send",
};

function matchesFilter(campaign: AdminCampaignRow, filter: Filter) {
  switch (filter) {
    case "sent":
      return campaign.status === "sent";
    case "scheduled":
      return campaign.status === "scheduled";
    case "draft":
      return campaign.status === "draft";
    case "failing":
      return campaign.failed > 0;
    default:
      return true;
  }
}

function statusVariant(status: string) {
  return status === "sent" ? "default" : "secondary";
}

export function CampaignsPanel() {
  const [campaigns, setCampaigns] = useState<AdminCampaignRow[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [sort, setSort] = useState<Sort>("recent");
  const [openCampaignId, setOpenCampaignId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch("/api/admin/campaigns");
      const payload = await r.json();
      if (payload.ok) setCampaigns(payload.campaigns);
    } catch {
      // keep the last snapshot
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const visible = useMemo(() => {
    if (!campaigns) return [];
    const q = query.trim().toLowerCase();
    const rows = campaigns.filter(
      (campaign) =>
        matchesFilter(campaign, filter) &&
        (!q ||
          campaign.subject.toLowerCase().includes(q) ||
          campaign.name.toLowerCase().includes(q) ||
          campaign.organizationName.toLowerCase().includes(q) ||
          campaign.senderEmail.toLowerCase().includes(q) ||
          campaign.fromEmail.toLowerCase().includes(q)),
    );
    // The API already returns newest activity first, so that case needs no
    // re-sort.
    if (sort === "size") {
      return [...rows].sort((a, b) => b.recipients - a.recipients);
    }
    return rows;
  }, [campaigns, query, filter, sort]);

  const totals = useMemo(() => {
    const list = campaigns ?? [];
    return {
      campaigns: list.length,
      sent: list.filter((campaign) => campaign.status === "sent").length,
      emails: list.reduce((sum, campaign) => sum + campaign.sent, 0),
    };
  }, [campaigns]);

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-3 space-y-0">
          <CardTitle className="flex items-center gap-2 text-base">
            <MailIcon className="size-4" />
            Campaigns
          </CardTitle>
          <Button variant="outline" size="sm" onClick={load} disabled={loading}>
            <RefreshCwIcon
              data-icon="inline-start"
              className={cn(loading && "animate-spin")}
            />
            Refresh
          </Button>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="flex flex-wrap items-center gap-3">
            <Input
              placeholder="Search subject, workspace, or sender…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="max-w-xs"
            />
            <NativeSelect
              value={filter}
              aria-label="Filter campaigns"
              onChange={(e) => setFilter(e.target.value as Filter)}
            >
              {(Object.keys(FILTER_LABELS) as Filter[]).map((key) => (
                <NativeSelectOption key={key} value={key}>
                  {FILTER_LABELS[key]}
                </NativeSelectOption>
              ))}
            </NativeSelect>
            <NativeSelect
              value={sort}
              aria-label="Sort campaigns"
              onChange={(e) => setSort(e.target.value as Sort)}
            >
              {(Object.keys(SORT_LABELS) as Sort[]).map((key) => (
                <NativeSelectOption key={key} value={key}>
                  {SORT_LABELS[key]}
                </NativeSelectOption>
              ))}
            </NativeSelect>
            <p className="ml-auto text-xs text-muted-foreground">
              {totals.campaigns.toLocaleString()} campaign
              {totals.campaigns === 1 ? "" : "s"} · {totals.sent.toLocaleString()}{" "}
              sent · {totals.emails.toLocaleString()} emails delivered to SES
            </p>
          </div>

          {!campaigns ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : visible.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              {campaigns.length === 0
                ? "No campaigns yet."
                : "No campaigns match that filter."}
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-xs text-muted-foreground">
                    <th className="py-2 pr-3 font-medium">Campaign</th>
                    <th className="py-2 pr-3 font-medium">Workspace</th>
                    <th className="py-2 pr-3 font-medium">From</th>
                    <th className="py-2 pr-3 font-medium">Channel</th>
                    <th className="py-2 pr-3 font-medium">Status</th>
                    <th className="py-2 pr-3 font-medium">Recipients</th>
                    <th className="py-2 pr-3 font-medium">Failed</th>
                    <th className="py-2 font-medium">When</th>
                  </tr>
                </thead>
                <tbody>
                  {visible.map((campaign) => (
                    <tr
                      key={campaign.id}
                      tabIndex={0}
                      role="button"
                      onClick={() => setOpenCampaignId(campaign.id)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          setOpenCampaignId(campaign.id);
                        }
                      }}
                      className="cursor-pointer border-b transition-colors last:border-0 hover:bg-muted/50 focus-visible:bg-muted/50 focus-visible:outline-none"
                    >
                      <td className="py-2 pr-3">
                        <div className="font-medium">{campaign.subject}</div>
                        <div className="text-xs text-muted-foreground">
                          {campaign.name}
                        </div>
                      </td>
                      <td className="py-2 pr-3">
                        <div>{campaign.organizationName}</div>
                        <div className="text-xs text-muted-foreground">
                          {campaign.senderEmail}
                        </div>
                      </td>
                      <td className="py-2 pr-3 text-xs text-muted-foreground">
                        {campaign.fromEmail}
                      </td>
                      <td className="py-2 pr-3">
                        <Badge variant="secondary" className="text-[10px]">
                          {senderTypeLabel(campaign.senderType)}
                        </Badge>
                      </td>
                      <td className="py-2 pr-3">
                        <Badge variant={statusVariant(campaign.status)}>
                          {campaign.status}
                        </Badge>
                      </td>
                      <td className="py-2 pr-3 font-semibold tabular-nums">
                        {campaign.recipients.toLocaleString()}
                      </td>
                      <td
                        className={cn(
                          "py-2 pr-3 tabular-nums",
                          campaign.failed > 0 && "font-semibold text-amber-500",
                        )}
                      >
                        {campaign.failed.toLocaleString()}
                      </td>
                      <td className="py-2 text-xs text-muted-foreground">
                        {formatDateTime(campaign.sentAt ?? campaign.createdAt)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <CampaignPreviewSheet
        campaignId={openCampaignId}
        onOpenChange={(open) => {
          if (!open) setOpenCampaignId(null);
        }}
      />
    </>
  );
}
