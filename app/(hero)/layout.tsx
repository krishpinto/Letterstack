import { MarketingShell } from "@/components/marketing/shell";

export default function HeroLayout({ children }: { children: React.ReactNode }) {
  return <MarketingShell>{children}</MarketingShell>;
}
