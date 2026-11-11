// /verify-email?token=... redeems an emailed verification link.
// /verify-email on its own shows the signed-in account's status, with a way
// to send a new link.
//
// The token is redeemed during render (a GET with a side effect) because this
// is the page the email links to. That is safe here: redeeming is idempotent
// in effect (see consumeEmailVerificationToken), and a mail scanner fetching
// the link first only proves the mail reached that inbox, which is the claim
// being verified anyway.

import Link from "next/link";
import { ArrowRightIcon } from "lucide-react";

import { consumeEmailVerificationToken, type VerifyResult } from "@/db/email-verifications";
import { auth } from "@/lib/auth";
import { BrandLogo } from "@/components/brand-logo";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ResendVerificationButton } from "./resend-verification-button";

export const dynamic = "force-dynamic";

const RESULT_COPY: Record<VerifyResult, { title: string; description: string }> = {
  verified: {
    title: "Email confirmed",
    description: "Your email is verified. You can send campaigns now.",
  },
  "already-verified": {
    title: "Already confirmed",
    description: "This email was verified already. Nothing else to do.",
  },
  invalid: {
    title: "Link expired",
    description:
      "This link is invalid or has expired. Links work once and last 24 hours; you can get a new one below.",
  },
};

export default async function VerifyEmailPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;

  // Redeem before reading the session, so the session read below already
  // sees the account as verified.
  const result = token ? await consumeEmailVerificationToken(token) : null;
  const session = await auth();
  const user = session?.user;

  let title: string;
  let description: string;
  let body: React.ReactNode;

  if (result && result !== "invalid") {
    ({ title, description } = RESULT_COPY[result]);
    body = (
      <Button asChild className="w-full">
        <Link href={user ? "/dashboard" : "/login"}>
          {user ? "Go to dashboard" : "Log in"}
          <ArrowRightIcon data-icon="inline-end" />
        </Link>
      </Button>
    );
  } else if (user?.hasVerifiedEmail) {
    title = "Email confirmed";
    description = `${user.email} is verified.`;
    body = (
      <Button asChild className="w-full">
        <Link href="/dashboard">Go to dashboard</Link>
      </Button>
    );
  } else if (user) {
    title = result ? RESULT_COPY.invalid.title : "Confirm your email";
    description = result
      ? RESULT_COPY.invalid.description
      : `We sent a confirmation link to ${user.email}. You need to confirm it before you can send campaigns.`;
    body = <ResendVerificationButton />;
  } else {
    title = result ? RESULT_COPY.invalid.title : "Confirm your email";
    description = result
      ? "This link is invalid or has expired. Log in to get a new one."
      : "Log in to see your verification status or get a new link.";
    body = (
      <Button asChild className="w-full">
        <Link href="/login?callbackUrl=%2Fverify-email">Log in</Link>
      </Button>
    );
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
            <CardTitle>{title}</CardTitle>
            <CardDescription>{description}</CardDescription>
          </CardHeader>
          <CardContent>{body}</CardContent>
        </Card>
      </div>
    </main>
  );
}
