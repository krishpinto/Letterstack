"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

type Campaign = {
  id: string;
  name: string;
  subject: string;
  status: string;
  createdAt: string;
};

const STATUS_TONE: Record<string, string> = {
  draft: "bg-zinc-100 text-zinc-600",
  sending: "bg-amber-100 text-amber-700",
  sent: "bg-emerald-100 text-emerald-700",
};

export default function CampaignsPage() {
  const [list, setList] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/campaigns")
      .then((r) => r.json())
      .then((d) => {
        if (d.ok) setList(d.campaigns);
      })
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold tracking-tight">Campaigns</h1>
      <p className="mt-1 text-sm text-zinc-500">Every send and its status. Click one to see details.</p>

      <div className="mt-6 overflow-hidden rounded-xl border border-zinc-200 bg-white">
        {/* header row */}
        <div className="grid grid-cols-[1fr_auto_auto] gap-4 border-b border-zinc-100 px-5 py-3 text-xs font-semibold uppercase tracking-wide text-zinc-400">
          <span>Campaign</span>
          <span>Status</span>
          <span>Created</span>
        </div>

        {loading && <div className="px-5 py-6 text-sm text-zinc-400">Loading…</div>}

        {!loading && list.length === 0 && (
          <div className="px-5 py-6 text-sm text-zinc-400">
            No campaigns yet — send one from{" "}
            <Link href="/dashboard/send" className="underline">Send</Link>.
          </div>
        )}

        {list.map((c) => (
          <Link
            key={c.id}
            href={`/dashboard/campaigns/${c.id}`}
            className="grid grid-cols-[1fr_auto_auto] items-center gap-4 border-b border-zinc-50 px-5 py-3 text-sm transition-colors last:border-0 hover:bg-zinc-50"
          >
            <div className="min-w-0">
              <div className="truncate font-medium text-zinc-800">{c.name}</div>
              <div className="truncate text-xs text-zinc-400">{c.subject}</div>
            </div>
            <span
              className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                STATUS_TONE[c.status] ?? "bg-zinc-100 text-zinc-600"
              }`}
            >
              {c.status}
            </span>
            <span className="text-xs text-zinc-400">
              {new Date(c.createdAt).toLocaleDateString()}
            </span>
          </Link>
        ))}
      </div>
    </div>
  );
}
