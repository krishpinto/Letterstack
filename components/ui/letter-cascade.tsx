import * as React from "react";

import { cn } from "@/lib/utils";

interface LetterCascadeProps {
  text: string;
  className?: string;
  letterClassName?: string;
  staggerDuration?: number;
  staggerFrom?: "first" | "last" | "center" | number;
}

function getDelay(
  index: number,
  total: number,
  staggerDuration: number,
  staggerFrom: LetterCascadeProps["staggerFrom"]
) {
  if (typeof staggerFrom === "number") {
    return Math.abs(index - staggerFrom) * staggerDuration;
  }

  if (staggerFrom === "last") {
    return (total - index - 1) * staggerDuration;
  }

  if (staggerFrom === "center") {
    return Math.abs(index - (total - 1) / 2) * staggerDuration;
  }

  return index * staggerDuration;
}

export function LetterCascade({
  text,
  className,
  letterClassName,
  staggerDuration = 0.018,
  staggerFrom = "first",
}: LetterCascadeProps) {
  const letters = text.split("");

  return (
    <span
      className={cn(
        "group/letter-cascade inline-flex cursor-pointer select-none items-center justify-center",
        className
      )}
      aria-label={text}
    >
      {letters.map((letter, index) => {
        const delay = `${getDelay(
          index,
          letters.length,
          staggerDuration,
          staggerFrom
        )}s`;

        return (
          <span
            key={`${letter}-${index}`}
            className="relative inline-flex overflow-visible whitespace-pre py-[0.08em] [perspective:500px]"
            style={{ "--cascade-delay": delay } as React.CSSProperties}
            aria-hidden="true"
          >
            <span
              className={cn(
                "inline-block transition-all duration-300 ease-out [transform-origin:bottom_center] [transition-delay:var(--cascade-delay)] group-hover/letter-cascade:-translate-y-1 group-hover/letter-cascade:opacity-0 group-hover/letter-cascade:[transform:rotateX(90deg)]",
                letterClassName
              )}
            >
              {letter}
            </span>
            <span
              className={cn(
                "absolute inset-0 inline-block translate-y-1 opacity-0 blur-[2px] transition-all duration-300 ease-out [transform:rotateX(-90deg)] [transform-origin:top_center] [transition-delay:var(--cascade-delay)] group-hover/letter-cascade:translate-y-0 group-hover/letter-cascade:opacity-100 group-hover/letter-cascade:blur-0 group-hover/letter-cascade:[transform:rotateX(0deg)]",
                letterClassName
              )}
            >
              {letter}
            </span>
          </span>
        );
      })}
    </span>
  );
}
