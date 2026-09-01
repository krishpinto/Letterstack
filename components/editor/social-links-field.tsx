"use client";

import { ArrowDownIcon, ArrowUpIcon, PlusIcon, XIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Field, FieldDescription, FieldLabel, FieldTitle } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { createId, type SocialLink } from "@/lib/email/document";
import {
  SOCIAL_PLATFORMS,
  socialIconSrc,
  socialPlatform,
  type SocialPlatform,
} from "@/lib/email/social";
import { cn } from "@/lib/utils";
import { ImageUploadInput } from "./image-upload-input";

/**
 * The social block's link list: pick a platform, paste a URL, add and remove
 * rows freely.
 *
 * This replaced three hard-coded rows (Facebook / Twitter / Instagram) that
 * could take a URL but could not be changed, added to, or removed — which
 * meant every sender shipped the same three icons whether or not they used
 * those networks.
 *
 * Lives in its own file because block-inspector.tsx is already well past the
 * size where another few hundred lines belong in it.
 */

/** A 20px version of the same PNG the canvas and the email use, so the
 *  picker can never show an icon the email won't. */
function PlatformIcon({ id, className }: { id: SocialPlatform; className?: string }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element -- 20px static asset
    <img
      src={`/social/${id}.png`}
      alt=""
      aria-hidden
      className={cn("size-5 shrink-0 rounded-full", className)}
    />
  );
}

export function SocialLinksField({
  links,
  onChange,
}: {
  links: SocialLink[];
  onChange: (links: SocialLink[]) => void;
}) {
  function update(id: string, patch: Partial<SocialLink>) {
    onChange(links.map((l) => (l.id === id ? { ...l, ...patch } : l)));
  }

  function move(index: number, delta: number) {
    const next = [...links];
    const target = index + delta;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target], next[index]];
    onChange(next);
  }

  function add() {
    // Offer the first platform they aren't already using, so adding four in a
    // row doesn't produce four Instagrams to fix by hand.
    const used = new Set(links.map((l) => l.platform));
    const next =
      SOCIAL_PLATFORMS.find((p) => p.id !== "custom" && !used.has(p.id))?.id ?? "custom";
    onChange([...links, { id: createId(), platform: next, url: "" }]);
  }

  return (
    <>
      <Field>
        <FieldTitle>Social links</FieldTitle>
        <FieldDescription>
          Links without a URL are hidden from the sent email.
        </FieldDescription>
      </Field>

      {links.map((link, index) => {
        const spec = socialPlatform(link.platform);
        const isCustom = link.platform === "custom";

        return (
          <div key={link.id} className="rounded-lg border border-border/60 p-2.5">
            <div className="flex items-center gap-1.5">
              <Select
                value={link.platform}
                onValueChange={(platform) =>
                  // Dropping iconSrc/label on the way out of `custom` keeps a
                  // stale uploaded icon from silently overriding a real brand
                  // one if they switch back and forth.
                  update(link.id, {
                    platform: platform as SocialPlatform,
                    ...(platform === "custom" ? {} : { iconSrc: undefined, label: undefined }),
                  })
                }
              >
                <SelectTrigger className="h-8 flex-1 text-xs">
                  <SelectValue>
                    <span className="flex items-center gap-2">
                      <PlatformIcon id={spec.id} />
                      <span className="truncate">{spec.label}</span>
                    </span>
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {SOCIAL_PLATFORMS.map((p) => (
                    <SelectItem key={p.id} value={p.id} className="text-xs">
                      <span className="flex items-center gap-2">
                        <PlatformIcon id={p.id} />
                        {p.label}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Button
                variant="ghost" size="icon" className="size-7 shrink-0"
                aria-label="Move up" disabled={index === 0}
                onClick={() => move(index, -1)}
              >
                <ArrowUpIcon className="size-3.5" />
              </Button>
              <Button
                variant="ghost" size="icon" className="size-7 shrink-0"
                aria-label="Move down" disabled={index === links.length - 1}
                onClick={() => move(index, 1)}
              >
                <ArrowDownIcon className="size-3.5" />
              </Button>
              <Button
                variant="ghost" size="icon"
                className="size-7 shrink-0 text-muted-foreground hover:text-destructive"
                aria-label={`Remove ${spec.label}`}
                onClick={() => onChange(links.filter((l) => l.id !== link.id))}
              >
                <XIcon className="size-3.5" />
              </Button>
            </div>

            <Input
              value={link.url}
              placeholder={spec.placeholder}
              className="mt-2 h-8 text-xs"
              onChange={(e) => update(link.id, { url: e.target.value })}
            />

            {isCustom && (
              <div className="mt-2 space-y-2 border-t border-border/60 pt-2">
                <Field>
                  <FieldLabel className="text-xs">Icon image</FieldLabel>
                  <ImageUploadInput
                    value={link.iconSrc ?? ""}
                    placeholder="https://yoursite.com/icon.png"
                    onChange={(iconSrc) => update(link.id, { iconSrc: iconSrc || undefined })}
                  />
                  <FieldDescription>
                    Square works best — it renders in a 32px box. Falls back to
                    a plain link icon until you add one.
                  </FieldDescription>
                </Field>
                <Field>
                  <FieldLabel className="text-xs">Label</FieldLabel>
                  <Input
                    value={link.label ?? ""}
                    placeholder="Our shop"
                    className="h-8 text-xs"
                    onChange={(e) => update(link.id, { label: e.target.value || undefined })}
                  />
                  <FieldDescription>
                    Alt text, and what shows if images are blocked.
                  </FieldDescription>
                </Field>
              </div>
            )}
          </div>
        );
      })}

      <Button variant="outline" size="sm" className="w-full" onClick={add}>
        <PlusIcon className="size-3.5" />
        Add link
      </Button>

      {links.length > 0 && (
        <Field>
          <FieldLabel className="text-xs text-muted-foreground">Preview</FieldLabel>
          <div className="flex flex-wrap items-center gap-1.5 rounded-lg border border-border/60 bg-muted/30 p-2.5">
            {links.map((link) => (
              // eslint-disable-next-line @next/next/no-img-element -- see PlatformIcon
              <img
                key={link.id}
                src={socialIconSrc(link)}
                alt=""
                className={cn("size-6 rounded-full object-cover", !link.url.trim() && "opacity-40")}
              />
            ))}
          </div>
        </Field>
      )}
    </>
  );
}
