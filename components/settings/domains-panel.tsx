"use client";

import { useCallback, useEffect, useState } from "react";
import {
  CheckIcon,
  ChevronDownIcon,
  CopyIcon,
  GlobeIcon,
  PlusIcon,
  RefreshCwIcon,
} from "lucide-react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { confirmDialog } from "@/components/app-dialogs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Spinner } from "@/components/ui/spinner";

/**
 * Settings → Domains.
 *
 * Shares /api/domains with /dashboard/domains and owns none of the logic:
 * that route is what talks to SES, re-reads DKIM and MAIL FROM status on
 * every load, and writes the verdict back so the send path can trust it
 * without calling SES per campaign. Both surfaces are views over the same
 * endpoint, so they cannot disagree about whether a domain is verified.
 *
 * The presentation is deliberately not the same. /dashboard/domains is the
 * wide setup walkthrough — a full DNS record table, room to work through it
 * with a provider's control panel open in the next tab. This is the dense
 * version for a 2-column settings pane: status at a glance, add, disconnect,
 * re-check, and the records folded away behind a disclosure for when someone
 * needs to paste one again.
 */

type DnsRecord = {
  type: string;
  host: string;
  value: string;
  priority?: number;
  purpose: string;
  group: "dkim" | "mailFrom";
};

type ConnectedDomain = {
  domain: string;
  dkimStatus: string;
  mailFromStatus: string;
  readyToSend: boolean;
  records: DnsRecord[];
};

type DomainsState = {
  sharedFromEmail: string;
  limit: number;
  domains: ConnectedDomain[];
};

export function DomainsPanel({ canManage }: { canManage: boolean }) {
  const [state, setState] = useState<DomainsState | null>(null);
  const [domainInput, setDomainInput] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const response = await fetch("/api/domains");
      const data = await response.json().catch(() => null);
      if (data?.ok) {
        setState({
          sharedFromEmail: data.sharedFromEmail,
          limit: data.limit,
          domains: data.domains ?? [],
        });
        setError(null);
      } else {
        setError(data?.error ?? "Could not load domain status.");
      }
    } catch {
      setError("Could not reach the server.");
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function connect() {
    setBusy("connect");
    setError(null);
    try {
      const response = await fetch("/api/domains", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ domain: domainInput }),
      });
      const data = await response.json().catch(() => null);
      if (data?.ok) {
        setState({
          sharedFromEmail: data.sharedFromEmail,
          limit: data.limit,
          domains: data.domains ?? [],
        });
        setDomainInput("");
      } else {
        setError(data?.error ?? "Could not connect the domain.");
      }
    } catch {
      setError("Could not reach the server.");
    } finally {
      setBusy(null);
    }
  }

  // A "check" is just a reload: GET /api/domains re-reads SES for every
  // connected domain and syncs the stored verdict, so there is nothing
  // separate to poke.
  async function recheck(domain: string) {
    setBusy(`check-${domain}`);
    await load();
    setBusy(null);
  }

  async function disconnect(domain: string) {
    const confirmed = await confirmDialog({
      title: `Disconnect ${domain}?`,
      description:
        "Campaigns can no longer send from it until it is reconnected. Drafts that were set to send from this domain will need a new From address.",
      confirmLabel: "Disconnect",
      destructive: true,
    });
    if (!confirmed) return;

    setBusy(`remove-${domain}`);
    setError(null);
    try {
      const response = await fetch(`/api/domains?domain=${encodeURIComponent(domain)}`, {
        method: "DELETE",
      });
      const data = await response.json().catch(() => null);
      if (data?.ok) {
        setState({
          sharedFromEmail: data.sharedFromEmail,
          limit: data.limit,
          domains: data.domains ?? [],
        });
      } else {
        setError(data?.error ?? "Could not disconnect the domain.");
      }
    } catch {
      setError("Could not reach the server.");
    } finally {
      setBusy(null);
    }
  }

  async function copy(key: string, text: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(key);
      setTimeout(() => setCopied((current) => (current === key ? null : current)), 1500);
    } catch {
      // Clipboard is blocked in insecure contexts. The value is on screen and
      // selectable, so there is nothing to recover.
    }
  }

  if (!state && !error) {
    return (
      <div className="flex items-center gap-2 py-10 text-sm text-muted-foreground">
        <Spinner className="size-4" />
        Loading domains…
      </div>
    );
  }

  const domains = state?.domains ?? [];
  const atLimit = state !== null && domains.length >= state.limit;

  return (
    <div className="flex max-w-lg flex-col gap-8">
      <div className="flex flex-col gap-4">
        <div>
          <h3 className="text-sm font-semibold">Sending domains</h3>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Send from a domain you own instead of the shared address. You add a
            few DNS records; Amazon verifies them and we pick that up
            automatically.
          </p>
        </div>

        {error && (
          <Alert variant="destructive">
            <AlertDescription className="text-xs">{error}</AlertDescription>
          </Alert>
        )}

        {canManage && (
          <div className="flex flex-col gap-1.5">
            <Label className="text-sm font-medium">Add a domain</Label>
            <div className="flex gap-2">
              <Input
                value={domainInput}
                onChange={(event) => setDomainInput(event.target.value)}
                placeholder="example.com"
                disabled={atLimit}
                className="h-8 text-sm"
                onKeyDown={(event) => {
                  if (event.key === "Enter" && domainInput.trim()) void connect();
                }}
              />
              <Button
                size="sm"
                className="shrink-0"
                disabled={busy !== null || !domainInput.trim() || atLimit}
                onClick={() => void connect()}
              >
                {busy === "connect" ? (
                  <Spinner data-icon="inline-start" />
                ) : (
                  <PlusIcon data-icon="inline-start" />
                )}
                Connect
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              {atLimit
                ? `Your plan allows ${state?.limit} domains — disconnect one to add another.`
                : `The bare domain, no https://. Your plan allows ${state?.limit ?? 0}.`}
            </p>
          </div>
        )}

        {!canManage && (
          <p className="text-xs text-muted-foreground">
            Only owners and admins can connect or disconnect domains.
          </p>
        )}
      </div>

      <Separator />

      <div className="flex flex-col gap-3">
        <h3 className="text-sm font-semibold">
          Connected {domains.length > 0 && <span className="text-muted-foreground">({domains.length})</span>}
        </h3>

        {domains.length === 0 ? (
          <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed border-border py-10 text-center">
            <GlobeIcon className="size-5 text-muted-foreground" />
            <div>
              <p className="text-xs text-muted-foreground">No domains connected.</p>
              <p className="mt-1 text-[11px] text-muted-foreground">
                Campaigns send from{" "}
                <span className="font-mono">{state?.sharedFromEmail}</span> until you
                add one.
              </p>
            </div>
          </div>
        ) : (
          domains.map((entry) => (
            <DomainRow
              key={entry.domain}
              entry={entry}
              canManage={canManage}
              busy={busy}
              copied={copied}
              onRecheck={() => void recheck(entry.domain)}
              onDisconnect={() => void disconnect(entry.domain)}
              onCopy={copy}
            />
          ))
        )}
      </div>
    </div>
  );
}

