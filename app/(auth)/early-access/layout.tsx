import { Bricolage_Grotesque } from "next/font/google";

const bricolage = Bricolage_Grotesque({
  subsets: ["latin"],
  variable: "--font-bricolage",
  display: "swap",
  weight: ["400", "500", "600", "700", "800"],
});

// This route is the front door during the invite-only beta (proxy.ts sends
// every non-approved visitor here, including anonymous ones), so it borrows
// the marketing (hero) route's typography rather than the plain auth-page
// look — see app/(hero)/layout.tsx for the sibling setup.
export default function EarlyAccessLayout({ children }: { children: React.ReactNode }) {
  return <div className={bricolage.variable}>{children}</div>;
}
