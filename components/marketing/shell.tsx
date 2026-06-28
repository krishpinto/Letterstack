import { Navbar } from "@/components/navbar";
import { PageBlur } from "@/components/page-blur";

export function MarketingShell({ children }: { children: React.ReactNode }) {
  return (
    <>
      <Navbar />
      <PageBlur backgroundColor="var(--background)" />
      <main className="flex min-h-dvh flex-col bg-background text-foreground">
        {children}
      </main>
    </>
  );
}
