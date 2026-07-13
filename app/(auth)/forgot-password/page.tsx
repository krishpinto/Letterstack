"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeftIcon, MailIcon } from "lucide-react";

import { BrandLogo } from "@/components/brand-logo";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
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
import { Spinner } from "@/components/ui/spinner";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const r = await fetch("/api/auth/forgot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await r.json();
      if (!data.ok) {
        setError(data.error || "Something went wrong. Try again.");
        return;
      }
      setSent(true);
    } catch {
      setError("Could not reach the server.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="flex min-h-svh items-center justify-center bg-muted/20 p-6 md:p-10">
      <div className="flex w-full max-w-md flex-col gap-6">
        <Link href="/" className="flex items-center gap-2">
          <BrandLogo className="size-9" aria-hidden />
          <span className="font-semibold tracking-normal">LetterStack</span>
        </Link>

        <Card>
          <CardHeader>
            <CardTitle>Reset your password</CardTitle>
            <CardDescription>
              {sent
                ? "Check your inbox."
                : "Enter your account email and we'll send you a reset link."}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {sent ? (
              <div className="flex flex-col gap-4">
                <p className="text-sm text-muted-foreground">
                  If an account exists for{" "}
                  <span className="font-medium text-foreground">{email}</span>,
                  a reset link is on its way. It works once and expires in 1
                  hour — check spam if it doesn&apos;t arrive within a couple
                  of minutes.
                </p>
                <Button variant="outline" asChild>
                  <Link href="/login">
                    <ArrowLeftIcon data-icon="inline-start" />
                    Back to log in
                  </Link>
                </Button>
              </div>
            ) : (
              <form onSubmit={handleSubmit}>
                <FieldGroup>
                  <Field>
                    <FieldLabel htmlFor="email">Email</FieldLabel>
                    <div className="relative">
                      <MailIcon className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        id="email"
                        type="email"
                        value={email}
                        onChange={(event) => setEmail(event.target.value)}
                        placeholder="you@example.com"
                        className="pl-8"
                        required
                        autoFocus
                      />
                    </div>
                  </Field>
                  {error && (
                    <Alert variant="destructive">
                      <AlertDescription>{error}</AlertDescription>
                    </Alert>
                  )}
                  <Field>
                    <Button className="w-full" disabled={loading}>
                      {loading && <Spinner data-icon="inline-start" />}
                      {loading ? "Sending..." : "Send reset link"}
                    </Button>
                    <FieldDescription className="text-center">
                      Remembered it?{" "}
                      <Link
                        href="/login"
                        className="font-medium text-foreground underline-offset-4 hover:underline"
                      >
                        Back to log in
                      </Link>
                    </FieldDescription>
                  </Field>
                </FieldGroup>
              </form>
            )}
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
