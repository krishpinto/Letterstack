"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";
import {
  ArrowRightIcon,
  LockKeyholeIcon,
  MailIcon,
} from "lucide-react";

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
  FieldSeparator,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";

// Mirrors GOOGLE_AUTH_ENABLED in lib/auth.ts.
const GOOGLE_AUTH_ENABLED = true;

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setLoading(true);

    const result = await signIn("credentials", {
      email,
      password,
      redirect: false,
    });

    setLoading(false);

    if (result?.error) {
      setError("Invalid email or password.");
      return;
    }

    router.push("/dashboard");
  }

  return (
    <main className="grid min-h-svh bg-muted/20 lg:grid-cols-[0.92fr_1.08fr]">
      <section className="hidden border-r border-border bg-sidebar p-8 text-sidebar-foreground lg:flex lg:flex-col">
        <Link href="/" className="flex w-fit items-center gap-2">
          <BrandLogo className="size-9" aria-hidden />
          <span className="font-semibold tracking-normal">LetterStack</span>
        </Link>

        <div className="mt-auto flex max-w-md flex-col gap-5">
          <div className="rounded-xl border border-sidebar-border bg-sidebar-accent/40 p-4">
            <div className="text-sm font-medium">Campaign workspace</div>
            <div className="mt-4 grid gap-2">
              {["Campaigns", "Templates", "Sending domains"].map((item) => (
                <div
                  key={item}
                  className="flex items-center justify-between rounded-lg border border-sidebar-border bg-background/60 px-3 py-2 text-sm"
                >
                  <span>{item}</span>
                  <span className="size-2 rounded-full bg-primary" />
                </div>
              ))}
            </div>
          </div>
          <div>
            <h1 className="text-3xl font-semibold leading-tight tracking-normal">
              Build every campaign from one calm control room.
            </h1>
            <p className="mt-3 text-sm leading-6 text-sidebar-foreground/70">
              Design emails, manage recipients, and send from verified domains
              without leaving the workspace.
            </p>
          </div>
        </div>
      </section>

      <section className="flex min-h-svh items-center justify-center p-6 md:p-10">
        <div className="flex w-full max-w-md flex-col gap-6">
          <Link href="/" className="flex items-center gap-2 lg:hidden">
            <BrandLogo className="size-9" aria-hidden />
            <span className="font-semibold tracking-normal">LetterStack</span>
          </Link>

          <Card>
            <CardHeader>
              <CardTitle>Log in</CardTitle>
              <CardDescription>
                Enter your account details to open the campaign dashboard.
              </CardDescription>
            </CardHeader>
            <CardContent>
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
                      />
                    </div>
                  </Field>
                  <Field>
                    <div className="flex items-center justify-between gap-3">
                      <FieldLabel htmlFor="password">Password</FieldLabel>
                      <Link
                        href="/forgot-password"
                        className="text-xs text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
                      >
                        Forgot password?
                      </Link>
                    </div>
                    <div className="relative">
                      <LockKeyholeIcon className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        id="password"
                        type="password"
                        value={password}
                        onChange={(event) => setPassword(event.target.value)}
                        placeholder="Enter your password"
                        className="pl-8"
                        required
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
                      {loading ? "Logging in..." : "Log in"}
                      {!loading && <ArrowRightIcon data-icon="inline-end" />}
                    </Button>
                  </Field>
                  {GOOGLE_AUTH_ENABLED && <FieldSeparator>or</FieldSeparator>}
                  <Field>
                    {GOOGLE_AUTH_ENABLED && (
                      <Button
                        variant="outline"
                        className="w-full"
                        type="button"
                        onClick={() => signIn("google", { callbackUrl: "/dashboard" })}
                      >
                        Continue with Google
                      </Button>
                    )}
                    <FieldDescription className="text-center">
                      New here?{" "}
                      <Link
                        href="/signup"
                        className="font-medium text-foreground underline-offset-4 hover:underline"
                      >
                        Create an account
                      </Link>
                    </FieldDescription>
                  </Field>
                </FieldGroup>
              </form>
            </CardContent>
          </Card>
        </div>
      </section>
    </main>
  );
}
