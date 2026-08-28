"use client";

import { SessionProvider } from "next-auth/react";
import { AppDialogs } from "@/components/app-dialogs";
import { ThemeProvider } from "@/components/theme-provider";
import { TooltipProvider } from "@/components/ui/tooltip";
import { usePathname } from "next/navigation";

export function Providers({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  // Marketing pages are light; the whole app is dark. Force from the route so
  // next-themes bakes the theme into server HTML — no flash on first paint.
  //
  // Every public marketing route belongs here, not just the landing page.
  // /pricing is the one that proved it: its section carries dark: variants,
  // but the navbar and footer wrapping it are hardcoded light, so being left
  // off this list rendered a near-black slab butting straight into a white
  // footer — and PageBlur fading dark over it.
  const isLightRoute =
    pathname === "/" || pathname === "/pricing" || pathname.startsWith("/landing");
  const forcedTheme = isLightRoute ? "light" : "dark";

  return (
    <SessionProvider>
      <TooltipProvider>
        <ThemeProvider
          attribute="class"
          defaultTheme="dark"
          forcedTheme={forcedTheme}
          enableColorScheme
          disableTransitionOnChange
        >
          {children}
          <AppDialogs />
        </ThemeProvider>
      </TooltipProvider>
    </SessionProvider>
  );
}
