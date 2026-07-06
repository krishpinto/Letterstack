"use client";

import * as React from "react";
import { ThemeProvider as NextThemesProvider } from "next-themes";

/**
 * shadcn theme provider (next-themes). Unlike the previous hand-rolled
 * version — which toggled the dark class in a layout effect, after first
 * paint — next-themes injects a blocking script into the server HTML, so a
 * hard load of a dark page never flashes white.
 */
export function ThemeProvider({
  children,
  ...props
}: React.ComponentProps<typeof NextThemesProvider>) {
  return <NextThemesProvider {...props}>{children}</NextThemesProvider>;
}
