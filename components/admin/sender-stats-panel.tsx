"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { MailIcon, RefreshCwIcon, SendIcon } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

type SenderRow = {
  userId: string;
  name: string | null;
  email: string;
  organizationNames: string[];
  campaignsTotal: number;
  campaignsSent: number;
  emailsSent: number;
  lastSentAt: string | null;
};

// Self-fetching, same pattern as UsersPanel — independent refresh, keeps
// the infra page's own load() cycle from growing further.
export function SenderStatsPanel() {
  const [senders, setSenders] = useState<SenderRow[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch("/api/admin/senders");
      const payload = await r.json();
      if (payload.ok) setSenders(payload.senders);
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
    if (!senders) return [];
    const q = query.trim().toLowerCase();
    if (!q) return senders;
    return senders.filter(
      (s) =>
        (s.name ?? "").toLowerCase().includes(q) ||
        s.email.toLowerCase().includes(q) ||
        s.organizationNames.some((name) => name.toLowerCase().includes(q)),
    );
  }, [senders, query]);

  const totalEmailsSent = senders?.reduce((sum, s) => sum + s.emailsSent, 0) ?? 0;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-3 space-y-0">
        <CardTitle className="flex items-center gap-2 text-base">
          <SendIcon className="size-4" />
          Sending activity by user
        </CardTitle>
        <Button variant="outline" size="sm" onClick={load} disabled={loading}>
          <RefreshCwIcon data-icon="inline-start" className={cn(loading && "animate-spin")} />
          Refresh
        </Button>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Input
            placeholder="Filter by name, email, or org…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="max-w-xs"
          />
          <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <MailIcon className="size-3.5" />
            {totalEmailsSent.toLocaleString()} emails sent across {senders?.length ?? 0} sender
            {senders?.length === 1 ? "" : "s"}
          </p>
        </div>

        {!senders ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : visible.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            {senders.length === 0 ? "No campaigns created yet." : "No senders match that filter."}
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-xs text-muted-foreground">
                  <th className="py-2 pr-3 font-medium">User</th>
                  <th className="py-2 pr-3 font-medium">Org(s)</th>
                  <th className="py-2 pr-3 font-medium">Campaigns</th>
                  <th className="py-2 pr-3 font-medium">Emails sent</th>
                  <th className="py-2 pr-3 font-medium">Last sent</th>
                </tr>
              </thead>
              <tbody>
                {visible.map((s) => (
                  <tr key={s.userId} className="border-b last:border-0">
                    <td className="py-2 pr-3">
                      <div className="font-medium">{s.name || "—"}</div>
                      <div className="text-xs text-muted-foreground">{s.email}</div>
                    </td>
                    <td className="py-2 pr-3">
                      {s.organizationNames.length > 0 ? (
                        <div className="flex flex-wrap gap-1">
                          {s.organizationNames.map((name) => (
                            <Badge key={name} variant="secondary" className="text-[10px]">
                              {name}
                            </Badge>
                          ))}
                        </div>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="py-2 pr-3 tabular-nums">
                      {s.campaignsSent}
                      <span className="text-xs text-muted-foreground"> / {s.campaignsTotal} sent</span>
                    </td>
                    <td className="py-2 pr-3 font-semibold tabular-nums">
                      {s.emailsSent.toLocaleString()}
                    </td>
                    <td className="py-2 pr-3 text-xs text-muted-foreground">
                      {s.lastSentAt ? new Date(s.lastSentAt).toLocaleString() : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
