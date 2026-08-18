"use client";

import { useCallback, useEffect, useState } from "react";
import { CreditCardIcon, RefreshCwIcon } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

type OrgRow = {
  id: string;
  name: string;
  type: string;
  ownerName: string | null;
  ownerEmail: string | null;
  memberCount: number;
  plan: "free" | "pro";
  planSource: "none" | "trial" | "paid" | "granted";
  planExpiresAt: string | null;
  daysLeft: number | null;
  createdAt: string;
};

function planVariant(plan: "free" | "pro"): "default" | "secondary" {
  return plan === "pro" ? "default" : "secondary";
}

function sourceLabel(source: OrgRow["planSource"]) {
  if (source === "paid") return "Paid";
  if (source === "trial") return "Trial";
  if (source === "granted") return "Admin grant";
  return "—";
}

const GRANT_PRESETS = [7, 30, 90, 365];

// Self-fetching, same pattern as UsersPanel/SenderStatsPanel — independent
// refresh, keeps the infra page's own load() cycle from growing further.
export function SubscriptionsPanel() {
  const [orgs, setOrgs] = useState<OrgRow[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [pendingOrgId, setPendingOrgId] = useState<string | null>(null);
  const [days, setDays] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch("/api/admin/subscriptions");
      const payload = await r.json();
      if (payload.ok) setOrgs(payload.organizations);
    } catch {
      // keep the last snapshot
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function grant(organizationId: string, amount: number) {
    if (!Number.isFinite(amount) || amount <= 0) return;

    setPendingOrgId(organizationId);
    try {
      const r = await fetch("/api/admin/subscriptions", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ organizationId, days: amount }),
      });
      const payload = await r.json();
      if (payload.ok) await load();
    } finally {
      setPendingOrgId(null);
    }
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-3 space-y-0">
        <CardTitle className="flex items-center gap-2 text-base">
          <CreditCardIcon className="size-4" />
          Subscriptions
        </CardTitle>
        <Button variant="outline" size="sm" onClick={load} disabled={loading}>
          <RefreshCwIcon data-icon="inline-start" className={cn(loading && "animate-spin")} />
          Refresh
        </Button>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {!orgs ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : orgs.length === 0 ? (
          <p className="text-sm text-muted-foreground">No organizations yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-xs text-muted-foreground">
                  <th className="py-2 pr-3 font-medium">Organization</th>
                  <th className="py-2 pr-3 font-medium">Owner</th>
                  <th className="py-2 pr-3 font-medium">Plan</th>
                  <th className="py-2 pr-3 font-medium">Source</th>
                  <th className="py-2 pr-3 font-medium">Expires</th>
                  <th className="py-2 pr-3 font-medium">Grant free Pro</th>
                </tr>
              </thead>
              <tbody>
                {orgs.map((org) => {
                  const pending = pendingOrgId === org.id;
                  return (
                    <tr key={org.id} className="border-b last:border-0">
                      <td className="py-2 pr-3">
                        <div className="font-medium">{org.name}</div>
                        <div className="text-xs text-muted-foreground">
                          {org.memberCount} member{org.memberCount === 1 ? "" : "s"}
                        </div>
                      </td>
                      <td className="py-2 pr-3">
                        <div>{org.ownerName || "—"}</div>
                        <div className="text-xs text-muted-foreground">{org.ownerEmail || "—"}</div>
                      </td>
                      <td className="py-2 pr-3">
                        <Badge variant={planVariant(org.plan)}>
                          {org.plan === "pro" ? "Pro" : "Free"}
                        </Badge>
                      </td>
                      <td className="py-2 pr-3 text-xs text-muted-foreground">
                        {sourceLabel(org.planSource)}
                      </td>
                      <td className="py-2 pr-3 text-xs text-muted-foreground">
                        {org.planExpiresAt ? (
                          <>
                            {new Date(org.planExpiresAt).toLocaleDateString()}
                            {typeof org.daysLeft === "number" ? ` (${org.daysLeft}d left)` : ""}
                          </>
                        ) : org.plan === "pro" ? (
                          "Never"
                        ) : (
                          "—"
                        )}
                      </td>
                      <td className="py-2 pr-3">
                        <div className="flex flex-wrap items-center gap-2">
                          <Input
                            type="number"
                            min={1}
                            max={3650}
                            placeholder="Days"
                            value={days[org.id] ?? ""}
                            onChange={(e) =>
                              setDays((prev) => ({ ...prev, [org.id]: e.target.value }))
                            }
                            className="h-8 w-20"
                            disabled={pending}
                          />
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={pending || !Number(days[org.id])}
                            onClick={() => grant(org.id, Number(days[org.id]))}
                          >
                            Grant
                          </Button>
                          <div className="flex gap-1">
                            {GRANT_PRESETS.map((preset) => (
                              <Button
                                key={preset}
                                size="sm"
                                variant="ghost"
                                className="text-xs text-muted-foreground"
                                disabled={pending}
                                onClick={() => grant(org.id, preset)}
                              >
                                +{preset}d
                              </Button>
                            ))}
                          </div>
                        </div>
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
  );
}
