"use client";

import { useCallback, useEffect, useState } from "react";
import {
  CheckCircle2Icon,
  CopyIcon,
  GlobeIcon,
  Loader2Icon,
  MailIcon,
  PlusIcon,
  RefreshCwIcon,
  ShieldCheckIcon,
  Trash2Icon,
} from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { confirmDialog } from "@/components/app-dialogs";
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
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

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

function statusBadge(sesStatus: string | undefined) {
  if (sesStatus === "SUCCESS") return <Badge>Verified</Badge>;
  if (sesStatus === "FAILED" || sesStatus === "TEMPORARY_FAILURE")
    return <Badge variant="destructive">Failed</Badge>;
  return <Badge variant="outline">Pending</Badge>;
}

export default function DomainsPage() {
  const [state, setState] = useState<DomainsState | null>(null);
  const [domainInput, setDomainInput] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  const applyResponse = useCallback((data: DomainsState & { ok: boolean }) => {
    setState({
      sharedFromEmail: data.sharedFromEmail,
      limit: data.limit,
      domains: data.domains ?? [],
    });
  }, []);

  const load = useCallback(async () => {
    try {
      const response = await fetch("/api/domains");
      const data = await response.json();
      if (data.ok) applyResponse(data);
      else setError(data.error ?? "Could not load domain status.");
    } catch {
      setError("Could not reach the server.");
    }
  }, [applyResponse]);

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
      const data = await response.json();
      if (data.ok) {
        applyResponse(data);
        setDomainInput("");
      } else {
        setError(data.error ?? "Could not connect the domain.");
      }
    } catch {
      setError("Could not reach the server.");
    } finally {
      setBusy(null);
    }
  }

  async function check(domain: string) {
    setBusy(`check-${domain}`);
    setError(null);
    await load();
    setBusy(null);
  }

  async function remove(domain: string) {
    const ok = await confirmDialog({
      title: `Disconnect ${domain}?`,
      description:
        "Campaigns can no longer send from it until it is reconnected.",
      confirmLabel: "Disconnect",
      destructive: true,
    });
    if (!ok) return;
    setBusy(`remove-${domain}`);
    setError(null);
    try {
      const response = await fetch(
        `/api/domains?domain=${encodeURIComponent(domain)}`,
        { method: "DELETE" },
      );
      const data = await response.json();
      if (data.ok) applyResponse(data);
      else setError(data.error ?? "Could not disconnect the domain.");
    } catch {
      setError("Could not reach the server.");
    } finally {
      setBusy(null);
    }
  }

  async function copyText(key: string, text: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(key);
      setTimeout(() => setCopied((current) => (current === key ? null : current)), 1500);
    } catch {
      // Clipboard unavailable — nothing sensible to do.
    }
  }

  function copyAllRecords(entry: ConnectedDomain) {
    const text = entry.records
      .map((r) =>
        [
          r.purpose,
          `Type:     ${r.type}`,
          `Host:     ${r.host}`,
          `Value:    ${r.value}`,
          ...(r.priority !== undefined ? [`Priority: ${r.priority}`] : []),
          "TTL:      Auto / default",
          "Proxy:    DNS only (grey cloud) — never Proxied",
        ].join("\n"),
      )
      .join("\n\n");
    void copyText(`all-${entry.domain}`, text);
  }

  const loading = state === null && !error;
  const domains = state?.domains ?? [];
  const atLimit = state !== null && domains.length >= state.limit;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-normal">Domains</h1>
        <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
          Connect domains you own to send branded campaign email. You add a few
          DNS records at your provider; Amazon verifies them automatically.
          {state ? ` Up to ${state.limit} domains.` : ""}
        </p>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertTitle>Something went wrong</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_24rem]">
        <div className="flex min-w-0 flex-col gap-4">
          {/* Add domain */}
          <Card>
            <CardHeader className="flex flex-row items-start gap-4">
              <span className="flex size-12 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <GlobeIcon className="size-5" />
              </span>
              <div>
                <CardTitle>Add domain</CardTitle>
                <CardDescription>
                  {atLimit
                    ? `You've connected ${state?.limit} domains — disconnect one to add another.`
                    : "Use a domain you own to send branded campaign email."}
                </CardDescription>
              </div>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2Icon className="size-4 animate-spin" />
                  Loading domains…
                </div>
              ) : (
                <FieldGroup>
                  <Field>
                    <FieldLabel htmlFor="domain-name">Domain name</FieldLabel>
                    <div className="flex gap-2">
                      <Input
                        id="domain-name"
                        value={domainInput}
                        onChange={(event) => setDomainInput(event.target.value)}
                        placeholder="example.com"
                        disabled={atLimit}
                        onKeyDown={(event) => {
                          if (event.key === "Enter" && domainInput.trim())
                            void connect();
                        }}
                      />
                      <Button
                        onClick={() => void connect()}
                        disabled={busy !== null || !domainInput.trim() || atLimit}
                      >
                        {busy === "connect" ? (
                          <Loader2Icon
                            data-icon="inline-start"
                            className="animate-spin"
                          />
                        ) : (
                          <PlusIcon data-icon="inline-start" />
                        )}
                        Connect
                      </Button>
                    </div>
                    <FieldDescription>
                      The bare domain (no https://). Campaigns can send from any
                      address on it once it verifies.
                    </FieldDescription>
                  </Field>
                </FieldGroup>
              )}
            </CardContent>
          </Card>

          {/* Connected domains */}
          {domains.map((entry) => (
            <Card key={entry.domain}>
              <CardHeader className="flex flex-row items-start justify-between gap-4">
                <div>
                  <CardTitle>{entry.domain}</CardTitle>
                  <CardDescription>
                    {entry.readyToSend
                      ? "Verified — campaigns can send from this domain."
                      : "Add the DNS records below at your domain provider, then check verification."}
                  </CardDescription>
                </div>
                {entry.readyToSend ? (
                  <Badge>Verified</Badge>
                ) : (
                  <Badge variant="outline">Pending</Badge>
                )}
              </CardHeader>

              <CardContent className="flex flex-col gap-6">
                <div className="grid gap-3 sm:grid-cols-3">
                  <div className="rounded-xl border border-border bg-muted/30 p-3">
                    <div className="text-xs text-muted-foreground">DKIM</div>
                    <div className="mt-1">{statusBadge(entry.dkimStatus)}</div>
                  </div>
                  <div className="rounded-xl border border-border bg-muted/30 p-3">
                    <div className="text-xs text-muted-foreground">MAIL FROM</div>
                    <div className="mt-1">{statusBadge(entry.mailFromStatus)}</div>
                  </div>
                  <div className="rounded-xl border border-border bg-muted/30 p-3">
                    <div className="text-xs text-muted-foreground">
                      Ready to send
                    </div>
                    <div className="mt-1">
                      {entry.readyToSend ? (
                        <Badge>Yes</Badge>
                      ) : (
                        <Badge variant="outline">Not yet</Badge>
                      )}
                    </div>
                  </div>
                </div>

                {entry.readyToSend ? (
                  <Alert>
                    <CheckCircle2Icon />
                    <AlertTitle>Domain verified</AlertTitle>
                    <AlertDescription>
                      Pick any address on {entry.domain} when creating a
                      campaign.
                    </AlertDescription>
                  </Alert>
                ) : (
                  <div>
                    <div className="mb-3">
                      <h2 className="text-sm font-medium">DNS records</h2>
                      <p className="text-sm text-muted-foreground">
                        Add these at your DNS provider (GoDaddy, Cloudflare,
                        Namecheap, …). Nothing existing needs to change. Every
                        value is a hostname or text — never an IP address. Leave
                        TTL on Auto/default. On Cloudflare, set each record to
                        “DNS only” (grey cloud), not Proxied.
                      </p>
                    </div>
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Type</TableHead>
                            <TableHead>Host</TableHead>
                            <TableHead>Value</TableHead>
                            <TableHead>Priority</TableHead>
                            <TableHead>TTL</TableHead>
                            <TableHead>Proxy</TableHead>
                            <TableHead className="text-right">Status</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {entry.records.map((record) => {
                            const key = `${entry.domain}-${record.type}-${record.host}`;
                            const group =
                              record.group === "dkim"
                                ? entry.dkimStatus
                                : entry.mailFromStatus;
                            return (
                              <TableRow key={key}>
                                <TableCell>{record.type}</TableCell>
                                <TableCell className="max-w-[220px] truncate font-medium">
                                  <button
                                    type="button"
                                    className="inline-flex max-w-full items-center gap-1.5 truncate hover:text-primary"
                                    onClick={() =>
                                      void copyText(`${key}-host`, record.host)
                                    }
                                    title="Copy host"
                                  >
                                    <span className="truncate">{record.host}</span>
                                    <CopyIcon className="size-3 shrink-0" />
                                  </button>
                                  {copied === `${key}-host` && (
                                    <span className="ml-1 text-xs text-primary">
                                      Copied
                                    </span>
                                  )}
                                </TableCell>
                                <TableCell className="max-w-[260px] truncate text-muted-foreground">
                                  <button
                                    type="button"
                                    className="inline-flex max-w-full items-center gap-1.5 truncate hover:text-primary"
                                    onClick={() =>
                                      void copyText(`${key}-value`, record.value)
                                    }
                                    title="Copy value"
                                  >
                                    <span className="truncate">{record.value}</span>
                                    <CopyIcon className="size-3 shrink-0" />
                                  </button>
                                  {copied === `${key}-value` && (
                                    <span className="ml-1 text-xs text-primary">
                                      Copied
                                    </span>
                                  )}
                                </TableCell>
                                <TableCell className="text-muted-foreground">
                                  {record.priority ?? "—"}
                                </TableCell>
                                <TableCell className="whitespace-nowrap text-muted-foreground">
                                  Auto
                                </TableCell>
                                <TableCell className="whitespace-nowrap text-muted-foreground">
                                  DNS only
                                </TableCell>
                                <TableCell className="text-right">
                                  {statusBadge(group)}
                                </TableCell>
                              </TableRow>
                            );
                          })}
                        </TableBody>
                      </Table>
                    </div>

                    <div className="mt-4 rounded-xl border border-border bg-muted/30 p-4">
                      <div className="flex items-center gap-3">
                        <span className="flex size-9 items-center justify-center rounded-lg bg-background text-muted-foreground">
                          <ShieldCheckIcon className="size-4" />
                        </span>
                        <div>
                          <div className="text-sm font-medium">
                            DNS can take a little while
                          </div>
                          <p className="text-sm text-muted-foreground">
                            Records usually verify within minutes, sometimes
                            hours. Amazon re-checks automatically — come back
                            and hit “Check verification”.
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </CardContent>

              <CardFooter className="justify-between gap-3">
                <div className="flex gap-2">
                  {!entry.readyToSend && (
                    <Button
                      variant="outline"
                      onClick={() => copyAllRecords(entry)}
                    >
                      <CopyIcon data-icon="inline-start" />
                      {copied === `all-${entry.domain}` ? "Copied!" : "Copy records"}
                    </Button>
                  )}
                  <Button
                    variant="outline"
                    onClick={() => void remove(entry.domain)}
                    disabled={busy !== null}
                  >
                    <Trash2Icon data-icon="inline-start" />
                    Disconnect
                  </Button>
                </div>
                <Button
                  onClick={() => void check(entry.domain)}
                  disabled={busy !== null}
                >
                  {busy === `check-${entry.domain}` ? (
                    <Loader2Icon
                      data-icon="inline-start"
                      className="animate-spin"
                    />
                  ) : (
                    <RefreshCwIcon data-icon="inline-start" />
                  )}
                  Check verification
                </Button>
              </CardFooter>
            </Card>
          ))}
        </div>

        <div className="flex flex-col gap-4">
          <Card>
            <CardHeader>
              <CardTitle>Sending addresses</CardTitle>
              <CardDescription>
                Where campaigns can send from right now.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              <div className="rounded-xl border border-border bg-muted/30 p-4">
                <div className="text-xs text-muted-foreground">
                  Shared address
                </div>
                <div className="mt-1 truncate text-sm font-medium">
                  {loading ? "…" : state?.sharedFromEmail || "Not configured"}
                </div>
              </div>
              {domains
                .filter((entry) => entry.readyToSend)
                .map((entry) => (
                  <div
                    key={entry.domain}
                    className="rounded-xl border border-border bg-muted/30 p-4"
                  >
                    <div className="text-xs text-muted-foreground">
                      Your domain
                    </div>
                    <div className="mt-1 truncate text-sm font-medium">
                      anything@{entry.domain}
                    </div>
                  </div>
                ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-start gap-4">
              <span className="flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <MailIcon className="size-5" />
              </span>
              <div>
                <CardTitle>Gmail integration</CardTitle>
                <CardDescription>
                  Let users connect a Gmail account with one click later.
                </CardDescription>
              </div>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <Alert>
                <MailIcon />
                <AlertTitle>Visual placeholder</AlertTitle>
                <AlertDescription>
                  Google OAuth, Gmail API permissions, token storage, and send
                  limits still need backend work before this can send.
                </AlertDescription>
              </Alert>
              <Separator />
              <div className="flex items-center justify-between gap-3 text-sm">
                <span className="text-muted-foreground">Status</span>
                <Badge variant="outline">Not connected</Badge>
              </div>
            </CardContent>
            <CardFooter>
              <Button variant="outline" className="w-full" disabled>
                <MailIcon data-icon="inline-start" />
                Connect Gmail
              </Button>
            </CardFooter>
          </Card>
        </div>
      </div>
    </div>
  );
}
