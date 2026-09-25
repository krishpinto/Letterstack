"use client";

import { useCallback, useEffect, useState } from "react";
import { CheckIcon, CopyIcon, KeyRoundIcon, TriangleAlertIcon } from "lucide-react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { Spinner } from "@/components/ui/spinner";
import { API_SCOPES, DEFAULT_SCOPES, SCOPE_INFO, type ApiScope } from "@/lib/api/scopes";
import { maskedKey } from "@/lib/api/keys";

/**
 * Settings → API & Integrations.
 *
 * Loads on mount rather than taking server props like the other panels: six
 * of the nine settings sections don't need this data, and querying keys plus
 * usage on every settings page load to serve the tab people visit least is
 * the wrong trade.
 */

type ApiKeyRecord = {
  id: string;
  name: string;
  prefix: string;
  lastFour: string;
  scopes: ApiScope[];
  lastUsedAt: string | null;
  createdAt: string;
};

type PanelState = {
  keys: ApiKeyRecord[];
  allowed: boolean;
  canManage: boolean;
  usage: { used: number; limit: number };
};

const CURL_EXAMPLE = [
  "curl https://letterstack.site/api/v1/contacts \\",
  '  -H "Authorization: Bearer ls_live_..."',
  "",
  "curl -X POST https://letterstack.site/api/v1/contacts \\",
  '  -H "Authorization: Bearer ls_live_..." \\',
  '  -H "Content-Type: application/json" \\',
  `  -d '{"email":"someone@example.com","name":"Someone"}'`,
].join("\n");

