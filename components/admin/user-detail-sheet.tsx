"use client";

import { useCallback, useEffect, useState } from "react";
import { BuildingIcon, MailIcon, UserIcon } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Spinner } from "@/components/ui/spinner";
import { PLAN_LIMITS } from "@/lib/plans/limits";
import { cn } from "@/lib/utils";
import { LimitBar } from "./limit-bar";
import { PlanEditor } from "./plan-editor";
import {
  formatDate,
  formatDateTime,
  type AdminOrg,
  type AdminUserDetail,
} from "./types";

// The screen that opens when a user row is clicked: who they are, every
// workspace they belong to with its plan control, and what they have actually
// sent. It fetches its own detail rather than taking it from the table, so
// the heavy per-campaign history is only ever loaded for the one person being
// looked at.

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-xl font-semibold tabular-nums">{value}</span>
      <span className="text-xs text-muted-foreground">{label}</span>
      {sub && <span className="text-[11px] text-muted-foreground/70">{sub}</span>}
    </div>
  );
}

function statusTone(status: string) {
  if (status === "sent") return "text-emerald-500";
  if (status === "sending") return "text-sky-500";
  if (status === "scheduled") return "text-amber-500";
  return "text-muted-foreground";
}

function WorkspaceCard({
  org,
  onChanged,
}: {
  org: AdminOrg;
  onChanged: () => void | Promise<void>;
}) {
  return (
    <div className="flex flex-col gap-3 rounded-3xl border p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="flex items-center gap-2 font-medium">
            <BuildingIcon className="size-4 text-muted-foreground" />
            {org.name}
          </p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {org.type} · {org.role} · {org.memberCount} member
            {org.memberCount === 1 ? "" : "s"} · created {formatDate(org.createdAt)}
          </p>
        </div>
        <Badge variant={org.plan === "free" ? "secondary" : "default"}>
          {PLAN_LIMITS[org.plan].label}
        </Badge>
      </div>

      <div className="grid grid-cols-3 gap-3 text-sm">
        <div>
          <p className="font-semibold tabular-nums">
            {org.contacts.toLocaleString()}
            <span className="text-xs font-normal text-muted-foreground">
              {" "}
              / {org.contactAllowance.toLocaleString()}
            </span>
          </p>
          <p className="text-xs text-muted-foreground">Contacts</p>
        </div>
        <div>
          <p className="font-semibold tabular-nums">{org.campaigns.toLocaleString()}</p>
          <p className="text-xs text-muted-foreground">Campaigns</p>
        </div>
        <div>
          <p className="font-semibold tabular-nums">{org.suppressed.toLocaleString()}</p>
          <p className="text-xs text-muted-foreground">Suppressed</p>
        </div>
      </div>

      <div className="flex flex-col gap-1">
        <p className="text-xs text-muted-foreground">Emails this month</p>
        <LimitBar used={org.emailsThisMonth} limit={org.emailAllowance} />
      </div>

      <PlanEditor org={org} onSaved={onChanged} />
    </div>
  );
}

