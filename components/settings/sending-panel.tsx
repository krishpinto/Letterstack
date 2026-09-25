"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2Icon, GlobeIcon, MailIcon, ShieldAlertIcon } from "lucide-react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { SaveBar } from "@/components/settings/save-bar";

/**
 * Settings → Sending.
 *
 * Two halves. The top half is editable: the From name and reply-to a new
 * campaign starts with. The bottom half is a read-only inventory of the
 * addresses this workspace is actually allowed to send from, because "which
 * From addresses can I use" is the question this page gets opened for and the
 * answer previously lived only in a dropdown inside the campaign editor.
 *
 * One thing deliberately absent: the branded sending subdomain
 * (newsletter@<slug>.letterstack.site). lib/send/sender-identity.ts and
 * /api/account/sending still implement it, but mail from a subdomain fails
 * DMARC alignment against the parent domain's policy and Gmail drops it
 * outright. Offering it here would be offering a way to make sends silently
 * disappear. It needs per-subdomain DKIM plus an SPF record before it is a
 * feature again, and until then the honest surface is no surface.
 */

export type SendingMailbox = {
  id: string;
  email: string;
  displayName: string | null;
  status: string;
};

export type SendingDefaults = {
  defaultFromName: string | null;
  defaultReplyTo: string | null;
};

