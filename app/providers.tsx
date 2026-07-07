"use client";

import { SessionProvider } from "next-auth/react";
import { AppDialogs } from "@/components/app-dialogs";
import { ThemeProvider } from "@/components/theme-provider";
import { TooltipProvider } from "@/components/ui/tooltip";
import { usePathname } from "next/navigation";

export function Providers({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  // Landing page is light; the whole app is dark. The theme is forced from
  // the route, and next-themes bakes it into the server HTML so there is no
  // light-mode flash on first paint.
  const forcedTheme = pathname === "/" ? "light" : "dark";

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
