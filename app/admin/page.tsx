"use client";

import { useCallback, useEffect, useState } from "react";
import { GaugeIcon, MailIcon, RefreshCwIcon, UsersIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PageLoader } from "@/components/bar-spinner";
import { AnalyticsTab, type InfraPayload } from "@/components/admin/analytics-tab";
import { CampaignsPanel } from "@/components/admin/campaigns-panel";
import { UsersPanel } from "@/components/admin/users-panel";
import { cn } from "@/lib/utils";

// Founder-only admin console (krish + Ethan, via ADMIN_EMAILS). Not linked
// from anywhere in the product — bookmark /admin.
//
// Three tabs, because the page answers three unrelated questions. Analytics
// is about the platform and the providers underneath it — what we've done in
// total, and what is close to a limit that could take sending down. Users is
// about individual people: what they've sent, and what plan they're on.
// Campaigns is about the mail itself — what is going out, through which
// channel, and what it actually said.
//
// Only the open tab is mounted (Radix unmounts inactive panels), so the
// per-user and per-campaign queries never run on a page load that just wanted
// to check the bounce rate.

export default function AdminPage() {
  const [data, setData] = useState<InfraPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [denied, setDenied] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch("/api/admin/infra");
      if (r.status === 404) {
        setDenied(true);
        return;
      }
      const payload = await r.json();
      if (payload.ok) setData(payload);
    } catch {
      // keep the last snapshot
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  if (denied) {
    return (
      <main className="flex min-h-svh items-center justify-center bg-background text-sm text-muted-foreground">
        Nothing here.
      </main>
    );
  }

  if (!data) {
    return (
      <main className="flex min-h-svh items-center justify-center bg-background">
        <PageLoader />
      </main>
    );
  }

  return (
    <main className="min-h-svh bg-background px-4 py-8 md:px-8">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold tracking-normal">Admin</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Platform stats, provider limits, and the people using this —
              founders only. Snapshot from{" "}
              {new Date(data.generatedAt).toLocaleTimeString()}.
            </p>
          </div>
          <Button variant="outline" onClick={load} disabled={loading}>
            <RefreshCwIcon
              data-icon="inline-start"
              className={cn(loading && "animate-spin")}
            />
            Refresh
          </Button>
        </div>

        <Tabs defaultValue="analytics" className="gap-6">
          <TabsList>
            <TabsTrigger value="analytics">
              <GaugeIcon data-icon="inline-start" />
              Analytics
            </TabsTrigger>
            <TabsTrigger value="users">
              <UsersIcon data-icon="inline-start" />
              Users
            </TabsTrigger>
            <TabsTrigger value="campaigns">
              <MailIcon data-icon="inline-start" />
              Campaigns
            </TabsTrigger>
          </TabsList>

          <TabsContent value="analytics">
            <AnalyticsTab data={data} />
          </TabsContent>

          <TabsContent value="users">
            <UsersPanel />
          </TabsContent>

          <TabsContent value="campaigns">
            <CampaignsPanel />
          </TabsContent>
        </Tabs>
      </div>
    </main>
  );
}
