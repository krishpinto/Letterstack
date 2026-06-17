"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";

type Progress = { total: number; sent: number; failed: number; pending: number };
type Data = {
  campaign: { id: string; name: string; subject: string; status: string };
  progress: Progress;
};

export default function CampaignMonitor() {
  const { id } = useParams<{ id: string }>();
  const [data, setData] = useState<Data | null>(null);

  // Poll the progress endpoint every 1.5s; stop once nothing is pending.
  useEffect(() => {
    let active = true;
    let timer: ReturnType<typeof setTimeout>;

    async function poll() {
      const res = await fetch(`/api/campaigns/${id}/progress`);
      const json = await res.json();
      if (!active) return;
      if (json.ok) {
        setData({ campaign: json.campaign, progress: json.progress });
        // Keep polling while work remains.
        if (json.progress.pending > 0 || json.progress.total === 0) {
          timer = setTimeout(poll, 1500);
        }
      }
    }
    poll();
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [id]);

  if (!data) {
    return <div className="p-8 text-sm text-zinc-500">Loading…</div>;
  }

  const { campaign, progress } = data;
  const done = progress.sent + progress.failed;
  const pct = progress.total > 0 ? Math.round((done / progress.total) * 100) : 0;
  const finished = progress.total > 0 && progress.pending === 0;

  return (
    <div className="p-8">
      <Link href="/dashboard/send" className="text-sm text-zinc-500 hover:text-zinc-900">
        ← Back to send
      </Link>

      <h1 className="mt-3 text-2xl font-bold tracking-tight">{campaign.name}</h1>
      <p className="mt-1 text-sm text-zinc-500">{campaign.subject}</p>

      <div className="mt-6 max-w-xl rounded-xl border border-zinc-200 bg-white p-6">
        <div className="flex items-center justify-between text-sm">
          <span className="font-medium">
            {finished ? "✔ Complete" : "Sending…"}
          </span>
          <span className="text-zinc-500">
            {done} / {progress.total} ({pct}%)
          </span>
        </div>

        {/* Progress bar */}
        <div className="mt-3 h-3 overflow-hidden rounded-full bg-zinc-100">
          <div
            className={`h-full rounded-full transition-all duration-500 ${
              finished ? "bg-emerald-500" : "bg-amber-500"
            }`}
            style={{ width: `${pct}%` }}
          />
        </div>

        {/* Counts */}
        <div className="mt-6 grid grid-cols-3 gap-3 text-center">
          <Stat label="Sent" value={progress.sent} tone="text-emerald-600" />
          <Stat label="Pending" value={progress.pending} tone="text-amber-600" />
          <Stat label="Failed" value={progress.failed} tone="text-red-600" />
        </div>

        {!finished && progress.total > 0 && (
          <p className="mt-5 text-xs text-zinc-400">
            Live — updates every couple seconds as QStash delivers each batch to
            the worker. (Batch-level detail &amp; retries are in the QStash console.)
          </p>
        )}
      </div>
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: number; tone: string }) {
  return (
    <div className="rounded-lg border border-zinc-100 bg-zinc-50 p-3">
      <div className={`text-2xl font-bold ${tone}`}>{value}</div>
      <div className="text-xs text-zinc-500">{label}</div>
    </div>
  );
}
