"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";
import {
  ArrowRightIcon,
  LockKeyholeIcon,
  MailIcon,
  UserIcon,
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

export default function SignupPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setLoading(true);

    const response = await fetch("/api/auth/signup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password, name }),
    });
    const data = await response.json();

    if (!data.ok) {
      setError(data.error || "Could not create account.");
      setLoading(false);
      return;
    }

    const signInResult = await signIn("credentials", {
      email,
      password,
      redirect: false,
    });

    setLoading(false);

    if (signInResult?.error) {
      setError("Account created, but sign-in failed. Please log in manually.");
      return;
    }

    router.push("/onboarding");
  }

  return (
    <main className="grid min-h-svh bg-muted/20 lg:grid-cols-[0.92fr_1.08fr]">
      <section className="hidden border-r border-border bg-sidebar p-8 text-sidebar-foreground lg:flex lg:flex-col">
        <Link href="/" className="flex w-fit items-center gap-2">
          <BrandLogo className="size-9" aria-hidden />
          <span className="font-semibold tracking-normal">LetterStack</span>
        </Link>

        <div className="mt-auto flex max-w-md flex-col gap-5">
          <div className="grid gap-3 rounded-xl border border-sidebar-border bg-sidebar-accent/40 p-4">
            <div className="flex items-center justify-between rounded-lg border border-sidebar-border bg-background/60 px-3 py-3">
              <div>
                <div className="text-sm font-medium">First organization</div>
                <div className="mt-1 text-xs text-muted-foreground">
                  Personal or company workspace
                </div>
              </div>
              <span className="rounded-full bg-primary px-2 py-0.5 text-xs text-primary-foreground">
                Step 1
              </span>
            </div>
            <div className="flex items-center justify-between rounded-lg border border-sidebar-border bg-background/60 px-3 py-3">
              <div>
                <div className="text-sm font-medium">Campaign dashboard</div>
                <div className="mt-1 text-xs text-muted-foreground">
                  Templates, audience, domains, and sending
                </div>
              </div>
              <span className="rounded-full border border-sidebar-border px-2 py-0.5 text-xs text-muted-foreground">
                Step 2
              </span>
            </div>
          </div>
          <div>
            <h1 className="text-3xl font-semibold leading-tight tracking-normal">
              Start with the account, then name your workspace.
            </h1>
            <p className="mt-3 text-sm leading-6 text-sidebar-foreground/70">
              This creates the user account now. Organization persistence can be
              wired in once the multi-tenant model is added.
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
              <CardTitle>Create account</CardTitle>
              <CardDescription>
                Create your profile before setting up the first organization.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit}>
                <FieldGroup>
                  <Field>
                    <FieldLabel htmlFor="name">Name</FieldLabel>
                    <div className="relative">
                      <UserIcon className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        id="name"
                        type="text"
                        value={name}
                        onChange={(event) => setName(event.target.value)}
                        placeholder="Ethan Rodrigues"
                        className="pl-8"
                      />
                    </div>
                  </Field>
                  <Field>
                    <FieldLabel htmlFor="signup-email">Email</FieldLabel>
                    <div className="relative">
                      <MailIcon className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        id="signup-email"
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
                    <FieldLabel htmlFor="signup-password">Password</FieldLabel>
                    <div className="relative">
                      <LockKeyholeIcon className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        id="signup-password"
                        type="password"
                        value={password}
                        onChange={(event) => setPassword(event.target.value)}
                        placeholder="At least 6 characters"
                        className="pl-8"
                        minLength={6}
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
                      {loading ? "Creating..." : "Continue to organization"}
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
                        onClick={() => signIn("google", { callbackUrl: "/onboarding" })}
                      >
                        Continue with Google
                      </Button>
                    )}
                    <FieldDescription className="text-center">
                      Already have an account?{" "}
                      <Link
                        href="/login"
                        className="font-medium text-foreground underline-offset-4 hover:underline"
                      >
                        Log in
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
