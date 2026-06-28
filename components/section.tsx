import { cn } from "@/lib/utils";

interface SectionProps {
  children: React.ReactNode;
  className?: string;
  id?: string;
  /** Section background theme — "default" is transparent, "neutral" adds a muted bg */
  theme?: "default" | "neutral";
}

const themeClasses = {
  default: "",
  neutral: "bg-muted/50",
} as const;

export function Section({
  children,
  className,
  id,
  theme = "default",
}: SectionProps) {
  return (
    <section
      id={id}
      className={cn(
        "relative w-full overflow-hidden border-b border-border",
        themeClasses[theme],
        className
      )}
    >
      <div className="relative mx-4 max-w-6xl sm:mx-6 lg:mx-8 xl:mx-auto">
        {/* Left scale border */}
        <div className="absolute inset-y-0 left-0 w-px bg-border" />
        <div className="absolute inset-y-0 left-0 flex flex-col justify-between">
          {Array.from({ length: 9 }).map((_, i) => (
            <div
              key={`l-${i}`}
              className={cn(
                "bg-border",
                i % 4 === 0 ? "w-3 h-px" : "w-1.5 h-px"
              )}
            />
          ))}
        </div>

        {/* Right scale border */}
        <div className="absolute inset-y-0 right-0 w-px bg-border" />
        <div className="absolute inset-y-0 right-0 flex flex-col items-end justify-between">
          {Array.from({ length: 9 }).map((_, i) => (
            <div
              key={`r-${i}`}
              className={cn(
                "bg-border",
                i % 4 === 0 ? "w-3 h-px" : "w-1.5 h-px"
              )}
            />
          ))}
        </div>

        {/* Content */}
        <div className="px-6 py-16 sm:px-8 md:px-16 md:py-24">
          {children}
        </div>
      </div>
    </section>
  );
}
