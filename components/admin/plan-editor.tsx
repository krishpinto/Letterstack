"use client";

import { useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  NativeSelect,
  NativeSelectOption,
} from "@/components/ui/native-select";
import { PLAN_LIMITS, PLAN_ORDER, type PlanKey } from "@/lib/plans/limits";
import { planSourceLabel, type AdminOrg } from "./types";

// The plan control for one workspace.
//
// It states the whole target — which tier, and until when — and PUTs that,
// rather than adding a fixed number of days to whatever is already there.
// That is the difference that makes "put them on Growth until the end of the
// financial year" and "take this plan away" both expressible, neither of
// which a bag of +7d / +30d buttons can say.

type Expiry = "never" | "date";

/** An ISO timestamp as the yyyy-mm-dd a date input wants, in local time. */
function toDateInput(iso: string | null): string {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

const today = () => toDateInput(new Date().toISOString());

export function PlanEditor({
  org,
  onSaved,
}: {
  org: AdminOrg;
  onSaved: () => void | Promise<void>;
}) {
  const [plan, setPlan] = useState<PlanKey>(org.plan);
  const [expiry, setExpiry] = useState<Expiry>(org.planExpiresAt ? "date" : "never");
  const [date, setDate] = useState(toDateInput(org.planExpiresAt));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Free has no end date to set — removing a plan clears the expiry outright.
  const dated = plan !== "free" && expiry === "date";
  const incomplete = dated && !date;

  const changed = useMemo(() => {
    if (plan !== org.plan) return true;
    if (plan === "free") return false;
    const wasDated = Boolean(org.planExpiresAt);
    if (wasDated !== dated) return true;
    return dated && date !== toDateInput(org.planExpiresAt);
  }, [plan, org.plan, org.planExpiresAt, dated, date]);

  async function save() {
    setSaving(true);
    setError(null);
    try {
      const r = await fetch("/api/admin/subscriptions", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          organizationId: org.id,
          plan,
          // End of the chosen day, so "until the 30th" includes the 30th.
          expiresAt: dated ? new Date(`${date}T23:59:59`).toISOString() : null,
        }),
      });
      const payload = await r.json().catch(() => null);
      if (!r.ok || !payload?.ok) {
        setError(payload?.error ?? "Could not save that.");
        return;
      }
      await onSaved();
    } catch {
      setError("Could not reach the server.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex flex-col gap-3 rounded-2xl border bg-muted/30 p-3">
      <div className="flex flex-wrap items-end gap-3">
        <div className="flex flex-col gap-1.5">
          <Label className="text-xs text-muted-foreground" htmlFor={`plan-${org.id}`}>
            Plan
          </Label>
          <NativeSelect
            id={`plan-${org.id}`}
            className="w-40"
            value={plan}
            disabled={saving}
            onChange={(e) => setPlan(e.target.value as PlanKey)}
          >
            {PLAN_ORDER.map((key) => (
              <NativeSelectOption key={key} value={key}>
                {key === "free" ? "Free — no plan" : PLAN_LIMITS[key].label}
              </NativeSelectOption>
            ))}
          </NativeSelect>
        </div>

        <div className="flex flex-col gap-1.5">
          <Label className="text-xs text-muted-foreground" htmlFor={`expiry-${org.id}`}>
            Runs until
          </Label>
          <NativeSelect
            id={`expiry-${org.id}`}
            className="w-40"
            value={plan === "free" ? "never" : expiry}
            disabled={saving || plan === "free"}
            onChange={(e) => setExpiry(e.target.value as Expiry)}
          >
            <NativeSelectOption value="never">No expiry</NativeSelectOption>
            <NativeSelectOption value="date">A date…</NativeSelectOption>
          </NativeSelect>
        </div>

        {dated && (
          <div className="flex flex-col gap-1.5">
            <Label className="text-xs text-muted-foreground" htmlFor={`date-${org.id}`}>
              End date
            </Label>
            <Input
              id={`date-${org.id}`}
              type="date"
              min={today()}
              value={date}
              disabled={saving}
              onChange={(e) => setDate(e.target.value)}
              className="h-9 w-44"
            />
          </div>
        )}

        <Button
          size="sm"
          variant={plan === "free" && org.plan !== "free" ? "destructive" : "default"}
          disabled={saving || !changed || incomplete}
          onClick={save}
        >
          {plan === "free" && org.plan !== "free" ? "Remove plan" : "Apply"}
        </Button>
      </div>

      <p className="text-xs text-muted-foreground">
        Now on <span className="text-foreground">{PLAN_LIMITS[org.plan].label}</span>{" "}
        · {planSourceLabel(org.planSource)}
        {org.planExpiresAt
          ? ` · ends ${new Date(org.planExpiresAt).toLocaleDateString()}${
              typeof org.daysLeft === "number" ? ` (${org.daysLeft}d left)` : ""
            }`
          : org.plan !== "free"
            ? " · no expiry"
            : ""}
      </p>

      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}
