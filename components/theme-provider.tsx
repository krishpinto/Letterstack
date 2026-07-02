"use client";

import * as React from "react";

type Theme = "dark" | "light";

type ThemeProviderProps = {
  children: React.ReactNode;
  defaultTheme?: Theme;
  forcedTheme?: Theme;
  disableTransitionOnChange?: boolean;
};

export function ThemeProvider({
  children,
  defaultTheme = "dark",
  forcedTheme,
  disableTransitionOnChange,
}: ThemeProviderProps) {
  const theme = forcedTheme ?? defaultTheme;

  React.useLayoutEffect(() => {
    const root = document.documentElement;
    const transitionStyle = disableTransitionOnChange
      ? disableTransitions()
      : null;

    root.classList.toggle("dark", theme === "dark");
    root.style.colorScheme = theme;

    window.requestAnimationFrame(() => {
      transitionStyle?.remove();
    });
  }, [disableTransitionOnChange, theme]);

  return <>{children}</>;
}

function disableTransitions() {
  const style = document.createElement("style");
  style.appendChild(
    document.createTextNode("*{transition:none!important}"),
  );
  document.head.appendChild(style);
  return style;
}