function DomainRow({
  entry,
  canManage,
  busy,
  copied,
  onRecheck,
  onDisconnect,
  onCopy,
}: {
  entry: ConnectedDomain;
  canManage: boolean;
  busy: string | null;
  copied: string | null;
  onRecheck: () => void;
  onDisconnect: () => void;
  onCopy: (key: string, text: string) => Promise<void>;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="rounded-lg border border-border">
      <div className="flex items-start justify-between gap-3 p-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <p className="truncate text-xs font-medium">{entry.domain}</p>
            {entry.readyToSend ? (
              <Badge>Verified</Badge>
            ) : (
              <Badge variant="outline">Pending</Badge>
            )}
          </div>
          <p className="mt-1 text-[11px] text-muted-foreground">
            {entry.readyToSend
              ? "Campaigns can send from any address on this domain."
              : "Add the DNS records below, then re-check. Amazon can take up to 72 hours."}
          </p>
          <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
            <span>
              DKIM <StatusText value={entry.dkimStatus} />
            </span>
            <span>
              MAIL FROM <StatusText value={entry.mailFromStatus} />
            </span>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-1">
          <Button
            variant="ghost"
            size="xs"
            disabled={busy !== null}
            onClick={onRecheck}
            title="Re-check verification"
          >
            {busy === `check-${entry.domain}` ? (
              <Spinner className="size-3.5" />
            ) : (
              <RefreshCwIcon className="size-3.5" />
            )}
          </Button>
          {canManage && (
            <Button
              variant="ghost"
              size="xs"
              className="text-muted-foreground hover:text-destructive"
              disabled={busy !== null}
              onClick={onDisconnect}
            >
              {busy === `remove-${entry.domain}` ? "Removing…" : "Disconnect"}
            </Button>
          )}
        </div>
      </div>

      {entry.records.length > 0 && (
        <Collapsible open={open} onOpenChange={setOpen}>
          <div className="border-t border-border">
            <CollapsibleTrigger asChild>
              <button className="flex w-full items-center justify-between px-3 py-2 text-[11px] text-muted-foreground transition-colors hover:text-foreground">
                <span>
                  {entry.records.length} DNS record
                  {entry.records.length === 1 ? "" : "s"}
                </span>
                <ChevronDownIcon
                  className={`size-3.5 transition-transform ${open ? "rotate-180" : ""}`}
                />
              </button>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <div className="flex flex-col gap-2 border-t border-border p-3">
                <p className="text-[11px] text-muted-foreground">
                  TTL auto. If your provider is Cloudflare, set these to{" "}
                  <span className="font-medium text-foreground">DNS only</span> —
                  a proxied record breaks verification.
                </p>
                {entry.records.map((record, index) => {
                  const key = `${entry.domain}-${index}`;
                  return (
                    <div
                      key={key}
                      className="flex items-start justify-between gap-2 rounded-md bg-muted/40 p-2"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="text-[11px] font-medium">
                          {record.type} · {record.purpose}
                        </p>
                        <p className="mt-0.5 truncate font-mono text-[11px] text-muted-foreground">
                          {record.host}
                        </p>
                        <p className="truncate font-mono text-[11px] text-muted-foreground">
                          {record.value}
                          {record.priority !== undefined && ` (priority ${record.priority})`}
                        </p>
                      </div>
                      <Button
                        variant="ghost"
                        size="xs"
                        className="shrink-0"
                        onClick={() => void onCopy(key, record.value)}
                        title="Copy value"
                      >
                        {copied === key ? (
                          <CheckIcon className="size-3.5" />
                        ) : (
                          <CopyIcon className="size-3.5" />
                        )}
                      </Button>
                    </div>
                  );
                })}
              </div>
            </CollapsibleContent>
          </div>
        </Collapsible>
      )}
    </div>
  );
}

/** SES returns SUCCESS / PENDING / FAILED / TEMPORARY_FAILURE / NOT_STARTED. */
function StatusText({ value }: { value: string | undefined }) {
  if (value === "SUCCESS") {
    return <span className="font-medium text-foreground">ok</span>;
  }
  if (value === "FAILED" || value === "TEMPORARY_FAILURE") {
    return <span className="font-medium text-destructive">failed</span>;
  }
  return <span className="font-medium text-foreground">pending</span>;
}
