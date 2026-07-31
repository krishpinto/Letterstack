"use client";

import { useCallback, useEffect, useState } from "react";
import { RefreshCwIcon, UsersIcon } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

type AccessStatus = "pending" | "approved" | "rejected";

type AdminUserRow = {
  id: string;
  name: string | null;
  email: string;
  accessStatus: AccessStatus;
  organizationNames: string[];
  createdAt: string;
  accessDecidedAt: string | null;
  accessDecidedByUserId: string | null;
};

const FILTERS: Array<{ label: string; value: AccessStatus | "all" }> = [
  { label: "Pending", value: "pending" },
  { label: "All", value: "all" },
  { label: "Approved", value: "approved" },
  { label: "Rejected", value: "rejected" },
];

function statusVariant(status: AccessStatus): "default" | "secondary" | "destructive" {
  if (status === "approved") return "default";
  if (status === "rejected") return "destructive";
  return "secondary";
}

// Deliberately self-fetching rather than folded into the infra page's
// InfraPayload/load() cycle — refreshes independently and keeps that
// already-large file from growing further.
export function UsersPanel() {
  const [users, setUsers] = useState<AdminUserRow[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<AccessStatus | "all">("pending");
  const [pendingActionId, setPendingActionId] = useState<string | null>(null);

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

  async function decide(userId: string, accessStatus: AccessStatus) {
    setPendingActionId(userId);
    try {
      const r = await fetch("/api/admin/users", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, accessStatus }),
      });
      const payload = await r.json();
      if (payload.ok) await load();
    } finally {
      setPendingActionId(null);
    }
  }

  const visible = users?.filter((u) => filter === "all" || u.accessStatus === filter) ?? [];

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-3 space-y-0">
        <CardTitle className="flex items-center gap-2 text-base">
          <UsersIcon className="size-4" />
          Users
        </CardTitle>
        <Button variant="outline" size="sm" onClick={load} disabled={loading}>
          <RefreshCwIcon data-icon="inline-start" className={cn(loading && "animate-spin")} />
          Refresh
        </Button>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="flex flex-wrap gap-2">
          {FILTERS.map((f) => (
            <Button
              key={f.value}
              size="sm"
              variant={filter === f.value ? "default" : "outline"}
              onClick={() => setFilter(f.value)}
            >
              {f.label}
            </Button>
          ))}
        </div>

        {!users ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : visible.length === 0 ? (
          <p className="text-sm text-muted-foreground">No users in this view.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-xs text-muted-foreground">
                  <th className="py-2 pr-3 font-medium">User</th>
                  <th className="py-2 pr-3 font-medium">Org(s)</th>
                  <th className="py-2 pr-3 font-medium">Status</th>
                  <th className="py-2 pr-3 font-medium">Applied</th>
                  <th className="py-2 pr-3 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {visible.map((u) => (
                  <tr key={u.id} className="border-b last:border-0">
                    <td className="py-2 pr-3">
                      <div className="font-medium">{u.name || "—"}</div>
                      <div className="text-xs text-muted-foreground">{u.email}</div>
                    </td>
                    <td className="py-2 pr-3 text-xs text-muted-foreground">
                      {u.organizationNames.length > 0 ? u.organizationNames.join(", ") : "—"}
                    </td>
                    <td className="py-2 pr-3">
                      <Badge variant={statusVariant(u.accessStatus)}>{u.accessStatus}</Badge>
                    </td>
                    <td className="py-2 pr-3 text-xs text-muted-foreground">
                      {new Date(u.createdAt).toLocaleDateString()}
                    </td>
                    <td className="py-2 pr-3">
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={u.accessStatus === "approved" || pendingActionId === u.id}
                          onClick={() => decide(u.id, "approved")}
                        >
                          Approve
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={u.accessStatus === "rejected" || pendingActionId === u.id}
                          onClick={() => decide(u.id, "rejected")}
                        >
                          Reject
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={u.accessStatus === "pending" || pendingActionId === u.id}
                          onClick={() => decide(u.id, "pending")}
                        >
                          Set pending
                        </Button>
                      </div>
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
