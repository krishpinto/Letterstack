import { cn } from "@/lib/utils";

interface SectionHeadingProps {
  children: React.ReactNode;
  description?: string;
  align?: "left" | "center";
  className?: string;
}

/**
 * The primary typographic element for each landing section.
 * Uses Bricolage Grotesque loaded via the landing layout.
 */
export function SectionHeading({
  children,
  description,
  align = "center",
  className,
}: SectionHeadingProps) {
  return (
    <div
      className={cn(
        "flex flex-col gap-5",
        align === "center" ? "items-center text-center" : "items-start",
        className,
      )}
    >
      <h2
        className="max-w-3xl text-5xl font-bold leading-[1.08] tracking-tight text-[#0A0A0A] lg:text-6xl"
        style={{ fontFamily: "var(--font-bricolage, var(--font-inter))" }}
      >
        {children}
      </h2>
      {description && (
        <p className="max-w-xl text-lg leading-relaxed text-[#717171]">
          {description}
        </p>
      )}
    </div>
  );
}
