/**
 * The two customer-facing notification emails, and the rules for when they
 * fire. Both are best-effort: a notification failing must never fail the send
 * or the webhook it is reporting on, so every path here swallows its errors
 * after logging them — the same contract as lib/admin-notify.ts.
 *
 * Unset MAIL_FROM turns both into no-ops, which is what keeps local
 * development and CI from mailing anyone.
 */

import { count, eq } from "drizzle-orm";

import { db } from "@/db/client";
import { campaignRecipients, campaigns, organizations } from "@/db/schema";
import { campaignProgress } from "@/db/campaign-recipients";
import { campaignEngagement } from "@/db/events";
import { recipientsFor } from "@/db/notification-preferences";
import { claimDeliverabilityAlert } from "@/db/campaigns";
import { appBaseUrl } from "@/lib/send/qstash";
import { sendEmail } from "@/lib/send/ses";
import { renderNotificationEmail } from "./email-shell";

/**
 * The rates at which Amazon starts taking an interest are 10% bounces and
 * 0.5% complaints. We warn well below both, so a sender has room to react
 * before the account is the one under review.
 */
const BOUNCE_WARN_RATE = 0.05;
const COMPLAINT_WARN_RATE = 0.001;

/**
 * Below this, rates are noise. Three bounces out of twenty is 15% and means
 * nothing; three thousand out of twenty thousand is a problem. Without a floor
 * every small test send would trip the alert.
 */
const MIN_SAMPLE = 50;

/** One email per member who wants it. Never throws. */
async function fanOut(
  organizationId: string,
  kind: "campaignFinished" | "deliverabilityAlerts",
  build: (recipient: { email: string; name: string | null }) => {
    subject: string;
    html: string;
    text: string;
  },
): Promise<void> {
  const from = process.env.MAIL_FROM;
  if (!from) return;

  try {
    const recipients = await recipientsFor(organizationId, kind);
    // Sequential, not Promise.all. These fan out to a handful of teammates at
    // most, and they share the SES rate limit with campaigns that are very
    // possibly still sending — a notification is not worth stealing send
    // throughput from the thing it is reporting on.
    for (const recipient of recipients) {
      const message = build(recipient);
      try {
        await sendEmail({
          to: recipient.email,
          subject: message.subject,
          html: message.html,
          text: message.text,
          fromName: "LetterStack",
          fromEmail: from,
        });
      } catch (error) {
        console.error(`[notify] ${kind} to ${recipient.email} failed`, error);
      }
    }
  } catch (error) {
    console.error(`[notify] ${kind} fan-out failed`, error);
  }
}

/**
 * "Your campaign finished sending."
 *
 * Called from finalizeCampaignIfDone, and only on the call that actually
 * performed the sending to sent transition. QStash delivers at least once and
 * several workers can finish at the same moment, so anything gated on "is this
 * campaign done?" would mail more than once; gating on "did I just mark it
 * done?" makes the guarded UPDATE the deduplication.
 *
 * Note what this email does NOT claim: delivery. At this point every message
 * has been handed to SES and nothing more is known — bounces arrive over SNS
 * minutes to hours later. So it reports what was accepted and what failed to
 * submit, and says where the real delivery numbers will appear.
 */
