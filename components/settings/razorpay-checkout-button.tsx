"use client";

import { useState } from "react";
import { Loader2Icon } from "lucide-react";

import { Button } from "@/components/ui/button";

const CHECKOUT_SCRIPT = "https://checkout.razorpay.com/v1/checkout.js";

type CheckoutSuccess = {
  razorpay_order_id: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
};

type RazorpayInstance = {
  open: () => void;
  on: (event: string, handler: (payload: unknown) => void) => void;
};

declare global {
  interface Window {
    Razorpay?: new (options: Record<string, unknown>) => RazorpayInstance;
  }
}

/** Loaded on first click rather than on every page view — nobody pays on most visits. */
function loadCheckoutScript(): Promise<void> {
  if (window.Razorpay) return Promise.resolve();

  return new Promise((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(
      `script[src="${CHECKOUT_SCRIPT}"]`,
    );
    if (existing) {
      existing.addEventListener("load", () => resolve());
      existing.addEventListener("error", () =>
        reject(new Error("Razorpay checkout failed to load")),
      );
      return;
    }
    const script = document.createElement("script");
    script.src = CHECKOUT_SCRIPT;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Razorpay checkout failed to load"));
    document.body.appendChild(script);
  });
}

export function RazorpayCheckoutButton({
  item,
  label = "Pay now",
  prefill,
  onPaid,
}: {
  /** A key from lib/payments/catalog.ts. The server owns the price. */
  item: string;
  label?: string;
  prefill?: { name?: string | null; email?: string | null };
  onPaid?: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [paid, setPaid] = useState(false);

  // Not memoized by hand: it is only ever a click handler, so its identity
  // does not matter, and the manual dependency list disagreed with what the
  // React Compiler inferred (it reads `prefill`, the list named two of its
  // fields), which made the compiler bail out of optimizing this component.
  const pay = async () => {
    setBusy(true);
    setError(null);
    try {
      await loadCheckoutScript();

      const orderRes = await fetch("/api/payments/create-order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ item }),
      });
      const order = await orderRes.json();
      if (!orderRes.ok || !order.ok) {
        throw new Error(order?.error ?? "Could not start checkout.");
      }

      // Same paste-hygiene strip as the server key: a quoted or newline-
      // padded value here fails inside Razorpay's widget instead of ours,
      // which is much harder to read as a config problem.
      const keyId = (process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID ?? "")
        .trim()
        .replace(/^["']|["']$/g, "")
        .trim();
      if (!keyId) throw new Error("Payments are not configured on this environment.");
      if (!window.Razorpay) throw new Error("Razorpay checkout failed to load");

      const checkout = new window.Razorpay({
        key: keyId,
        order_id: order.order_id,
        amount: order.amount,
        currency: order.currency,
        name: "LetterStack",
        description: order.description ?? "LetterStack payment",
        prefill: {
          name: prefill?.name ?? undefined,
          email: prefill?.email ?? undefined,
        },
        theme: { color: "#5D5FEF" },
        handler: async (response: CheckoutSuccess) => {
          try {
            const verifyRes = await fetch("/api/payments/verify", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(response),
            });
            const verified = await verifyRes.json();
            if (!verifyRes.ok || !verified.ok) {
              throw new Error(verified?.error ?? "We could not verify that payment.");
            }
            setPaid(true);
            onPaid?.();
          } catch (err) {
            setError(err instanceof Error ? err.message : "Verification failed.");
          } finally {
            setBusy(false);
          }
        },
        modal: {
          // Closing the sheet is a normal thing to do, not an error state.
          ondismiss: () => setBusy(false),
        },
      });

      checkout.on("payment.failed", (payload: unknown) => {
        const description = (
          payload as { error?: { description?: string } } | undefined
        )?.error?.description;
        setError(description ?? "The payment did not go through.");
        setBusy(false);
      });

      checkout.open();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-col gap-2">
      <Button onClick={pay} disabled={busy} className="w-fit">
        {busy ? <Loader2Icon className="size-3.5 animate-spin" /> : null}
        {busy ? "Opening checkout…" : label}
      </Button>
      {paid ? (
        <p className="text-xs text-muted-foreground">
          Payment received and verified.
        </p>
      ) : null}
      {error ? <p className="text-xs text-destructive">{error}</p> : null}
    </div>
  );
}
