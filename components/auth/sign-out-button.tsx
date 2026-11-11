"use client";

import { Button } from "@/components/ui/button";
import { signOutAndClearDrafts } from "@/lib/editor/sign-out";

export function SignOutButton({ callbackUrl = "/" }: { callbackUrl?: string }) {
  return (
    <Button variant="outline" onClick={() => signOutAndClearDrafts({ callbackUrl })}>
      Sign out
    </Button>
  );
}