export async function notifyCampaignFinished(campaignId: string): Promise<void> {
  try {
    const [row] = await db
      .select({
        name: campaigns.name,
        subject: campaigns.subject,
        fromName: campaigns.fromName,
        fromEmail: campaigns.fromEmail,
        organizationId: campaigns.organizationId,
        organizationName: organizations.name,
      })
      .from(campaigns)
      .innerJoin(organizations, eq(campaigns.organizationId, organizations.id))
      .where(eq(campaigns.id, campaignId))
      .limit(1);

    if (!row) return;

    const progress = await campaignProgress(campaignId);
    const link = `${appBaseUrl()}/dashboard/campaigns/analytics/${campaignId}`;

    const facts: [string, string][] = [
      ["Sent", progress.sent.toLocaleString()],
      ...(progress.failed > 0
        ? ([["Failed", progress.failed.toLocaleString()]] as [string, string][])
        : []),
      ["From", `${row.fromName} <${row.fromEmail}>`],
    ];

    await fanOut(row.organizationId, "campaignFinished", () => {
      const email = renderNotificationEmail({
        heading: `${row.name} has finished sending`,
        lead: row.subject,
        subhead: row.organizationName,
        facts,
        note:
          progress.failed > 0
            ? `${progress.failed.toLocaleString()} could not be submitted. The campaign report lists which addresses, and why.`
            : undefined,
        action: { label: "See the report", href: link },
        footer:
          "Opens, clicks and bounces keep arriving for a while after a send, so the report will keep moving. Turn these off in Settings, Notifications.",
      });
      return {
        subject: `${row.name} sent to ${progress.sent.toLocaleString()} recipient${
          progress.sent === 1 ? "" : "s"
        }`,
        ...email,
      };
    });
  } catch (error) {
    console.error("[notify] campaign finished notification failed", error);
  }
}

/**
 * "This campaign's bounce rate is a problem."
 *
 * Called from the SES webhook after a Bounce or Complaint is recorded, which
 * is the only place that knows — bounces arrive asynchronously, long after the
 * send path has finished and forgotten the campaign.
 *
 * The webhook sees one event at a time, so the dedup is
 * claimDeliverabilityAlert: a guarded UPDATE that stamps the campaign and
 * reports whether this caller got there first. Without it, every bounce past
 * the threshold would be its own email.
 */
export async function maybeAlertDeliverability(campaignId: string): Promise<void> {
  try {
    const [audience] = await db
      .select({ total: count() })
      .from(campaignRecipients)
      .where(eq(campaignRecipients.campaignId, campaignId));

    const total = Number(audience?.total ?? 0);
    if (total < MIN_SAMPLE) return;

    const engagement = await campaignEngagement(campaignId);
    const bounceRate = engagement.bounced / total;
    const complaintRate = engagement.complained / total;

    const overBounce = bounceRate >= BOUNCE_WARN_RATE;
    const overComplaint = complaintRate >= COMPLAINT_WARN_RATE;
    if (!overBounce && !overComplaint) return;

    // Claim before sending, not after. Losing the race means another webhook
    // invocation is already mailing about this, and claiming first means a
    // send failure costs at most one missed alert rather than a loop of them.
    const claimed = await claimDeliverabilityAlert(campaignId);
    if (!claimed) return;

    const link = `${appBaseUrl()}/dashboard/campaigns/analytics/${campaignId}`;
    const percent = (value: number) => `${(value * 100).toFixed(2)}%`;

    const facts: [string, string][] = [
      ["Campaign", claimed.name],
      ["Recipients", total.toLocaleString()],
      ["Bounced", `${engagement.bounced.toLocaleString()} (${percent(bounceRate)})`],
      [
        "Complaints",
        `${engagement.complained.toLocaleString()} (${percent(complaintRate)})`,
      ],
    ];

    await fanOut(claimed.organizationId, "deliverabilityAlerts", () => {
      const email = renderNotificationEmail({
        heading: overComplaint
          ? "Complaint rate needs attention"
          : "Bounce rate needs attention",
        lead: claimed.subject,
        facts,
        note: overComplaint
          ? "Amazon suspends senders above a 0.5% complaint rate. Complaints usually mean the list was not expecting this mail, so it is worth checking where these addresses came from and how recently they opted in."
          : "Amazon suspends senders above a 10% bounce rate. High bounces usually mean an old or bought list. Bounced addresses are suppressed automatically, so they will not be retried.",
        action: { label: "Open the report", href: link },
        footer:
          "You get one of these per campaign. Turn them off in Settings, Notifications, though we would rather you did not.",
      });
      return { subject: `Deliverability warning: ${claimed.name}`, ...email };
    });
  } catch (error) {
    console.error("[notify] deliverability alert failed", error);
  }
}
