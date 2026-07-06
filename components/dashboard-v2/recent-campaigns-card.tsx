import Link from "next/link";
import {
  ArrowRightIcon,
  CheckCircle2Icon,
  CircleDotIcon,
  ClockIcon,
  MailIcon,
  MoreHorizontalIcon,
  XCircleIcon,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

export type CampaignStatus = "draft" | "sending" | "sent" | "failed";

export type CampaignRowData = {
  id: string;
  name: string;
  status: CampaignStatus;
  subject?: string;
  recipientCount?: number;
  updatedAt: string;
};

const statusConfig: Record<
  CampaignStatus,
  { label: string; icon: React.ElementType; className: string }
> = {
  draft: {
    label: "Draft",
    icon: ClockIcon,
    className: "border-muted-foreground/30 bg-muted/60 text-muted-foreground",
  },
  sending: {
    label: "Sending",
    icon: CircleDotIcon,
    className: "border-amber-500/30 bg-amber-500/10 text-amber-500",
  },
  sent: {
    label: "Sent",
    icon: CheckCircle2Icon,
    className: "border-emerald-500/30 bg-emerald-500/10 text-emerald-500",
  },
  failed: {
    label: "Failed",
    icon: XCircleIcon,
    className: "border-destructive/30 bg-destructive/10 text-destructive",
  },
};

function CampaignStatusBadge({ status }: { status: CampaignStatus }) {
  const config = statusConfig[status];
  const StatusIcon = config.icon;

  return (
    <Badge
      variant="outline"
      className={cn("gap-1.5 text-xs font-normal", config.className)}
    >
      <StatusIcon className="size-3" />
      {config.label}
    </Badge>
  );
}

type RecentCampaignsCardProps = {
  campaigns: CampaignRowData[];
};

export function RecentCampaignsCard({ campaigns }: RecentCampaignsCardProps) {
  return (
    <Card className="flex flex-col">
      <CardHeader className="flex flex-row items-center justify-between gap-4 pb-2">
        <div className="flex items-center gap-2">
          <span className="flex size-7 items-center justify-center rounded-md bg-muted">
            <MailIcon className="size-3.5 text-muted-foreground" />
          </span>
          <CardTitle className="text-base font-medium">Recent campaigns</CardTitle>
        </div>
        <Button variant="ghost" size="sm" className="text-xs text-muted-foreground" asChild>
          <Link href="/dashboard/campaigns">
            View all
            <ArrowRightIcon className="ml-1 size-3" />
          </Link>
        </Button>
      </CardHeader>

      <CardContent className="flex-1 px-0 pb-0">
        {campaigns.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 py-8 text-center text-sm text-muted-foreground">
            <MailIcon className="size-8 opacity-30" />
            <p>No campaigns yet</p>
            <Button variant="outline" size="sm" asChild>
              <Link href="/dashboard/campaigns">Create your first campaign</Link>
            </Button>
          </div>
        ) : (
          <div className="divide-y divide-border">
            {campaigns.map((campaign) => (
              <div
                key={campaign.id}
                className="flex items-center gap-3 px-4 py-3 hover:bg-muted/40 transition-colors"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium leading-none">
                    {campaign.name}
                  </p>
                  {campaign.subject && (
                    <p className="mt-1 truncate text-xs text-muted-foreground">
                      {campaign.subject}
                    </p>
                  )}
                </div>

                <div className="flex shrink-0 items-center gap-2">
                  {campaign.recipientCount !== undefined && (
                    <span className="hidden text-xs text-muted-foreground sm:inline">
                      {campaign.recipientCount.toLocaleString()} recipients
                    </span>
                  )}
                  <CampaignStatusBadge status={campaign.status} />
                  <span className="hidden text-xs text-muted-foreground lg:inline">
                    {campaign.updatedAt}
                  </span>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-7 opacity-0 group-hover:opacity-100 hover:opacity-100"
                      >
                        <MoreHorizontalIcon className="size-3.5" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem asChild>
                        <Link href={`/dashboard/campaigns/${campaign.id}`}>
                          Open campaign
                        </Link>
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>

      <CardFooter className="pt-3 pb-3">
        <Button variant="outline" size="sm" className="w-full" asChild>
          <Link href="/dashboard/campaigns">
            New campaign
            <ArrowRightIcon className="ml-1 size-3.5" />
          </Link>
        </Button>
      </CardFooter>
    </Card>
  );
}
