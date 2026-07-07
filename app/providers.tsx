"use client";

import { SessionProvider } from "next-auth/react";
import { ThemeProvider } from "@/components/theme-provider";
import { TooltipProvider } from "@/components/ui/tooltip";
import { usePathname } from "next/navigation";

export function Providers({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  // Landing pages are light; the whole app is dark. Force from the route so
  // next-themes bakes the theme into server HTML — no flash on first paint.
  const isLightRoute = pathname === "/" || pathname.startsWith("/landing");
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
        </ThemeProvider>
      </TooltipProvider>
    </SessionProvider>
  );
}
