import { Bricolage_Grotesque } from "next/font/google";

import { MarketingShell } from "@/components/marketing/shell";
import { auth } from "@/lib/auth";
import { getEarlyAccessInfo, markWaitlistAppliedEmailSent } from "@/db/access";
import { sendWaitlistAppliedEmail } from "@/lib/waitlist-emails";

const bricolage = Bricolage_Grotesque({
  subsets: ["latin"],
  variable: "--font-bricolage",
  display: "swap",
  weight: ["400", "500", "600", "700", "800"],
});

// `/` is the only route a pending/rejected user can reach — there is no
// separate early-access holding page. This layout does the two things that
// page used to: send the one-time "you're on the list" email (guarded by
// waitlist_applied_email_sent_at so a reload can't double-send), and pass
// the signed-in user's access_status down to the Navbar so it can show a
// "waiting for approval" badge instead of a Dashboard link.
export default async function HeroLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  const userId = session?.user?.id ?? null;
  const info = userId ? await getEarlyAccessInfo(userId) : null;

  if (userId && info?.accessStatus === "pending" && !info.waitlistAppliedEmailSentAt) {
    const sent = await markWaitlistAppliedEmailSent(userId);
    if (sent) {
      void sendWaitlistAppliedEmail(info.email, info.name).catch((err) => {
        console.error("Failed to send waitlist applied email", err);
      });
    }
  }

  return (
    <div className={bricolage.variable}>
      {/* Keep the bottom blur off the hero — it only looks right once the
          reader has scrolled into the sections below it. */}
      <MarketingShell
        hideBottomBlurUntilSelector="[data-hero-section]"
        accessStatus={info?.accessStatus ?? null}
      >
        {children}
      </MarketingShell>
    </div>
  );
}
