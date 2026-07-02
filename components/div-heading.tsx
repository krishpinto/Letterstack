import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

interface DivHeadingProps {
  /** Bold heading text */
  heading: React.ReactNode;
  /** Description paragraph */
  description?: React.ReactNode;
  /** Button label — renders an outline button when provided */
  buttonLabel?: string;
  /** Button click handler */
  onButtonClick?: () => void;
  /** Button href — renders as a link when provided */
  buttonHref?: string;
  /** Text alignment */
  align?: "left" | "center" | "right";
  className?: string;
}

const alignmentClasses = {
  left: "text-left items-start",
  center: "text-center items-center",
  right: "text-right items-end",
} as const;

const descMaxWidth = {
  left: "max-w-xl",
  center: "max-w-xl mx-auto",
  right: "max-w-xl ml-auto",
} as const;

export function DivHeading({
  heading,
  description,
  buttonLabel,
  onButtonClick,
  buttonHref,
  align = "center",
  className,
}: DivHeadingProps) {
  const buttonEl = buttonLabel ? (
    <Button
      variant="outline"
      size="lg"
      className="mt-6"
      {...(buttonHref ? { asChild: true } : { onClick: onButtonClick })}
    >
      {buttonHref ? <a href={buttonHref}>{buttonLabel}</a> : buttonLabel}
    </Button>
  ) : null;

  return (
    <div className={cn("flex flex-col gap-0", alignmentClasses[align], className)}>
      <h3 className="text-[20px] font-semibold leading-snug tracking-normal md:text-[24px]">
        {heading}
      </h3>

      {description && (
        <p
          className={cn(
            "mt-3 text-[15px] md:text-[16px] text-muted-foreground leading-relaxed",
            descMaxWidth[align]
          )}
        >
          {description}
        </p>
      )}

      {buttonEl}
    </div>
  );
}
