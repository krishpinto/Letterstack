import { cn } from "@/lib/utils";

// The page's grid, Dub-style: every section sits in one centred column with a
// hairline on each side (the "rails"), and a hairline runs the full width of
// the window under each section. Stacked sections therefore draw one
// continuous frame down the page, and nothing on the page is placed outside
// it. That single rule is what makes the layout feel designed rather than
// improvised.

export function Frame({
  children,
  className,
  innerClassName,
  last = false,
  ...props
}: React.HTMLAttributes<HTMLElement> & {
  innerClassName?: string;
  /** The last frame on the page draws no line under itself. */
  last?: boolean;
}) {
  return (
    <section
      className={cn("w-full scroll-mt-14", !last && "border-b border-neutral-200", className)}
      {...props}
    >
      <div
        className={cn(
          "mx-auto w-full max-w-[1200px] border-neutral-200 sm:border-x",
          innerClassName,
        )}
      >
        {children}
      </div>
    </section>
  );
}
