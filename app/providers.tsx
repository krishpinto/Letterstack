"use client";

import { SessionProvider } from "next-auth/react";
import { ThemeProvider } from "@/components/theme-provider";
import { TooltipProvider } from "@/components/ui/tooltip";
import { usePathname } from "next/navigation";

export function Providers({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const forcedTheme = pathname === "/" ? "light" : "dark";

  return (
    <SessionProvider>
      <TooltipProvider>
        <ThemeProvider
          defaultTheme="dark"
          forcedTheme={forcedTheme}
          disableTransitionOnChange
        >
          {children}
        </ThemeProvider>
      </TooltipProvider>
    </SessionProvider>
  );
}
