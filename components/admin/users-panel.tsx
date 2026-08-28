"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { RefreshCwIcon, UsersIcon } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  NativeSelect,
  NativeSelectOption,
} from "@/components/ui/native-select";
import { PLAN_LIMITS } from "@/lib/plans/limits";
import { cn } from "@/lib/utils";
import { UserDetailSheet } from "./user-detail-sheet";
import { formatDate, type AdminUser } from "./types";

// The Users tab: every account, what they have sent, and the plan each of
// their workspaces is on. Clicking a row opens the detail screen, which is
// where a plan is actually changed — the table only reports.

type Filter = "all" | "paid" | "free" | "sending" | "idle";
type Sort = "newest" | "emails" | "contacts";

const FILTER_LABELS: Record<Filter, string> = {
  all: "Everyone",
  paid: "On a paid plan",
  free: "On Free only",
  sending: "Has sent",
  idle: "Never sent",
};

const SORT_LABELS: Record<Sort, string> = {
  newest: "Newest first",
  emails: "Most emails sent",
  contacts: "Most contacts",
};

function matchesFilter(user: AdminUser, filter: Filter) {
  switch (filter) {
    case "paid":
      return user.topPlan !== "free";
    case "free":
      return user.topPlan === "free";
    case "sending":
      return user.emailsSent > 0;
    case "idle":
      return user.emailsSent === 0;
    default:
      return true;
  }
}

export function UsersPanel() {
  const [users, setUsers] = useState<AdminUser[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [sort, setSort] = useState<Sort>("newest");
  const [openUserId, setOpenUserId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch("/api/admin/users");
      const payload = await r.json();
      if (payload.ok) setUsers(payload.users);
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
    if (!users) return [];
    const q = query.trim().toLowerCase();
    const rows = users.filter(
      (user) =>
        matchesFilter(user, filter) &&
        (!q ||
          user.email.toLowerCase().includes(q) ||
          (user.name ?? "").toLowerCase().includes(q) ||
          user.organizations.some((org) => org.name.toLowerCase().includes(q))),
    );
    // The API already returns newest first, so that case needs no re-sort.
    if (sort === "emails") {
      return [...rows].sort((a, b) => b.emailsSent - a.emailsSent);
    }
    if (sort === "contacts") {
      return [...rows].sort((a, b) => b.contacts - a.contacts);
    }
    return rows;
  }, [users, query, filter, sort]);

  const totals = useMemo(() => {
    const list = users ?? [];
    return {
      users: list.length,
      paid: list.filter((user) => user.topPlan !== "free").length,
      emails: list.reduce((sum, user) => sum + user.emailsSent, 0),
    };
  }, [users]);

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-3 space-y-0">
          <CardTitle className="flex items-center gap-2 text-base">
            <UsersIcon className="size-4" />
            Users
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
              placeholder="Search name, email, or workspace…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="max-w-xs"
            />
            <NativeSelect
              value={filter}
              aria-label="Filter users"
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
              aria-label="Sort users"
              onChange={(e) => setSort(e.target.value as Sort)}
            >
              {(Object.keys(SORT_LABELS) as Sort[]).map((key) => (
                <NativeSelectOption key={key} value={key}>
                  {SORT_LABELS[key]}
                </NativeSelectOption>
              ))}
            </NativeSelect>
            <p className="ml-auto text-xs text-muted-foreground">
              {totals.users.toLocaleString()} account
              {totals.users === 1 ? "" : "s"} · {totals.paid.toLocaleString()} on a
              paid plan · {totals.emails.toLocaleString()} emails sent
            </p>
          </div>

          {!users ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : visible.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              {users.length === 0
                ? "No accounts yet."
                : "No users match that filter."}
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-xs text-muted-foreground">
                    <th className="py-2 pr-3 font-medium">User</th>
                    <th className="py-2 pr-3 font-medium">Workspaces</th>
                    <th className="py-2 pr-3 font-medium">Plan</th>
                    <th className="py-2 pr-3 font-medium">Campaigns</th>
                    <th className="py-2 pr-3 font-medium">Emails sent</th>
                    <th className="py-2 pr-3 font-medium">Contacts</th>
                    <th className="py-2 pr-3 font-medium">Last sent</th>
                    <th className="py-2 font-medium">Joined</th>
                  </tr>
                </thead>
                <tbody>
                  {visible.map((user) => {
                    // The whole row is the control, so the plan and the send
                    // figures stay readable as plain cells rather than each
                    // needing its own affordance.
                    const paidOrg = user.organizations.find(
                      (org) => org.plan === user.topPlan && org.plan !== "free",
                    );
                    return (
                      <tr
                        key={user.userId}
                        tabIndex={0}
                        role="button"
                        onClick={() => setOpenUserId(user.userId)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            setOpenUserId(user.userId);
                          }
                        }}
                        className="cursor-pointer border-b transition-colors last:border-0 hover:bg-muted/50 focus-visible:bg-muted/50 focus-visible:outline-none"
                      >
                        <td className="py-2 pr-3">
                          <div className="font-medium">{user.name || "—"}</div>
                          <div className="text-xs text-muted-foreground">
                            {user.email}
                          </div>
                        </td>
                        <td className="py-2 pr-3">
                          {user.organizations.length === 0 ? (
                            <span className="text-xs text-muted-foreground">—</span>
                          ) : (
                            <div className="flex flex-wrap gap-1">
                              {user.organizations.map((org) => (
                                <Badge
                                  key={org.id}
                                  variant="secondary"
                                  className="text-[10px]"
                                >
                                  {org.name}
                                </Badge>
                              ))}
                            </div>
                          )}
                        </td>
                        <td className="py-2 pr-3">
                          <Badge
                            variant={user.topPlan === "free" ? "secondary" : "default"}
                          >
                            {PLAN_LIMITS[user.topPlan].label}
                          </Badge>
                          {paidOrg && (
                            <div className="mt-0.5 text-[11px] text-muted-foreground">
                              {paidOrg.planExpiresAt
                                ? `${paidOrg.daysLeft}d left`
                                : "no expiry"}
                            </div>
                          )}
                        </td>
                        <td className="py-2 pr-3 tabular-nums">
                          {user.campaignsSent}
                          <span className="text-xs text-muted-foreground">
                            {" "}
                            / {user.campaignsTotal}
                          </span>
                        </td>
                        <td className="py-2 pr-3 font-semibold tabular-nums">
                          {user.emailsSent.toLocaleString()}
                        </td>
                        <td className="py-2 pr-3 tabular-nums">
                          {user.contacts.toLocaleString()}
                        </td>
                        <td className="py-2 pr-3 text-xs text-muted-foreground">
                          {formatDate(user.lastSentAt)}
                        </td>
                        <td className="py-2 text-xs text-muted-foreground">
                          {formatDate(user.createdAt)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <UserDetailSheet
        userId={openUserId}
        onOpenChange={(open) => {
          if (!open) setOpenUserId(null);
        }}
        onPlanChanged={load}
      />
    </>
  );
}
