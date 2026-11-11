"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  CreditCardIcon,
  FileTextIcon,
  HelpCircleIcon,
  KeyboardIcon,
  MailIcon,
  SearchIcon,
  ShieldIcon,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Kbd, KbdGroup } from "@/components/ui/kbd";

// Same fallback as the public contact form, so the in-app and marketing
// "email us" links can't point at two different inboxes.
const CONTACT_EMAIL =
  process.env.NEXT_PUBLIC_CONTACT_EMAIL || "hello@letterstack.site";

/**
 * "⌘" on Apple platforms, "Ctrl" elsewhere. Read after mount so the server
 * HTML (which can't know the platform) and the first client render agree.
 */
export function useModifierKey() {
  const [key, setKey] = useState("Ctrl");
  useEffect(() => {
    const platform =
      (navigator as Navigator & { userAgentData?: { platform?: string } })
        .userAgentData?.platform ?? navigator.platform;
    if (/mac|iphone|ipad/i.test(platform)) setKey("⌘");
  }, []);
  return key;
}

// Only shortcuts the app actually binds. The editor's are in
// components/editor/editor-shell.tsx; the palette's in command-palette.tsx.
function ShortcutsDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const mod = useModifierKey();
  const rows: { label: string; keys: string[][] }[] = [
    { label: "Open search", keys: [[mod, "K"]] },
    { label: "Close a dialog or menu", keys: [["Esc"]] },
    { label: "Undo (in the editor)", keys: [[mod, "Z"]] },
    {
      label: "Redo (in the editor)",
      keys: [
        [mod, "Shift", "Z"],
        [mod, "Y"],
      ],
    },
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Keyboard shortcuts</DialogTitle>
          <DialogDescription>
            Shortcuts that work anywhere in LetterStack.
          </DialogDescription>
        </DialogHeader>
        <dl className="flex flex-col divide-y divide-border text-sm">
          {rows.map((row) => (
            <div
              key={row.label}
              className="flex items-center justify-between gap-4 py-2.5"
            >
              <dt className="text-muted-foreground">{row.label}</dt>
              <dd className="flex items-center gap-2">
                {row.keys.map((combo, index) => (
                  <span
                    key={combo.join("+")}
                    className="flex items-center gap-2"
                  >
                    {index > 0 && (
                      <span className="text-xs text-muted-foreground">or</span>
                    )}
                    <KbdGroup>
                      {combo.map((key) => (
                        <Kbd key={key}>{key}</Kbd>
                      ))}
                    </KbdGroup>
                  </span>
                ))}
              </dd>
            </div>
          ))}
        </dl>
      </DialogContent>
    </Dialog>
  );
}

export function HelpMenu({ onOpenSearch }: { onOpenSearch: () => void }) {
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const mod = useModifierKey();

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="size-8 rounded-lg text-muted-foreground hover:text-foreground"
            aria-label="Help"
          >
            <HelpCircleIcon className="size-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-60">
          <DropdownMenuLabel className="text-xs text-muted-foreground">
            Help
          </DropdownMenuLabel>
          <DropdownMenuItem onSelect={onOpenSearch}>
            <SearchIcon />
            Search
            <KbdGroup className="ml-auto">
              <Kbd>{mod}</Kbd>
              <Kbd>K</Kbd>
            </KbdGroup>
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => setShortcutsOpen(true)}>
            <KeyboardIcon />
            Keyboard shortcuts
          </DropdownMenuItem>
          <DropdownMenuItem asChild>
            <a href={`mailto:${CONTACT_EMAIL}`}>
              <MailIcon />
              Email support
            </a>
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem asChild>
            <Link href="/pricing">
              <CreditCardIcon />
              Plans and pricing
            </Link>
          </DropdownMenuItem>
          <DropdownMenuItem asChild>
            <Link href="/privacy">
              <ShieldIcon />
              Privacy policy
            </Link>
          </DropdownMenuItem>
          <DropdownMenuItem asChild>
            <Link href="/terms">
              <FileTextIcon />
              Terms of service
            </Link>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <ShortcutsDialog open={shortcutsOpen} onOpenChange={setShortcutsOpen} />
    </>
  );
}
