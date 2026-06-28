import { cn } from "@/lib/utils";

type ProgressiveBlurProps = {
  className?: string;
  backgroundColor?: string;
  position?: "top" | "bottom";
  height?: string;
  blurAmount?: string;
  /** When true, renders a solid bg color fading to transparent (no blur) */
  full?: boolean;
};

export function ProgressiveBlur({
  className,
  backgroundColor = "var(--background)",
  position = "top",
  height = "150px",
  blurAmount = "4px",
  full = false,
}: ProgressiveBlurProps) {
  const isTop = position === "top";

  const fullStyle = {
    [isTop ? "top" : "bottom"]: 0,
    height,
    background: isTop
      ? `linear-gradient(to bottom, ${backgroundColor} 0%, transparent 100%)`
      : `linear-gradient(to top, ${backgroundColor} 0%, transparent 100%)`,
  };

  const blurStyle = {
    [isTop ? "top" : "bottom"]: 0,
    height,
    background: isTop
      ? `linear-gradient(to top, transparent, ${backgroundColor})`
      : `linear-gradient(to bottom, transparent, ${backgroundColor})`,
    maskImage: isTop
      ? `linear-gradient(to bottom, ${backgroundColor} 50%, transparent)`
      : `linear-gradient(to top, ${backgroundColor} 50%, transparent)`,
    WebkitBackdropFilter: `blur(${blurAmount})`,
    backdropFilter: `blur(${blurAmount})`,
    WebkitUserSelect: "none" as const,
    userSelect: "none" as const,
  };

  return (
    <div
      className={cn("pointer-events-none absolute left-0 w-full select-none", className)}
      style={full ? fullStyle : blurStyle}
    />
  );
}
