"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2Icon, KeyRoundIcon, MailIcon } from "lucide-react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Spinner } from "@/components/ui/spinner";

/**
 * Settings → Security.
 *
 * Three things, and only one of them is a form, because only one of them is
 * something this app can actually do.
 *
 * What is NOT here, and why: a list of active sessions, and a "sign out
 * everywhere" button. Sessions are stateless JWTs — lib/auth.ts runs NextAuth
 * with strategy: "jwt" and no adapter, on purpose, because the users table is
 * ours — so there is no server-side record of a session to display or revoke.
 * A button claiming to end other sessions would end nothing. Making it real
 * needs a token-version column compared in the jwt callback, which costs a
 * database read on every session refresh; that is a trade worth making
 * deliberately, not smuggling in behind a switch. Until then this panel says
 * what is true.
 */

const MIN_LENGTH = 8;

export function SecurityPanel({
  email,
  hasPassword,
  googleSignInEnabled,
}: {
  email: string;
  hasPassword: boolean;
  googleSignInEnabled: boolean;
}) {
  const router = useRouter();
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const tooShort = next.length > 0 && next.length < MIN_LENGTH;
  const mismatch = confirm.length > 0 && next !== confirm;
  const ready =
    next.length >= MIN_LENGTH && next === confirm && (!hasPassword || current.length > 0);

  async function submit() {
    setSaving(true);
    setError(null);
    setDone(false);
    try {
      const response = await fetch("/api/account/password", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword: current, newPassword: next }),
      });
      const data = await response.json().catch(() => null);
      if (!data?.ok) throw new Error(data?.error || "Could not update your password");
      setCurrent("");
      setNext("");
      setConfirm("");
      setDone(true);
      // The panel's copy depends on whether a password exists, and it just
      // started existing.
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not update your password");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex max-w-lg flex-col gap-8">
      <div className="flex flex-col gap-4">
        <div>
          <h3 className="text-sm font-semibold">How you sign in</h3>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Every way this account can currently get in.
          </p>
        </div>

        <div className="flex flex-col gap-2">
          <div className="flex items-start justify-between gap-3 rounded-lg border border-border px-3 py-2.5">
            <div className="flex min-w-0 items-start gap-2.5">
              <KeyRoundIcon className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" />
              <div className="min-w-0">
                <p className="text-xs font-medium">Email and password</p>
                <p className="mt-0.5 text-[11px] text-muted-foreground">
                  {hasPassword
                    ? "Set. You can sign in with the form on the login page."
                    : "Not set. Add one below so you are not locked out if Google sign-in is unavailable."}
                </p>
              </div>
            </div>
            {hasPassword ? (
              <Badge>
                <CheckCircle2Icon className="size-3" />
                Active
              </Badge>
            ) : (
              <Badge variant="outline">Not set</Badge>
            )}
          </div>

          {googleSignInEnabled && (
            <div className="flex items-start justify-between gap-3 rounded-lg border border-border px-3 py-2.5">
              <div className="flex min-w-0 items-start gap-2.5">
                <MailIcon className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" />
                <div className="min-w-0">
                  <p className="text-xs font-medium">Google</p>
                  <p className="mt-0.5 text-[11px] text-muted-foreground">
                    Signing in with a Google account verified as{" "}
                    <span className="font-mono">{email}</span> reaches this
                    workspace.
                  </p>
                </div>
              </div>
              <Badge variant="secondary">Available</Badge>
            </div>
          )}
        </div>
      </div>

      <Separator />

      <div className="flex flex-col gap-4">
        <div>
          <h3 className="text-sm font-semibold">
            {hasPassword ? "Change password" : "Set a password"}
          </h3>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {hasPassword
              ? "At least 8 characters. You need your current password to change it."
              : "At least 8 characters. Your account signed up through Google, so there is no current password to enter."}
          </p>
        </div>

        {error && (
          <Alert variant="destructive">
            <AlertDescription className="text-xs">{error}</AlertDescription>
          </Alert>
        )}

        {done && (
          <Alert>
            <AlertDescription className="text-xs">
              Password updated. Other browsers you are signed in on stay signed
              in — see the note below.
            </AlertDescription>
          </Alert>
        )}

        <div className="flex flex-col gap-4">
          {hasPassword && (
            <div className="flex flex-col gap-1.5">
              <Label className="text-sm font-medium">Current password</Label>
              <Input
                type="password"
                value={current}
                autoComplete="current-password"
                onChange={(event) => setCurrent(event.target.value)}
                className="h-8 text-sm"
              />
            </div>
          )}

          <div className="flex flex-col gap-1.5">
            <Label className="text-sm font-medium">New password</Label>
            <Input
              type="password"
              value={next}
              autoComplete="new-password"
              onChange={(event) => setNext(event.target.value)}
              className="h-8 text-sm"
            />
            {tooShort && (
              <p className="text-xs text-destructive">
                Use at least {MIN_LENGTH} characters.
              </p>
            )}
          </div>

          <div className="flex flex-col gap-1.5">
            <Label className="text-sm font-medium">Confirm new password</Label>
            <Input
              type="password"
              value={confirm}
              autoComplete="new-password"
              onChange={(event) => setConfirm(event.target.value)}
              className="h-8 text-sm"
            />
            {mismatch && (
              <p className="text-xs text-destructive">These do not match.</p>
            )}
          </div>

          <Button
            size="sm"
            className="self-start"
            disabled={!ready || saving}
            onClick={() => void submit()}
          >
            {saving && <Spinner data-icon="inline-start" />}
            {saving ? "Saving…" : hasPassword ? "Change password" : "Set password"}
          </Button>
        </div>
      </div>

      <Separator />

      <div className="flex flex-col gap-3">
        <div>
          <h3 className="text-sm font-semibold">Sessions</h3>
        </div>
        <p className="text-xs leading-relaxed text-muted-foreground">
          We cannot show you a list of signed-in devices, and we would rather
          say so than show you one that is not real. Sessions here are
          self-contained tokens held by your browser — nothing about them is
          stored on our side, which is also why changing your password does not
          sign other browsers out. If you think someone else has access, change
          your password and then sign out of the browser you are worried about
          directly.
        </p>
        <p className="text-xs text-muted-foreground">
          A signed-in session lasts 30 days from sign-in unless you sign out.
        </p>
      </div>
    </div>
  );
}
