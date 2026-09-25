"use client";

import { useEffect, useState } from "react";
import { useTheme } from "next-themes";
import { CheckIcon, LaptopIcon, MoonIcon, SunIcon } from "lucide-react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

/**
 * Settings → Appearance.
 *
 * Stored per browser, by next-themes, in localStorage — not in the database,
 * and deliberately. A theme is a property of the screen you are looking at: a
 * laptop in a bright room and a phone at night want different answers from
 * the same account, and syncing the choice would make one of them wrong.
 * It also means the blocking script next-themes injects can apply the theme
 * before first paint, which a server round trip cannot.
 *
 * The consequence to be honest about: clearing site data resets this, and it
 * does not follow you to another machine.
 *
 * This only works because app/providers.tsx stopped forcing the theme on app
 * routes. Marketing pages are still pinned light — they are hardcoded light
 * around a dark-variant section, so letting them follow a preference would
 * produce a black slab against a white footer.
 */

const OPTIONS = [
  {
    value: "dark",
    label: "Dark",
    detail: "The default, and what the product is designed around.",
    icon: MoonIcon,
  },
  {
    value: "light",
    label: "Light",
    detail: "Better in a bright room or on a projector.",
    icon: SunIcon,
  },
  {
    value: "system",
    label: "System",
    detail: "Follow whatever this device is set to.",
    icon: LaptopIcon,
  },
] as const;

export function AppearancePanel() {
  const { theme, setTheme, resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  // next-themes cannot know the stored theme during SSR, so `theme` is
  // undefined on the first client render. Rendering the real control before
  // mount would briefly show the wrong option selected.
  useEffect(() => setMounted(true), []);

  return (
    <div className="flex max-w-lg flex-col gap-8">
      <div className="flex flex-col gap-4">
        <div>
          <h3 className="text-sm font-semibold">Theme</h3>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Applies to the dashboard and editor. Saved in this browser, so it
            does not follow you to another device.
          </p>
        </div>

        {!mounted ? (
          <div className="grid gap-2 sm:grid-cols-3">
            {OPTIONS.map((option) => (
              <Skeleton key={option.value} className="h-[5.5rem] rounded-lg" />
            ))}
          </div>
        ) : (
          <div className="grid gap-2 sm:grid-cols-3">
            {OPTIONS.map((option) => {
              const Icon = option.icon;
              const selected = theme === option.value;
              return (
                <button
                  key={option.value}
                  onClick={() => setTheme(option.value)}
                  aria-pressed={selected}
                  className={cn(
                    "flex flex-col items-start gap-2 rounded-lg border p-3 text-left transition-colors",
                    selected
                      ? "border-primary bg-accent/50"
                      : "border-border hover:bg-accent/30",
                  )}
                >
                  <span className="flex w-full items-center justify-between">
                    <Icon className="size-4 text-muted-foreground" />
                    {selected && <CheckIcon className="size-3.5 text-primary" />}
                  </span>
                  <span className="text-xs font-medium">{option.label}</span>
                  <span className="text-[11px] leading-snug text-muted-foreground">
                    {option.detail}
                  </span>
                </button>
              );
            })}
          </div>
        )}

        {mounted && theme === "system" && (
          <p className="text-xs text-muted-foreground">
            This device is currently set to{" "}
            <span className="font-medium text-foreground">{resolvedTheme}</span>.
          </p>
        )}
      </div>

      <Separator />

      <div className="flex flex-col gap-3">
        <div>
          <h3 className="text-sm font-semibold">What the theme does not change</h3>
        </div>
        <Alert>
          <AlertDescription className="text-xs leading-relaxed">
            Your emails are unaffected. A campaign&apos;s colours come from its
            own design settings and are frozen into the HTML when it sends, so
            what you pick here changes the editor around the canvas, never the
            canvas itself or what lands in anyone&apos;s inbox.
          </AlertDescription>
        </Alert>
        <p className="text-xs text-muted-foreground">
          Marketing and sign-in pages stay light whatever you choose here.
        </p>
      </div>
    </div>
  );
}
