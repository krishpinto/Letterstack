"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";

/** "Send a new link" for a signed-in, unverified account. */
export function ResendVerificationButton({
  variant = "default",
}: {
  variant?: "default" | "outline";
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function resend() {
    setLoading(true);
    setMessage(null);
    setError(null);
    try {
      const response = await fetch("/api/auth/verify-email/resend", { method: "POST" });
      const data = await response.json().catch(() => null);
      if (!data?.ok) {
        setError(data?.error ?? "Could not send the email.");
        return;
      }
      if (data.alreadyVerified) {
        router.refresh();
        return;
      }
      setMessage("Sent. Check your inbox, and your spam folder if it isn't there.");
    } catch {
      setError("Could not reach the server.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <Button type="button" variant={variant} onClick={resend} disabled={loading}>
        {loading && <Spinner data-icon="inline-start" />}
        {loading ? "Sending..." : "Send a new link"}
      </Button>
      {message && <p className="text-sm text-muted-foreground">{message}</p>}
      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  );
}
