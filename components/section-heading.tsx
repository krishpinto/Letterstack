import { cn } from "@/lib/utils";

interface SectionHeadingProps {
  /** Small uppercase mono label, e.g. "The Stack" */
  label?: string;
  /** Main heading text — supports React nodes for <br/> etc. */
  heading: React.ReactNode;
  /** Subheading / description text */
  subheading?: string;
  /** Text alignment — center is the default */
  align?: "left" | "center" | "right";
  className?: string;
}

const alignmentClasses = {
  left: "text-left items-start",
  center: "text-center items-center",
  right: "text-right items-end",
} as const;

const headingMaxWidth = {
  left: "max-w-3xl",
  center: "max-w-3xl mx-auto",
  right: "max-w-3xl ml-auto",
} as const;

const subheadingMaxWidth = {
  left: "max-w-xl",
  center: "max-w-xl mx-auto",
  right: "max-w-xl ml-auto",
} as const;

export function SectionHeading({
  label,
  heading,
  subheading,
  align = "center",
  className,
}: SectionHeadingProps) {
  return (
    <div className={cn("flex flex-col", alignmentClasses[align], className)}>
      {label && (
        <div className="text-[12px] font-mono uppercase tracking-normal text-primary/60">
          — {label}
        </div>
      )}

      <h2
        className={cn(
          "mt-4 text-[32px] font-semibold leading-[1.02] tracking-normal sm:text-[40px] md:text-[56px]",
          headingMaxWidth[align]
        )}
      >
        {heading}
      </h2>

      {subheading && (
        <p
          className={cn(
            "mt-5 text-[15px] leading-6 text-muted-foreground md:text-[16px] md:leading-7",
            subheadingMaxWidth[align]
          )}
        >
          {subheading}
        </p>
      )}
    </div>
  );
}
