"use client";

import { useEffect, useMemo, useState } from "react";
import {
  ArrowRightIcon,
  CheckCircle2Icon,
  CopyIcon,
  GlobeIcon,
  MailIcon,
  PlusIcon,
  ShieldCheckIcon,
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

type SendingIdentity = {
  slug: string | null;
  baseDomain: string;
  address: string;
};

const dnsRecords = [
  {
    type: "TXT",
    host: "letterstack._domainkey",
    value: "dkim.letterstack.example",
    status: "Pending",
  },
  {
    type: "TXT",
    host: "@",
    value: "v=spf1 include:amazonses.com ~all",
    status: "Pending",
  },
  {
    type: "TXT",
    host: "_dmarc",
    value: "v=DMARC1; p=none; rua=mailto:dmarc@example.com",
    status: "Optional",
  },
];

export default function DomainsPage() {
  const [identity, setIdentity] = useState<SendingIdentity | null>(null);
  const [domain, setDomain] = useState("");
  const [slug, setSlug] = useState("");
  const [savingSlug, setSavingSlug] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    fetch("/api/account/sending")
      .then((response) => response.json())
      .then((data) => {
        if (!active || !data.ok) return;
        setIdentity({
          slug: data.slug,
          baseDomain: data.baseDomain,
          address: data.address,
        });
        setSlug(data.slug ?? "");
      })
      .catch(() => {});

    return () => {
      active = false;
    };
  }, []);

  const previewAddress = useMemo(() => {
    const base = identity?.baseDomain ?? "letterstack.site";
    return `newsletter@${slug || "your-brand"}.${base}`;
  }, [identity?.baseDomain, slug]);

  async function saveSlug() {
    setSavingSlug(true);
    setMessage(null);

    try {
      const response = await fetch("/api/account/sending", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug }),
      });
      const data = await response.json();

      if (!data.ok) {
        setMessage(data.error || "Could not save sender identity.");
        return;
      }

      setIdentity({
        slug: data.slug,
        baseDomain: data.baseDomain,
        address: data.address,
      });
      setMessage(`Sender identity saved: ${data.address}`);
    } catch {
      setMessage("Could not reach the server.");
    } finally {
      setSavingSlug(false);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col justify-between gap-3 md:flex-row md:items-end">
        <div>
          <h1 className="text-2xl font-semibold tracking-normal">Domains</h1>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            Connect owned domains for branded sending, or connect Gmail for a
            lighter one-click sender flow.
          </p>
        </div>
        <Button>
          <PlusIcon data-icon="inline-start" />
          Add domain
        </Button>
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_24rem]">
        <Card>
          <CardHeader className="flex flex-row items-start gap-4">
            <span className="flex size-12 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <GlobeIcon className="size-5" />
            </span>
            <div>
              <CardTitle>Add domain</CardTitle>
              <CardDescription>
                Use a domain you own to send branded campaign email.
              </CardDescription>
            </div>
          </CardHeader>
          <CardContent className="flex flex-col gap-6">
            <FieldGroup>
              <Field>
                <FieldLabel htmlFor="domain-name">Domain name</FieldLabel>
                <Input
                  id="domain-name"
                  value={domain}
                  onChange={(event) => setDomain(event.target.value)}
                  placeholder="updates.example.com"
                />
                <FieldDescription>
                  Region is intentionally hidden for now. LetterStack can choose
                  the safest sending region behind the scenes later.
                </FieldDescription>
              </Field>
            </FieldGroup>

            <div className="rounded-xl border border-border bg-muted/30 p-4">
              <div className="flex items-center gap-3">
                <span className="flex size-9 items-center justify-center rounded-lg bg-background text-muted-foreground">
                  <ShieldCheckIcon className="size-4" />
                </span>
                <div>
                  <div className="text-sm font-medium">Verification process</div>
                  <p className="text-sm text-muted-foreground">
                    Add DNS records, verify ownership, then send from this
                    domain once SES/domain verification is wired.
                  </p>
                </div>
              </div>
            </div>

            <div>
              <div className="mb-3 flex items-center justify-between gap-3">
                <div>
                  <h2 className="text-sm font-medium">DNS records</h2>
                  <p className="text-sm text-muted-foreground">
                    These are placeholder records for the future verifier.
                  </p>
                </div>
                <Badge variant="outline">Preview</Badge>
              </div>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Type</TableHead>
                    <TableHead>Host</TableHead>
                    <TableHead>Value</TableHead>
                    <TableHead className="text-right">Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {dnsRecords.map((record) => (
                    <TableRow key={`${record.type}-${record.host}`}>
                      <TableCell>{record.type}</TableCell>
                      <TableCell className="font-medium">{record.host}</TableCell>
                      <TableCell className="max-w-[260px] truncate text-muted-foreground">
                        {record.value}
                      </TableCell>
                      <TableCell className="text-right">
                        <Badge variant="outline">{record.status}</Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
          <CardFooter className="justify-between gap-3">
            <Button variant="outline">
              <CopyIcon data-icon="inline-start" />
              Copy records
            </Button>
            <Button disabled={!domain.trim()}>
              Verify domain
              <ArrowRightIcon data-icon="inline-end" />
            </Button>
          </CardFooter>
        </Card>

        <div className="flex flex-col gap-4">
          <Card>
            <CardHeader>
              <CardTitle>Current sender</CardTitle>
              <CardDescription>
                This remote-backed sender slug works with the shared verified
                LetterStack domain.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <FieldGroup>
                <Field>
                  <FieldLabel htmlFor="sender-slug">Sender subdomain</FieldLabel>
                  <Input
                    id="sender-slug"
                    value={slug}
                    onChange={(event) =>
                      setSlug(
                        event.target.value
                          .toLowerCase()
                          .replace(/[^a-z0-9-]/g, ""),
                      )
                    }
                    placeholder="your-brand"
                  />
                  <FieldDescription>{previewAddress}</FieldDescription>
                </Field>
              </FieldGroup>
              {message && (
                <Alert>
                  <CheckCircle2Icon />
                  <AlertTitle>Sender identity</AlertTitle>
                  <AlertDescription>{message}</AlertDescription>
                </Alert>
              )}
            </CardContent>
            <CardFooter>
              <Button onClick={saveSlug} disabled={savingSlug || !slug.trim()}>
                {savingSlug ? "Saving..." : "Save sender"}
              </Button>
            </CardFooter>
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
              <Button variant="outline" className="w-full">
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
