"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { CircleCheckIcon, SendIcon } from "lucide-react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogPanel,
  DialogPopup,
  DialogTitle,
} from "@/components/ui/coss-dialog";
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { toast } from "@/components/toast";
import { errorMessage, fetchJson } from "@/lib/fetch-json";

// The same limit the /test route enforces; checked here too so the person
// hears about it before a round trip.
const MAX_TEST_RECIPIENTS = 5;

/** Remembers, per campaign, that a test went out — for the checklist. */
export function testSentKey(campaignId: string) {
  return `letterstack-test-sent:${campaignId}`;
}

export function SendTestDialog({
  open,
  onOpenChange,
  campaignId,
  subject,
  onSent,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  campaignId: string;
  subject: string;
  onSent: (addresses: string[]) => void;
}) {
  const { data: session } = useSession();
  const ownEmail = session?.user?.email ?? "";
  const [value, setValue] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sentTo, setSentTo] = useState<string[] | null>(null);

  // Default to the signed-in person's own inbox each time the dialog opens.
  useEffect(() => {
    if (!open) return;
    setError(null);
    setSentTo(null);
    setValue((current) => current || ownEmail);
  }, [open, ownEmail]);

  const addresses = value
    .split(/[,\s]+/)
    .map((entry) => entry.trim())
    .filter(Boolean);
  const tooMany = addresses.length > MAX_TEST_RECIPIENTS;

  async function send() {
    if (sending || addresses.length === 0 || tooMany) return;
    setSending(true);
    setError(null);
    try {
      await fetchJson(`/api/campaigns/${campaignId}/test`, {
        method: "POST",
        json: { email: addresses.join(",") },
      });
      setSentTo(addresses);
      onSent(addresses);
      toast.success(
        `Test sent to ${addresses.length === 1 ? addresses[0] : `${addresses.length} addresses`}`,
      );
    } catch (err) {
      setError(errorMessage(err, "Could not send the test."));
    } finally {
      setSending(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(next) => !sending && onOpenChange(next)}>
      <DialogPopup className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Send a test email</DialogTitle>
          <DialogDescription>
            Check this campaign in a real inbox before it goes to your
            audience. The subject is prefixed with &ldquo;[Test]&rdquo;.
            Nobody on the campaign receives it.
          </DialogDescription>
        </DialogHeader>
        <DialogPanel>
          <form
            onSubmit={(event) => {
              event.preventDefault();
              void send();
            }}
            className="flex flex-col gap-4"
          >
            <Field>
              <FieldLabel htmlFor="test-recipients">Send to</FieldLabel>
              <Input
                id="test-recipients"
                type="text"
                inputMode="email"
                autoComplete="email"
                autoFocus
                value={value}
                onChange={(event) => {
                  setValue(event.target.value);
                  setSentTo(null);
                }}
                placeholder="you@example.com, teammate@example.com"
                aria-invalid={tooMany || undefined}
              />
              <FieldDescription>
                Up to {MAX_TEST_RECIPIENTS} addresses, separated by commas.
              </FieldDescription>
            </Field>
            <div className="rounded-lg border border-border bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
              Subject:{" "}
              <span className="font-medium text-foreground">
                [Test] {subject || "(no subject yet)"}
              </span>
            </div>
            {tooMany && (
              <Alert variant="destructive">
                <AlertDescription>
                  That&apos;s {addresses.length} addresses. Send to{" "}
                  {MAX_TEST_RECIPIENTS} or fewer at a time.
                </AlertDescription>
              </Alert>
            )}
            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
            {sentTo && (
              <Alert>
                <CircleCheckIcon className="text-emerald-600 dark:text-emerald-400" />
                <AlertDescription>
                  Sent to {sentTo.join(", ")}. It can take a minute to arrive
                  — check spam if it doesn&apos;t.
                </AlertDescription>
              </Alert>
            )}
            {/* Lets Enter submit; the visible buttons live in the footer. */}
            <button type="submit" hidden />
          </form>
        </DialogPanel>
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={sending}
          >
            {sentTo ? "Done" : "Cancel"}
          </Button>
          <Button
            onClick={() => void send()}
            disabled={sending || addresses.length === 0 || tooMany}
          >
            {sending ? (
              <Spinner data-icon="inline-start" />
            ) : (
              <SendIcon data-icon="inline-start" />
            )}
            {sending ? "Sending…" : sentTo ? "Send again" : "Send test"}
          </Button>
        </DialogFooter>
      </DialogPopup>
    </Dialog>
  );
}
