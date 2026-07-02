"use client";

import { useCallback, useEffect, useState } from "react";
import {
  CheckCircle2Icon,
  CopyIcon,
  GlobeIcon,
  Loader2Icon,
  MailIcon,
  RefreshCwIcon,
  ShieldCheckIcon,
  Trash2Icon,
} from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
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

type DomainState = {
  domain: string | null;
  dkimStatus?: string;
  mailFromStatus?: string;
  readyToSend?: boolean;
  records?: DnsRecord[];
  fromEmail: string;
};

function statusBadge(sesStatus: string | undefined) {
  if (sesStatus === "SUCCESS") return <Badge>Verified</Badge>;
  if (sesStatus === "FAILED" || sesStatus === "TEMPORARY_FAILURE")
    return <Badge variant="destructive">Failed</Badge>;
  return <Badge variant="outline">Pending</Badge>;
}

export default function DomainsPage() {
  const [state, setState] = useState<DomainState | null>(null);
  const [domainInput, setDomainInput] = useState("");
  const [busy, setBusy] = useState<"connect" | "check" | "remove" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const response = await fetch("/api/domains");
      const data = await response.json();
      if (data.ok) setState(data);
      else setError(data.error ?? "Could not load domain status.");
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
      const data = await response.json();
      if (data.ok) {
        setState(data);
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

  async function check() {
    setBusy("check");
    setError(null);
    await load();
    setBusy(null);
  }

  async function remove() {
    const ok = window.confirm(
      "Disconnect this domain? Campaigns will go back to sending from the shared LetterStack address.",
    );
    if (!ok) return;
    setBusy("remove");
    setError(null);
    try {
      const response = await fetch("/api/domains", { method: "DELETE" });
      const data = await response.json();
      if (data.ok) setState(data);
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

  function copyAllRecords() {
    if (!state?.records) return;
    const text = state.records
      .map((r) =>
        [
          r.purpose,
          `Type:     ${r.type}`,
          `Host:     ${r.host}`,
          `Value:    ${r.value}`,
          ...(r.priority !== undefined ? [`Priority: ${r.priority}`] : []),
          "TTL:      Auto / default",
        ].join("\n"),
      )
      .join("\n\n");
    void copyText("all", text);
  }

  const hasDomain = Boolean(state?.domain);
  const loading = state === null && !error;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-normal">Domains</h1>
        <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
          Connect a domain you own to send branded campaign email. You add a few
          DNS records at your provider; Amazon verifies them automatically.
        </p>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertTitle>Something went wrong</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_24rem]">
        <Card>
          <CardHeader className="flex flex-row items-start gap-4">
            <span className="flex size-12 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <GlobeIcon className="size-5" />
            </span>
            <div>
              <CardTitle>
                {hasDomain ? state?.domain : "Add domain"}
              </CardTitle>
              <CardDescription>
                {hasDomain
                  ? "Add the DNS records below at your domain provider, then check verification."
                  : "Use a domain you own to send branded campaign email."}
              </CardDescription>
            </div>
          </CardHeader>

          <CardContent className="flex flex-col gap-6">
            {loading && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2Icon className="size-4 animate-spin" />
                Loading domain status…
              </div>
            )}

            {!loading && !hasDomain && (
              <FieldGroup>
                <Field>
                  <FieldLabel htmlFor="domain-name">Domain name</FieldLabel>
                  <Input
                    id="domain-name"
                    value={domainInput}
                    onChange={(event) => setDomainInput(event.target.value)}
                    placeholder="example.com"
                    onKeyDown={(event) => {
                      if (event.key === "Enter" && domainInput.trim()) void connect();
                    }}
                  />
                  <FieldDescription>
                    The bare domain (no https://). Campaigns will send as
                    newsletter@your-domain once it verifies.
                  </FieldDescription>
                </Field>
              </FieldGroup>
            )}

            {hasDomain && (
              <>
                <div className="grid gap-3 sm:grid-cols-3">
                  <div className="rounded-xl border border-border bg-muted/30 p-3">
                    <div className="text-xs text-muted-foreground">DKIM</div>
                    <div className="mt-1">{statusBadge(state?.dkimStatus)}</div>
                  </div>
                  <div className="rounded-xl border border-border bg-muted/30 p-3">
                    <div className="text-xs text-muted-foreground">MAIL FROM</div>
                    <div className="mt-1">{statusBadge(state?.mailFromStatus)}</div>
                  </div>
                  <div className="rounded-xl border border-border bg-muted/30 p-3">
                    <div className="text-xs text-muted-foreground">Ready to send</div>
                    <div className="mt-1">
                      {state?.readyToSend ? (
                        <Badge>Yes</Badge>
                      ) : (
                        <Badge variant="outline">Not yet</Badge>
                      )}
                    </div>
                  </div>
                </div>

                {state?.readyToSend && (
                  <Alert>
                    <CheckCircle2Icon />
                    <AlertTitle>Domain verified</AlertTitle>
                    <AlertDescription>
                      New campaigns now send from {state.fromEmail}.
                    </AlertDescription>
                  </Alert>
                )}

                <div>
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <div>
                      <h2 className="text-sm font-medium">DNS records</h2>
                      <p className="text-sm text-muted-foreground">
                        Add these at your DNS provider (GoDaddy, Cloudflare,
                        Namecheap, …). Nothing existing needs to change. Every
                        value is a hostname or text — never an IP address. Leave
                        TTL on Auto/default. On Cloudflare, set each record to
                        “DNS only” (grey cloud), not Proxied.
                      </p>
                    </div>
                  </div>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Type</TableHead>
                        <TableHead>Host</TableHead>
                        <TableHead>Value</TableHead>
                        <TableHead>Priority</TableHead>
                        <TableHead className="text-right">Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {(state?.records ?? []).map((record) => {
                        const key = `${record.type}-${record.host}`;
                        const group =
                          record.group === "dkim"
                            ? state?.dkimStatus
                            : state?.mailFromStatus;
                        return (
                          <TableRow key={key}>
                            <TableCell>{record.type}</TableCell>
                            <TableCell className="max-w-[220px] truncate font-medium">
                              <button
                                type="button"
                                className="inline-flex max-w-full items-center gap-1.5 truncate hover:text-primary"
                                onClick={() => void copyText(`${key}-host`, record.host)}
                                title="Copy host"
                              >
                                <span className="truncate">{record.host}</span>
                                <CopyIcon className="size-3 shrink-0" />
                              </button>
                              {copied === `${key}-host` && (
                                <span className="ml-1 text-xs text-primary">Copied</span>
                              )}
                            </TableCell>
                            <TableCell className="max-w-[260px] truncate text-muted-foreground">
                              <button
                                type="button"
                                className="inline-flex max-w-full items-center gap-1.5 truncate hover:text-primary"
                                onClick={() => void copyText(`${key}-value`, record.value)}
                                title="Copy value"
                              >
                                <span className="truncate">{record.value}</span>
                                <CopyIcon className="size-3 shrink-0" />
                              </button>
                              {copied === `${key}-value` && (
                                <span className="ml-1 text-xs text-primary">Copied</span>
                              )}
                            </TableCell>
                            <TableCell className="text-muted-foreground">
                              {record.priority ?? "—"}
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

                <div className="rounded-xl border border-border bg-muted/30 p-4">
                  <div className="flex items-center gap-3">
                    <span className="flex size-9 items-center justify-center rounded-lg bg-background text-muted-foreground">
                      <ShieldCheckIcon className="size-4" />
                    </span>
                    <div>
                      <div className="text-sm font-medium">
                        DNS can take a little while
                      </div>
                      <p className="text-sm text-muted-foreground">
                        Records usually verify within minutes, sometimes hours.
                        Amazon re-checks automatically — come back and hit
                        “Check verification”.
                      </p>
                    </div>
                  </div>
                </div>
              </>
            )}
          </CardContent>

          <CardFooter className="justify-between gap-3">
            {hasDomain ? (
              <>
                <div className="flex gap-2">
                  <Button variant="outline" onClick={copyAllRecords}>
                    <CopyIcon data-icon="inline-start" />
                    {copied === "all" ? "Copied!" : "Copy records"}
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => void remove()}
                    disabled={busy !== null}
                  >
                    <Trash2Icon data-icon="inline-start" />
                    Disconnect
                  </Button>
                </div>
                <Button onClick={() => void check()} disabled={busy !== null}>
                  {busy === "check" ? (
                    <Loader2Icon data-icon="inline-start" className="animate-spin" />
                  ) : (
                    <RefreshCwIcon data-icon="inline-start" />
                  )}
                  Check verification
                </Button>
              </>
            ) : (
              <Button
                className="ml-auto"
                onClick={() => void connect()}
                disabled={busy !== null || !domainInput.trim() || loading}
              >
                {busy === "connect" ? (
                  <Loader2Icon data-icon="inline-start" className="animate-spin" />
                ) : null}
                Connect domain
              </Button>
            )}
          </CardFooter>
        </Card>

        <div className="flex flex-col gap-4">
          <Card>
            <CardHeader>
              <CardTitle>Current sender</CardTitle>
              <CardDescription>
                The From address new campaigns are created with.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <div className="rounded-xl border border-border bg-muted/30 p-4">
                <div className="text-xs text-muted-foreground">From address</div>
                <div className="mt-1 truncate text-sm font-medium">
                  {loading ? "…" : state?.fromEmail || "Not configured"}
                </div>
              </div>
              <div className="flex items-center justify-between gap-3 text-sm">
                <span className="text-muted-foreground">Source</span>
                <Badge variant="outline">
                  {state?.readyToSend ? "Your domain" : "Shared LetterStack domain"}
                </Badge>
              </div>
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
