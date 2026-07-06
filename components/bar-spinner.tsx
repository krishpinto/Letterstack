// A 12-bar "clock tick" loading indicator (the classic iOS pattern): bars
// fade around the circle and the whole wheel rotates in discrete steps
// rather than sweeping. Original implementation — visual pattern only, no
// third-party code.

import { cn } from "@/lib/utils";

const BAR_COUNT = 12;

export function BarSpinner({
  size = 20,
  className,
}: {
  /** Outer size in px. */
  size?: number;
  className?: string;
}) {
  return (
    <span
      role="status"
      aria-label="Loading"
      className={cn(
        "relative inline-block animate-bar-spinner text-foreground",
        className,
      )}
      style={{ width: size, height: size }}
    >
      {Array.from({ length: BAR_COUNT }).map((_, index) => (
        <span
          key={index}
          className="absolute left-1/2 top-1/2 rounded-full bg-current"
          style={{
            width: Math.max(1.5, size * 0.09),
            height: size * 0.3,
            // Rotate into place, then push out from the center; the tail
            // behind the leading bar fades progressively.
            transform: `rotate(${index * (360 / BAR_COUNT)}deg) translate(-50%, -${size * 0.52}px)`,
            transformOrigin: "0 0",
            opacity: 0.12 + 0.88 * (index / (BAR_COUNT - 1)),
          }}
        />
      ))}
    </span>
  );
}

/** Centered full-area loading state: spinner + optional label. */
export function PageLoader({
  label,
  className,
}: {
  label?: string;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex min-h-64 flex-1 flex-col items-center justify-center gap-3",
        className,
      )}
    >
      <BarSpinner size={22} className="text-muted-foreground" />
      {label && <p className="text-sm text-muted-foreground">{label}</p>}
    </div>
  );
}
