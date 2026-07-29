import Link from "next/link";
import { auth } from "@/lib/auth";
import { getInviteByToken } from "@/db/invites";
import { BrandLogo } from "@/components/brand-logo";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AcceptInviteCard } from "./accept-invite-card";

function capitalize(value: string) {
  return value ? value.charAt(0).toUpperCase() + value.slice(1) : value;
}

export default async function InviteAcceptPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const invite = await getInviteByToken(token);
  const session = await auth();

  let title = "You're invited";
  let description = "This invite link isn't valid.";
  let body: React.ReactNode = null;

  if (!invite) {
    description = "This invite link isn't valid — it may have been replaced by a newer one.";
  } else if (invite.acceptedAt) {
    description = "This invite has already been accepted.";
    body = (
      <Button asChild className="w-full">
        <Link href="/dashboard">Go to dashboard</Link>
      </Button>
    );
  } else if (invite.expired) {
    description = "This invite has expired — ask for a new one.";
  } else {
    title = `Join ${invite.organizationName}`;
    description = `You've been invited to join ${invite.organizationName} as ${capitalize(invite.role)}.`;

    if (!session?.user) {
      description = `${description} Sign in or create an account with ${invite.email} to accept.`;
      body = (
        <div className="flex flex-col gap-2">
          <Button asChild className="w-full">
            <Link href="/login">Log in</Link>
          </Button>
          <Button asChild variant="outline" className="w-full">
            <Link href="/signup">Create an account</Link>
          </Button>
        </div>
      );
    } else if (session.user.email?.toLowerCase() !== invite.email.toLowerCase()) {
      description = `This invite was sent to ${invite.email}, but you're signed in as ${session.user.email}.`;
      body = (
        <Button asChild variant="outline" className="w-full">
          <Link href="/login">Switch account</Link>
        </Button>
      );
    } else {
      body = <AcceptInviteCard token={token} organizationName={invite.organizationName} />;
    }
  }

  return (
    <main className="flex min-h-svh items-center justify-center bg-muted/20 p-6">
      <div className="flex w-full max-w-sm flex-col gap-6">
        <Link href="/" className="flex items-center justify-center gap-2">
          <BrandLogo className="size-9" aria-hidden />
          <span className="font-semibold tracking-normal">LetterStack</span>
        </Link>

        <Card>
          <CardHeader className="text-center">
            <CardTitle>{title}</CardTitle>
            <CardDescription>{description}</CardDescription>
          </CardHeader>
          {body && <CardContent>{body}</CardContent>}
        </Card>
      </div>
    </main>
  );
}
