import {
  ArrowRightIcon,
  CheckCircle2Icon,
  CircleDotIcon,
  MailCheckIcon,
  SendIcon,
  XCircleIcon,
} from "lucide-react";
import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";

type ActiveCampaign = {
  id: string;
  name: string;
  subject: string;
  totalRecipients: number;
  sentCount: number;
  failedCount: number;
  pendingCount: number;
  status: "sending" | "sent";
};

type ActiveCampaignCardProps = {
  campaign?: ActiveCampaign;
};

export function ActiveCampaignCard({ campaign }: ActiveCampaignCardProps) {
  if (!campaign) {
    return (
      <Card className="flex flex-col items-center justify-center gap-3 py-10 text-center">
        <span className="flex size-12 items-center justify-center rounded-full bg-muted">
          <SendIcon className="size-5 text-muted-foreground" />
        </span>
        <div>
          <p className="text-sm font-medium">No active campaign</p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Start a campaign to see live progress here.
          </p>
        </div>
        <Button variant="outline" size="sm" asChild>
          <Link href="/dashboard/campaigns">
            New campaign <ArrowRightIcon className="ml-1 size-3.5" />
          </Link>
        </Button>
      </Card>
    );
  }

  const delivered = campaign.sentCount;
  const progress =
    campaign.totalRecipients > 0
      ? Math.round((delivered / campaign.totalRecipients) * 100)
      : 0;

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-3 pb-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <CardTitle className="truncate text-base font-medium">
              {campaign.name}
            </CardTitle>
            <Badge
              variant="outline"
              className={cn(
                "shrink-0 gap-1 text-xs",
                campaign.status === "sending"
                  ? "border-amber-500/30 bg-amber-500/10 text-amber-500"
                  : "border-emerald-500/30 bg-emerald-500/10 text-emerald-500",
              )}
            >
              <CircleDotIcon className="size-2.5" />
              {campaign.status === "sending" ? "Live" : "Sent"}
            </Badge>
          </div>
          <p className="mt-0.5 truncate text-xs text-muted-foreground">
            {campaign.subject}
          </p>
        </div>
        <Button variant="ghost" size="sm" className="shrink-0 text-xs" asChild>
          <Link href={`/dashboard/campaigns/${campaign.id}`}>
            Details <ArrowRightIcon className="ml-0.5 size-3" />
          </Link>
        </Button>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Progress bar */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>Delivery progress</span>
            <span className="tabular-nums font-medium text-foreground">
              {progress}%
            </span>
          </div>
          <Progress value={progress} className="h-2" />
          <p className="text-xs text-muted-foreground tabular-nums">
            {delivered.toLocaleString()} of{" "}
            {campaign.totalRecipients.toLocaleString()} sent
          </p>
        </div>

        {/* Outcome grid */}
        <div className="grid grid-cols-3 gap-2">
          <div className="rounded-lg bg-muted/60 px-3 py-2.5 text-center">
            <div className="flex items-center justify-center gap-1 text-emerald-500">
              <MailCheckIcon className="size-3.5" />
              <span className="text-sm font-semibold tabular-nums">
                {campaign.sentCount.toLocaleString()}
              </span>
            </div>
            <p className="mt-0.5 text-xs text-muted-foreground">Delivered</p>
          </div>
          <div className="rounded-lg bg-muted/60 px-3 py-2.5 text-center">
            <div className="flex items-center justify-center gap-1 text-amber-500">
              <CircleDotIcon className="size-3.5" />
              <span className="text-sm font-semibold tabular-nums">
                {campaign.pendingCount.toLocaleString()}
              </span>
            </div>
            <p className="mt-0.5 text-xs text-muted-foreground">Pending</p>
          </div>
          <div className="rounded-lg bg-muted/60 px-3 py-2.5 text-center">
            <div className="flex items-center justify-center gap-1 text-destructive">
              <XCircleIcon className="size-3.5" />
              <span className="text-sm font-semibold tabular-nums">
                {campaign.failedCount.toLocaleString()}
              </span>
            </div>
            <p className="mt-0.5 text-xs text-muted-foreground">Failed</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