export function ApiPanel() {
  const [state, setState] = useState<PanelState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [newScopes, setNewScopes] = useState<ApiScope[]>(DEFAULT_SCOPES);
  const [revealed, setRevealed] = useState<string | null>(null);
  const [revoking, setRevoking] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const response = await fetch("/api/account/api-keys");
      const data = await response.json().catch(() => null);
      if (!data?.ok) throw new Error(data?.error || "Could not load API keys");
      setState({
        keys: data.keys,
        allowed: data.allowed,
        canManage: data.canManage,
        usage: data.usage,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load API keys");
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function handleCreate() {
    setCreating(true);
    setError(null);
    try {
      const response = await fetch("/api/account/api-keys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newName.trim(), scopes: newScopes }),
      });
      const data = await response.json().catch(() => null);
      if (!data?.ok) throw new Error(data?.error || "Could not create the key");

      // Close the form and surface the secret immediately — this is the only
      // moment it exists outside the customer's clipboard.
      setDialogOpen(false);
      setRevealed(data.key);
      setNewName("");
      setNewScopes(DEFAULT_SCOPES);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create the key");
    } finally {
      setCreating(false);
    }
  }

  async function handleRevoke(id: string) {
    setRevoking(id);
    setError(null);
    try {
      const response = await fetch(`/api/account/api-keys/${id}`, { method: "DELETE" });
      const data = await response.json().catch(() => null);
      if (!data?.ok) throw new Error(data?.error || "Could not revoke the key");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not revoke the key");
    } finally {
      setRevoking(null);
    }
  }

  if (!state) {
    return (
      <div className="flex items-center gap-2 py-10 text-sm text-muted-foreground">
        <Spinner className="size-4" />
        Loading API keys…
      </div>
    );
  }

  const usagePercent =
    state.usage.limit > 0
      ? Math.min(100, Math.round((state.usage.used / state.usage.limit) * 100))
      : 0;

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-6">
      <div>
        <h2 className="text-sm font-medium">API keys</h2>
        <p className="mt-1 text-xs text-muted-foreground">
          Let your own systems sync contacts and read campaign results. Keys are
          server-side only — they will not work from a browser.
        </p>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertDescription className="text-xs">{error}</AlertDescription>
        </Alert>
      )}

      {revealed && <RevealedKey value={revealed} onDismiss={() => setRevealed(null)} />}

      {!state.allowed ? (
        <Alert>
          <AlertDescription className="text-xs">
            Your plan doesn&apos;t include API access. See Settings → Billing &amp;
            Plans to upgrade.
          </AlertDescription>
        </Alert>
      ) : (
        <>
          <div className="rounded-lg border border-border p-4">
            <div className="flex items-baseline justify-between text-xs">
              <span className="font-medium">Requests this month</span>
              <span className="text-muted-foreground">
                {state.usage.used.toLocaleString()} of {state.usage.limit.toLocaleString()}
              </span>
            </div>
            <Progress value={usagePercent} className="mt-2" />
            <p className="mt-2 text-[11px] text-muted-foreground">
              Shared across every key in this workspace. Resets on the 1st.
            </p>
          </div>

          <Separator />

          {state.keys.length === 0 ? (
            <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed border-border py-10 text-center">
              <KeyRoundIcon className="size-5 text-muted-foreground" />
              <p className="text-xs text-muted-foreground">No API keys yet.</p>
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              {state.keys.map((key) => (
                <div
                  key={key.id}
                  className="flex items-start justify-between gap-3 rounded-lg border border-border p-3"
                >
                  <div className="min-w-0">
                    <p className="text-xs font-medium">{key.name}</p>
                    <p className="mt-0.5 font-mono text-[11px] text-muted-foreground">
                      {maskedKey(key.prefix, key.lastFour)}
                    </p>
                    <div className="mt-1.5 flex flex-wrap gap-1">
                      {key.scopes.map((scope) => (
                        <Badge key={scope} variant="secondary" className="text-[10px]">
                          {scope}
                        </Badge>
                      ))}
                    </div>
                    <p className="mt-1.5 text-[11px] text-muted-foreground">
                      {key.lastUsedAt
                        ? `Last used ${new Date(key.lastUsedAt).toLocaleDateString("en-GB")}`
                        : "Never used"}
                    </p>
                  </div>
                  {state.canManage && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="shrink-0 text-xs text-muted-foreground hover:text-destructive"
                      disabled={revoking === key.id}
                      onClick={() => handleRevoke(key.id)}
                    >
                      {revoking === key.id ? "Revoking…" : "Revoke"}
                    </Button>
                  )}
                </div>
              ))}
            </div>
          )}

          {state.canManage ? (
            <Button size="sm" className="self-start" onClick={() => setDialogOpen(true)}>
              Create API key
            </Button>
          ) : (
            <p className="text-xs text-muted-foreground">
              Only owners and admins can create or revoke keys.
            </p>
          )}

          <Separator />
          <QuickStart />
        </>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="text-sm">Create API key</DialogTitle>
            <DialogDescription className="text-xs">
              You will see the key once. Store it somewhere safe before closing.
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="key-name" className="text-xs">
                Name
              </Label>
              <Input
                id="key-name"
                value={newName}
                placeholder="Zapier, billing cron, staging server…"
                className="h-8 text-xs"
                onChange={(event) => setNewName(event.target.value)}
              />
            </div>

            <div className="flex flex-col gap-2">
              <Label className="text-xs">Permissions</Label>
              {API_SCOPES.map((scope) => {
                const info = SCOPE_INFO[scope];
                const checked = newScopes.includes(scope);
                return (
                  <label key={scope} className="flex items-start gap-2.5">
                    <Checkbox
                      checked={checked}
                      className="mt-0.5"
                      onCheckedChange={(next) =>
                        setNewScopes((current) =>
                          next
                            ? [...current, scope]
                            : current.filter((entry) => entry !== scope),
                        )
                      }
                    />
                    <span className="min-w-0">
                      <span className="flex items-center gap-1.5 text-xs font-medium">
                        {info.label}
                        {info.dangerous && (
                          <TriangleAlertIcon className="size-3 text-amber-500" />
                        )}
                      </span>
                      <span className="block text-[11px] text-muted-foreground">
                        {info.description}
                      </span>
                    </span>
                  </label>
                );
              })}
            </div>
          </div>

          <DialogFooter>
            <Button variant="ghost" size="sm" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              size="sm"
              disabled={creating || !newName.trim() || newScopes.length === 0}
              onClick={handleCreate}
            >
              {creating ? "Creating…" : "Create key"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/** The one and only sighting of a raw key. Deliberately loud, and it does not
 *  disappear on its own — dismissing it is an acknowledgement. */
function RevealedKey({ value, onDismiss }: { value: string; onDismiss: () => void }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard access is blocked in some browsers and insecure contexts.
      // The key is on screen and selectable, so there is nothing to recover.
    }
  }

  return (
    <div className="rounded-lg border border-amber-500/40 bg-amber-500/5 p-4">
      <p className="text-xs font-medium">Copy your key now</p>
      <p className="mt-1 text-[11px] text-muted-foreground">
        This is the only time it will be shown. We store a hash, so we cannot
        show it again — if you lose it, revoke it and create another.
      </p>
      <div className="mt-3 flex items-center gap-2">
        <code className="min-w-0 flex-1 truncate rounded border border-border bg-background px-2 py-1.5 font-mono text-[11px]">
          {value}
        </code>
        <Button variant="outline" size="sm" className="shrink-0 text-xs" onClick={copy}>
          {copied ? <CheckIcon className="size-3.5" /> : <CopyIcon className="size-3.5" />}
          {copied ? "Copied" : "Copy"}
        </Button>
      </div>
      <Button variant="ghost" size="sm" className="mt-2 text-xs" onClick={onDismiss}>
        I&apos;ve saved it
      </Button>
    </div>
  );
}

function QuickStart() {
  return (
    <div>
      <h3 className="text-xs font-medium">Quick start</h3>
      <p className="mt-1 text-[11px] text-muted-foreground">
        Base URL <code className="font-mono">https://letterstack.site/api/v1</code>
      </p>
      <pre className="mt-2 overflow-x-auto rounded-lg border border-border bg-muted/40 p-3 font-mono text-[11px] leading-relaxed">
        {CURL_EXAMPLE}
      </pre>
    </div>
  );
}
