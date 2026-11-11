"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { DownloadIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import type { EmailDocument } from "@/lib/email/document";
import { ApiError, errorMessage, fetchJson } from "@/lib/fetch-json";

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
      await fetchJson("/api/templates", {
        method: "POST",
        json: { name, document },
      });
      router.push("/dashboard/templates");
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        // Not signed in (or no workspace yet) — sign in and come back here.
        router.push(
          `/login?callbackUrl=${encodeURIComponent(`/templates/shared/${token}`)}`,
        );
        return;
      }
      // The server's own reason when it gave one; a non-JSON error page or a
      // dropped connection no longer both read "Could not reach the server".
      setError(errorMessage(err, "Could not save the template."));
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
      {error && (
        <span role="alert" className="text-xs text-destructive">
          {error}
        </span>
      )}
    </div>
  );
}
