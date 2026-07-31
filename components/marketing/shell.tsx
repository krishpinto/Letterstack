import { Navbar } from "@/components/navbar";
import { PageBlur } from "@/components/page-blur";
import type { AccessStatus } from "@/db/access";

export function MarketingShell({
  children,
  hideBottomBlurUntilSelector,
  accessStatus,
}: {
  children: React.ReactNode;
  /** Selector for a leading section over which the bottom blur stays hidden. */
  hideBottomBlurUntilSelector?: string;
  /** Signed-in user's early-access status, if known — see Navbar. */
  accessStatus?: AccessStatus | null;
}) {
  return (
    <>
      <Navbar accessStatus={accessStatus} />
      <PageBlur
        backgroundColor="var(--background)"
        hideBottomUntilSelector={hideBottomBlurUntilSelector}
      />
      <main className="flex min-h-dvh flex-col bg-background text-foreground">
        {children}
      </main>
    </>
  );
}
