import Link from "next/link";
import {
  ArrowRightIcon,
  GlobeIcon,
  MailCheckIcon,
  PenLineIcon,
  SendIcon,
  UsersIcon,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

const actions = [
  {
    href: "/dashboard/campaigns",
    title: "Build a campaign",
    body: "Create a draft, choose a template, review the checklist, and send.",
    cta: "Open campaigns",
    icon: SendIcon,
  },
  {
    href: "/dashboard/domains",
    title: "Connect a domain",
    body: "Prepare your sender identity, DNS records, or Gmail connection.",
    cta: "Open domains",
    icon: GlobeIcon,
  },
];

const metrics = [
  {
    label: "Audiences",
    value: "Per campaign",
    description: "Each campaign owns its recipient list",
    icon: UsersIcon,
  },
  {
    label: "Templates",
    value: "12",
    description: "Reusable campaign layouts",
    icon: PenLineIcon,
  },
  {
    label: "Domains",
    value: "2",
    description: "Custom and Gmail options",
    icon: GlobeIcon,
  },
  {
    label: "Delivery",
    value: "98.2%",
    description: "Last campaign health",
    icon: MailCheckIcon,
  },
];

const recentCampaigns = [
  ["June Newsletter", "Draft", "12 min ago"],
  ["Product launch", "Sent", "Yesterday"],
  ["Creator digest", "Queued", "Jun 18"],
] as const;

export default function DashboardHome() {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col justify-between gap-3 md:flex-row md:items-end">
        <div>
          <h1 className="text-2xl font-semibold tracking-normal">Overview</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Your campaign workspace, shaped around templates, campaign audiences,
            and sending.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" asChild>
            <Link href="/dashboard/campaigns">Manage audiences</Link>
          </Button>
          <Button asChild>
            <Link href="/dashboard/campaigns">
              New campaign
              <ArrowRightIcon data-icon="inline-end" />
            </Link>
          </Button>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {metrics.map((metric) => {
          const Icon = metric.icon;

          return (
            <Card key={metric.label}>
              <CardHeader className="flex flex-row items-center justify-between gap-3">
                <div>
                  <CardDescription>{metric.label}</CardDescription>
                  <CardTitle className="mt-1 text-2xl">
                    {metric.value}
                  </CardTitle>
                </div>
                <span className="flex size-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <Icon className="size-4" />
                </span>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  {metric.description}
                </p>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {actions.map((action) => {
          const Icon = action.icon;

          return (
            <Card key={action.href}>
              <CardHeader>
                <span className="flex size-10 items-center justify-center rounded-lg bg-muted text-foreground">
                  <Icon className="size-5" />
                </span>
                <CardTitle>{action.title}</CardTitle>
                <CardDescription>{action.body}</CardDescription>
              </CardHeader>
              <CardFooter>
                <Button variant="outline" asChild>
                  <Link href={action.href}>
                    {action.cta}
                    <ArrowRightIcon data-icon="inline-end" />
                  </Link>
                </Button>
              </CardFooter>
            </Card>
          );
        })}
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_24rem]">
        <Card>
          <CardHeader>
            <CardTitle>Recent campaigns</CardTitle>
            <CardDescription>
              A visual placeholder for the live campaign list.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Campaign</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Updated</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {recentCampaigns.map(([name, status, updated]) => (
                  <TableRow key={name}>
                    <TableCell className="font-medium">{name}</TableCell>
                    <TableCell>
                      <Badge
                        variant={status === "Sent" ? "default" : "outline"}
                      >
                        {status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right text-muted-foreground">
                      {updated}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Workspace setup</CardTitle>
            <CardDescription>
              The domain and analytics pieces can plug in later.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <div className="flex items-center justify-between gap-3 text-sm">
              <span className="font-medium">Profile and organization</span>
              <Badge>Done</Badge>
            </div>
            <Progress value={38} />
            <div className="flex flex-col gap-2 text-sm text-muted-foreground">
              <div className="flex items-center justify-between gap-3">
                <span>Connect sender domain</span>
                <Badge variant="outline">Ready</Badge>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span>Add recipients per campaign</span>
                <Badge variant="outline">Ready</Badge>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span>Invite teammate</span>
                <Badge variant="outline">Soon</Badge>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
