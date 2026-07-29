"use client";

import { cn } from "@/lib/utils";
import {
  type AnimationOptions,
  motion,
  stagger,
  useAnimate,
} from "motion/react";
import { useCallback, useState } from "react";

interface LetterCascadeProps {
  text: string;
  className?: string;
  letterClassName?: string;
  staggerDuration?: number;
  staggerFrom?: "first" | "last" | "center" | number;
  stiffness?: number;
  damping?: number;
  triggerOnClick?: boolean;
  onComplete?: () => void;
}

export function LetterCascade({
  text,
  className,
  letterClassName,
  staggerDuration = 0.04,
  staggerFrom = "first",
  stiffness = 220,
  damping = 16,
  triggerOnClick = false,
  onComplete,
}: LetterCascadeProps) {
  const [scope, animate] = useAnimate();
  const [blocked, setBlocked] = useState(false);
  const tokens = text.split(/(\s+)/);

  const trigger = useCallback(() => {
    if (blocked) return;
    setBlocked(true);

    const merge = (base: AnimationOptions): AnimationOptions => ({
      ...base,
      delay: stagger(staggerDuration, { from: staggerFrom }),
    });

    const spring: AnimationOptions = {
      type: "spring",
      stiffness,
      damping,
    };

    animate(
      ".cascade-front",
      {
        rotateX: 90,
        opacity: 0,
        y: -6,
        filter: "blur(4px)",
      },
      merge(spring)
    ).then(() => {
      animate(
        ".cascade-front",
        { rotateX: 0, opacity: 1, y: 0, filter: "blur(0px)" },
        { duration: 0 }
      ).then(() => {
        setBlocked(false);
        onComplete?.();
      });
    });

    animate(
      ".cascade-echo",
      {
        rotateX: 0,
        opacity: 1,
        y: 0,
        scale: 1,
        filter: "blur(0px)",
      },
      merge(spring)
    ).then(() => {
      animate(
        ".cascade-echo",
        {
          rotateX: -90,
          opacity: 0,
          y: 6,
          scale: 0.8,
          filter: "blur(4px)",
        },
        { duration: 0 }
      );
    });
  }, [
    blocked,
    animate,
    staggerDuration,
    staggerFrom,
    stiffness,
    damping,
    onComplete,
  ]);

  return (
    <span
      ref={scope}
      className={cn(
        "inline-flex flex-wrap cursor-pointer select-none items-baseline justify-start",
        className
      )}
      {...(triggerOnClick ? { onClick: trigger } : { onMouseEnter: trigger })}
      aria-label={text}
    >
      {tokens.map((token, tokenIndex) => {
        if (/^\s+$/.test(token)) {
          return (
            <span key={`space-${tokenIndex}`} className="whitespace-pre" aria-hidden="true">
              {token}
            </span>
          );
        }

        return (
          <span
            key={`${token}-${tokenIndex}`}
            className="inline-flex whitespace-nowrap"
            aria-hidden="true"
          >
            {token.split("").map((letter, letterIndex) => (
              <span
                key={`${tokenIndex}-${letter}-${letterIndex}`}
                className="relative inline-flex whitespace-pre py-[0.08em] [perspective:500px]"
              >
                <motion.span
                  className={cn("cascade-front inline-block", letterClassName)}
                  style={{
                    rotateX: 0,
                    y: 0,
                    transformOrigin: "bottom center",
                    backfaceVisibility: "hidden",
                  }}
                >
                  {letter}
                </motion.span>
                <motion.span
                  className={cn(
                    "cascade-echo absolute inset-0 inline-block",
                    letterClassName
                  )}
                  style={{
                    rotateX: -90,
                    opacity: 0,
                    y: 6,
                    scale: 0.8,
                    filter: "blur(4px)",
                    transformOrigin: "top center",
                    backfaceVisibility: "hidden",
                  }}
                >
                  {letter}
                </motion.span>
              </span>
            ))}
          </span>
        );
      })}
    </span>
  );
}