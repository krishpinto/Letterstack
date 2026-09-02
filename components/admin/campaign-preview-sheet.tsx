"use client";

import { useCallback, useEffect, useState } from "react";

import { Badge } from "@/components/ui/badge";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Spinner } from "@/components/ui/spinner";
import {
  formatDateTime,
  senderTypeLabel,
  type AdminCampaignDetail,
} from "./types";

// The screen that opens when a campaign row is clicked: who sent it, how it
// went, and the email itself.
//
// The preview renders html_snapshot — the frozen copy from send time — so
// what shows here is byte-for-byte what recipients received, not a fresh
// compile of a document that may have been edited afterwards.
//
// It fetches its own detail rather than taking it from the table, because the
// snapshot is a whole email and only the campaign being looked at should pay
// for it.

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-xl font-semibold tabular-nums">{value}</span>
      <span className="text-xs text-muted-foreground">{label}</span>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-[11px] uppercase tracking-wide text-muted-foreground">
        {label}
      </span>
      <span className="break-words text-sm">{value}</span>
    </div>
  );
}

export function CampaignPreviewSheet({
  campaignId,
  onOpenChange,
}: {
  campaignId: string | null;
  onOpenChange: (open: boolean) => void;
}) {
  const [campaign, setCampaign] = useState<AdminCampaignDetail | null>(null);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async (id: string) => {
    setLoading(true);
    try {
      const r = await fetch(`/api/admin/campaigns/${id}`);
      const payload = await r.json();
      setCampaign(payload.ok ? payload.campaign : null);
    } catch {
      setCampaign(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!campaignId) {
      setCampaign(null);
      return;
    }
    void load(campaignId);
  }, [campaignId, load]);

  return (
    <Sheet open={Boolean(campaignId)} onOpenChange={onOpenChange}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-2xl">
        {loading || !campaign ? (
          <div className="flex h-40 items-center justify-center">
            {loading ? (
              <Spinner />
            ) : (
              <p className="text-sm text-muted-foreground">
                Couldn&apos;t load this campaign.
              </p>
            )}
          </div>
        ) : (
          <>
            <SheetHeader>
              <SheetTitle className="pr-6">{campaign.subject}</SheetTitle>
              <SheetDescription>
                {campaign.name} · {campaign.organizationName}
              </SheetDescription>
            </SheetHeader>

            <div className="flex flex-col gap-6 px-4 pb-8">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant={campaign.status === "sent" ? "default" : "secondary"}>
                  {campaign.status}
                </Badge>
                <Badge variant="secondary">
                  {senderTypeLabel(campaign.senderType)}
                </Badge>
              </div>

              <div className="grid grid-cols-3 gap-4 rounded-3xl border p-4">
                <Stat
                  label="Recipients"
                  value={campaign.recipients.toLocaleString()}
                />
                <Stat label="Sent" value={campaign.sent.toLocaleString()} />
                <Stat label="Failed" value={campaign.failed.toLocaleString()} />
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <Field
                  label="Account"
                  value={`${campaign.senderName ?? "—"} · ${campaign.senderEmail}`}
                />
                <Field
                  label="From"
                  value={`${campaign.fromName} <${campaign.fromEmail}>`}
                />
                <Field label="Reply-to" value={campaign.replyTo ?? "—"} />
                <Field
                  label="Sent"
                  value={
                    campaign.sentAt
                      ? formatDateTime(campaign.sentAt)
                      : campaign.scheduledAt
                        ? `Scheduled ${formatDateTime(campaign.scheduledAt)}`
                        : `Created ${formatDateTime(campaign.createdAt)}`
                  }
                />
              </div>

              <div className="flex flex-col gap-2">
                <span className="text-[11px] uppercase tracking-wide text-muted-foreground">
                  What went out
                </span>
                <div className="rounded-3xl border bg-zinc-100 p-3">
                  {/* sandbox with no allow-scripts: a user's campaign HTML is
                      untrusted input to this page, and the preview only ever
                      needs to render, never to run. */}
                  <iframe
                    title="Campaign preview"
                    srcDoc={campaign.htmlSnapshot}
                    sandbox=""
                    className="h-[600px] w-full rounded-lg border bg-white shadow-sm"
                  />
                </div>
              </div>
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