export function UserDetailSheet({
  userId,
  onOpenChange,
  onPlanChanged,
}: {
  /** The user whose screen is open, or null when nothing is open. */
  userId: string | null;
  onOpenChange: (open: boolean) => void;
  /** Lets the table behind refresh its plan badges after a grant or removal. */
  onPlanChanged: () => void | Promise<void>;
}) {
  const [user, setUser] = useState<AdminUserDetail | null>(null);
  const [loading, setLoading] = useState(false);

  const load = useCallback(
    async (signal?: AbortSignal) => {
      if (!userId) return;
      setLoading(true);
      try {
        const r = await fetch(`/api/admin/users/${userId}`, { signal });
        const payload = await r.json();
        if (payload.ok) setUser(payload.user);
      } catch (err) {
        // An abort means a newer person is already loading — their request
        // owns the state now.
        if ((err as Error)?.name === "AbortError") return;
        // keep the last snapshot
      } finally {
        if (!signal?.aborted) setLoading(false);
      }
    },
    [userId]
  );

  useEffect(() => {
    // Drop the previous person's detail immediately, so opening a second row
    // can never show the first row's history while the fetch is in flight.
    setUser(null);

    // Clearing alone isn't enough: without this, a slow request for the first
    // person could still resolve after the second person's and write their
    // details into the open sheet.
    const controller = new AbortController();
    void load(controller.signal);
    return () => controller.abort();
  }, [load]);

  async function afterPlanChange() {
    await Promise.all([load(), onPlanChanged()]);
  }

  return (
    <Sheet open={userId !== null} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="gap-0 data-[side=right]:sm:max-w-2xl"
      >
        {!user ? (
          <div className="flex h-full items-center justify-center">
            <Spinner />
          </div>
        ) : (
          <>
            <SheetHeader className="border-b pr-12">
              <SheetTitle className="flex items-center gap-2">
                <UserIcon className="size-4 text-muted-foreground" />
                {user.name || "Unnamed account"}
              </SheetTitle>
              <SheetDescription className="flex flex-wrap items-center gap-2">
                {user.email}
                <Badge variant="secondary" className="text-[10px]">
                  {user.authMethod === "google" ? "Google sign-in" : "Password"}
                </Badge>
                <Badge
                  variant={user.topPlan === "free" ? "secondary" : "default"}
                  className="text-[10px]"
                >
                  {PLAN_LIMITS[user.topPlan].label}
                </Badge>
              </SheetDescription>
            </SheetHeader>

            <div className="flex flex-1 flex-col gap-6 overflow-y-auto p-4">
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                <Stat
                  label="Emails sent"
                  value={user.emailsSent.toLocaleString()}
                  sub="all time"
                />
                <Stat
                  label="Campaigns"
                  value={`${user.campaignsSent} / ${user.campaignsTotal}`}
                  sub="sent / created"
                />
                <Stat label="Contacts" value={user.contacts.toLocaleString()} />
                <Stat
                  label="Joined"
                  value={formatDate(user.createdAt)}
                  sub={
                    user.lastSentAt
                      ? `last sent ${formatDate(user.lastSentAt)}`
                      : "never sent"
                  }
                />
              </div>

              <section className="flex flex-col gap-3">
                <h3 className="text-sm font-medium">
                  Workspaces and plans
                  <span className="ml-2 text-xs font-normal text-muted-foreground">
                    plans belong to a workspace, not to a person
                  </span>
                </h3>
                {user.organizations.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    Not a member of any workspace.
                  </p>
                ) : (
                  user.organizations.map((org) => (
                    <WorkspaceCard key={org.id} org={org} onChanged={afterPlanChange} />
                  ))
                )}
              </section>

              <section className="flex flex-col gap-3">
                <h3 className="flex items-center gap-2 text-sm font-medium">
                  <MailIcon className="size-4 text-muted-foreground" />
                  Sending history
                  {loading && <Spinner className="size-3.5" />}
                </h3>
                {user.campaignHistory.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    No campaigns created yet.
                  </p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b text-left text-xs text-muted-foreground">
                          <th className="py-2 pr-3 font-medium">Campaign</th>
                          <th className="py-2 pr-3 font-medium">Status</th>
                          <th className="py-2 pr-3 font-medium">Delivered</th>
                          <th className="py-2 font-medium">When</th>
                        </tr>
                      </thead>
                      <tbody>
                        {user.campaignHistory.map((campaign) => (
                          <tr key={campaign.id} className="border-b last:border-0">
                            <td className="py-2 pr-3">
                              <div className="font-medium">{campaign.name}</div>
                              <div className="text-xs text-muted-foreground">
                                {campaign.subject}
                              </div>
                              <div className="text-[11px] text-muted-foreground/70">
                                {campaign.organizationName}
                              </div>
                            </td>
                            <td
                              className={cn(
                                "py-2 pr-3 text-xs capitalize",
                                statusTone(campaign.status),
                              )}
                            >
                              {campaign.status}
                            </td>
                            <td className="py-2 pr-3 tabular-nums">
                              {campaign.sent.toLocaleString()}
                              <span className="text-xs text-muted-foreground">
                                {" "}
                                / {campaign.recipients.toLocaleString()}
                              </span>
                              {campaign.failed > 0 && (
                                <div className="text-xs text-red-500">
                                  {campaign.failed.toLocaleString()} failed
                                </div>
                              )}
                            </td>
                            <td className="py-2 text-xs text-muted-foreground">
                              {campaign.sentAt
                                ? formatDateTime(campaign.sentAt)
                                : campaign.scheduledAt
                                  ? `scheduled ${formatDateTime(campaign.scheduledAt)}`
                                  : `drafted ${formatDate(campaign.createdAt)}`}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </section>
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
