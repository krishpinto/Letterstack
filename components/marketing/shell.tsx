import { Navbar } from "@/components/navbar";

export function MarketingShell({ children }: { children: React.ReactNode }) {
  return (
    <>
      {/* First tab stop: lets keyboard users jump past the navbar. Hidden
          until focused. */}
      <a
        href="#main"
        className="sr-only focus-visible:not-sr-only focus-visible:fixed focus-visible:left-4 focus-visible:top-3 focus-visible:z-[60] focus-visible:rounded-lg focus-visible:bg-neutral-950 focus-visible:px-4 focus-visible:py-2 focus-visible:text-sm focus-visible:font-medium focus-visible:text-white"
      >
        Skip to content
      </a>
      <Navbar />
      <main id="main" className="flex min-h-dvh flex-col bg-background text-foreground">
        {children}
      </main>
    </>
  );
}