export function SendingPanel({
  organizationId,
  organizationName,
  initialDefaults,
  sharedFromEmail,
  verifiedDomains,
  unverifiedDomains,
  mailboxes,
  canManage,
  onNavigate,
}: {
  organizationId: string;
  organizationName: string;
  initialDefaults: SendingDefaults;
  sharedFromEmail: string;
  verifiedDomains: string[];
  unverifiedDomains: string[];
  mailboxes: SendingMailbox[];
  canManage: boolean;
  onNavigate: (section: string) => void;
}) {
  const router = useRouter();
  const [saved, setSaved] = useState(initialDefaults);
  const [fromName, setFromName] = useState(initialDefaults.defaultFromName ?? "");
  const [replyTo, setReplyTo] = useState(initialDefaults.defaultReplyTo ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const dirty = useMemo(
    () =>
      fromName.trim() !== (saved.defaultFromName ?? "") ||
      replyTo.trim() !== (saved.defaultReplyTo ?? ""),
    [fromName, replyTo, saved],
  );

  async function handleSave() {
    setSaving(true);
    setError(null);
    try {
      const response = await fetch(`/api/organizations/${organizationId}/sending`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          defaultFromName: fromName.trim(),
          defaultReplyTo: replyTo.trim(),
        }),
      });
      const data = await response.json().catch(() => null);
      if (!data?.ok) throw new Error(data?.error || "Could not save sending settings");
      setSaved(data.defaults);
      setFromName(data.defaults.defaultFromName ?? "");
      setReplyTo(data.defaults.defaultReplyTo ?? "");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save sending settings");
    } finally {
      setSaving(false);
    }
  }

  function handleDiscard() {
    setFromName(saved.defaultFromName ?? "");
    setReplyTo(saved.defaultReplyTo ?? "");
    setError(null);
  }

  const activeMailboxes = mailboxes.filter((box) => box.status === "active");
  const brokenMailboxes = mailboxes.filter((box) => box.status === "error");

  return (
    <>
      <div className="flex max-w-lg flex-col gap-8">
        <div className="flex flex-col gap-4">
          <div>
            <h3 className="text-sm font-semibold">Sender defaults</h3>
            <p className="mt-0.5 text-xs text-muted-foreground">
              What a new campaign starts with. Every campaign can still override
              these before it sends.
            </p>
          </div>

          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <Label className="text-sm font-medium">Default From name</Label>
              <Input
                value={fromName}
                onChange={(event) => setFromName(event.target.value)}
                placeholder={organizationName}
                disabled={!canManage}
                className="h-8 text-sm"
                maxLength={78}
              />
              <p className="text-xs text-muted-foreground">
                The name recipients see in their inbox. Left empty, campaigns use{" "}
                <span className="font-medium text-foreground">{organizationName}</span>.
              </p>
            </div>

            <div className="flex flex-col gap-1.5">
              <Label className="text-sm font-medium">Default reply-to</Label>
              <Input
                value={replyTo}
                onChange={(event) => setReplyTo(event.target.value)}
                placeholder="replies@yourcompany.com"
                disabled={!canManage}
                className="h-8 text-sm"
                type="email"
              />
              <p className="text-xs text-muted-foreground">
                Where replies land. This can be any inbox you actually read — it
                does not have to be on a domain you have verified here.
              </p>
            </div>
          </div>

          {!canManage && (
            <p className="text-xs text-muted-foreground">
              Only owners and admins can change sender defaults.
            </p>
          )}
        </div>

        <Separator />

        <div className="flex flex-col gap-4">
          <div>
            <h3 className="text-sm font-semibold">Addresses you can send from</h3>
            <p className="mt-0.5 text-xs text-muted-foreground">
              A campaign&apos;s From address has to be one of these. Anything else
              is refused at send time.
            </p>
          </div>

          <div className="flex flex-col gap-2">
            {sharedFromEmail && (
              <ChannelRow
                icon={<MailIcon className="size-3.5 text-muted-foreground" />}
                title={sharedFromEmail}
                detail="Shared LetterStack address. Always available, no setup."
                badge={<Badge variant="outline">Default</Badge>}
              />
            )}

            {verifiedDomains.map((domain) => (
              <ChannelRow
                key={domain}
                icon={<GlobeIcon className="size-3.5 text-muted-foreground" />}
                title={`anything@${domain}`}
                detail="Your domain, DNS verified. Pick any local part per campaign."
                badge={
                  <Badge>
                    <CheckCircle2Icon className="size-3" />
                    Verified
                  </Badge>
                }
              />
            ))}

            {unverifiedDomains.map((domain) => (
              <ChannelRow
                key={domain}
                icon={<GlobeIcon className="size-3.5 text-muted-foreground" />}
                title={domain}
                detail="DNS records still pending — you cannot send from this yet."
                badge={<Badge variant="outline">Unverified</Badge>}
              />
            ))}

            {activeMailboxes.map((box) => (
              <ChannelRow
                key={box.id}
                icon={<MailIcon className="size-3.5 text-muted-foreground" />}
                title={box.email}
                detail="Connected Gmail. Sends as itself, and only you can use it."
                badge={<Badge variant="secondary">Gmail</Badge>}
              />
            ))}

            {brokenMailboxes.map((box) => (
              <ChannelRow
                key={box.id}
                icon={<ShieldAlertIcon className="size-3.5 text-destructive" />}
                title={box.email}
                detail="Google revoked this connection. Reconnect it to send again."
                badge={<Badge variant="destructive">Needs reconnect</Badge>}
              />
            ))}
          </div>

          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="xs" onClick={() => onNavigate("domains")}>
              Manage domains
            </Button>
            <Button variant="outline" size="xs" asChild>
              <a href="/dashboard/domains">Connect a Gmail account</a>
            </Button>
          </div>
        </div>

        <Separator />

        <div className="flex flex-col gap-3">
          <div>
            <h3 className="text-sm font-semibold">How sends are paced</h3>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Not configurable, and worth knowing before you schedule anything.
            </p>
          </div>
          <Alert>
            <AlertDescription className="text-xs leading-relaxed">
              Campaigns go out in batches of 50, four seconds apart, which works
              out to roughly 3,000 emails in four minutes. The pacing is set by
              the rate limit on our sending account, not by your plan — raising
              it for one workspace would spend everyone else&apos;s headroom.
            </AlertDescription>
          </Alert>
        </div>
      </div>

      <SaveBar
        dirty={dirty}
        saving={saving}
        error={error}
        onSave={handleSave}
        onDiscard={handleDiscard}
      />
    </>
  );
}

function ChannelRow({
  icon,
  title,
  detail,
  badge,
}: {
  icon: React.ReactNode;
  title: string;
  detail: string;
  badge: React.ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-3 rounded-lg border border-border px-3 py-2.5">
      <div className="flex min-w-0 items-start gap-2.5">
        <span className="mt-0.5 shrink-0">{icon}</span>
        <div className="min-w-0">
          <p className="truncate font-mono text-xs">{title}</p>
          <p className="mt-0.5 text-[11px] text-muted-foreground">{detail}</p>
        </div>
      </div>
      <span className="shrink-0">{badge}</span>
    </div>
  );
}
