"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { DownloadIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import type { EmailDocument } from "@/lib/email/document";

export function UseSharedTemplateButton({
  token,
  name,
  document,
}: {
  token: string;
  name: string;
  document: EmailDocument;
}) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function useTemplate() {
    setSaving(true);
    setError(null);
    try {
      const response = await fetch("/api/templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, document }),
      });

      if (response.status === 401) {
        // Not signed in (or no workspace yet) — sign in and come back here.
        router.push(
          `/login?callbackUrl=${encodeURIComponent(`/templates/shared/${token}`)}`,
        );
        return;
      }

      const data = await response.json();
      if (!data.ok) {
        setError(data.error || "Could not save the template.");
        setSaving(false);
        return;
      }
      router.push("/dashboard/templates");
    } catch {
      setError("Could not reach the server.");
      setSaving(false);
    }
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <Button onClick={useTemplate} disabled={saving}>
        {saving ? (
          <Spinner data-icon="inline-start" />
        ) : (
          <DownloadIcon data-icon="inline-start" />
        )}
        {saving ? "Adding…" : "Use this template"}
      </Button>
      {error && <span className="text-xs text-destructive">{error}</span>}
    </div>
  );
}
