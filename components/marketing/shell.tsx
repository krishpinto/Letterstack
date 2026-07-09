import { Navbar } from "@/components/navbar";
import { PageBlur } from "@/components/page-blur";

export function MarketingShell({
  children,
  hideBottomBlurUntilSelector,
}: {
  children: React.ReactNode;
  /** Selector for a leading section over which the bottom blur stays hidden. */
  hideBottomBlurUntilSelector?: string;
}) {
  return (
    <>
      <Navbar />
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
