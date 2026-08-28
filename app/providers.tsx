"use client";

import { SessionProvider } from "next-auth/react";
import { AppDialogs } from "@/components/app-dialogs";
import { ThemeProvider } from "@/components/theme-provider";
import { TooltipProvider } from "@/components/ui/tooltip";
import { usePathname } from "next/navigation";

const LIGHT_ROUTES = new Set(["/", "/pricing", "/privacy", "/terms"]);

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
  // Anything rendered inside the app/(hero) marketing group goes in this
  // list. There is no way to read the route group from usePathname, so it
  // has to be kept by hand — add the path here in the same commit that adds
  // the page.
  const isLightRoute =
    LIGHT_ROUTES.has(pathname) || pathname.startsWith("/landing");
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
