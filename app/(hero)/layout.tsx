import { Bricolage_Grotesque } from "next/font/google";

import { MarketingShell } from "@/components/marketing/shell";

const bricolage = Bricolage_Grotesque({
  subsets: ["latin"],
  variable: "--font-bricolage",
  display: "swap",
  weight: ["400", "500", "600", "700", "800"],
});

export default function HeroLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className={bricolage.variable}>
      {/* Keep the bottom blur off the hero — it only looks right once the
          reader has scrolled into the sections below it. */}
      <MarketingShell hideBottomBlurUntilSelector="[data-hero-section]">
        {children}
      </MarketingShell>
    </div>
  );
}
