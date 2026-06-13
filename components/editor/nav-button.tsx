"use client";

import { HugeiconsIcon } from "@hugeicons/react";
import { cn } from "@/lib/utils";

export function NavButton({
  icon,
  label,
  active,
  onClick,
  onHover,
}: {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  icon: any;
  label: string;
  active: boolean;
  onClick: () => void;
  onHover?: () => void;
}) {
  return (
    <button
      onClick={onClick}
      onMouseEnter={onHover}
      onFocus={onHover}
      className={cn(
        "flex w-11 flex-col items-center gap-1 rounded-xl px-1 py-2.5 text-[9px] font-semibold uppercase tracking-wide leading-none select-none",
        "transition-[background-color,color,transform] duration-150 ease-out active:scale-[0.93]",
        active
          ? "bg-primary/10 text-primary"
          : "text-muted-foreground hover:bg-accent hover:text-foreground",
      )}
    >
      <HugeiconsIcon
        icon={icon}
        strokeWidth={active ? 2.5 : 1.75}
        className="size-[18px]"
      />
      {label}
    </button>
  );
}
