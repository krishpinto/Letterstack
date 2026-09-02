// Founder notification: one email when a campaign starts sending.
//
// Deliberately metadata only — who sent, from where, through which channel,
// and how many. It carries no recipient addresses and no campaign body,
// because neither is ours to forward: the recipients are a customer's
// subscribers, and the content is a customer's unpublished work. The email
// links into /admin, where the frozen html_snapshot can be read behind the
// ADMIN_EMAILS gate and an audit trail, by whoever actually needs to look.
//
// One send per campaign, not per recipient — a 3,000-recipient campaign is
// one line in an inbox, not 3,000.
//
// Set ADMIN_NOTIFY_EMAIL to turn it on. Unset, this is a no-op, which is what
// keeps local development and CI from mailing anyone.

import { count, eq } from "drizzle-orm";

import { db } from "@/db/client";
import { campaignRecipients, campaigns, organizations, users } from "@/db/schema";
import { appBaseUrl } from "@/lib/send/qstash";
import { sendEmail } from "@/lib/send/ses";

const CHANNEL_LABELS: Record<string, string> = {
  shared: "Shared domain",
  domain: "Own domain",
  mailbox: "Gmail",
};

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * Tells the founders a campaign just went out. Never throws — a notification
 * failing must not fail the send it is reporting on, so every error is
 * swallowed after being logged.
 */
export async function notifyAdminsOfCampaignSend(campaignId: string) {
  const to = process.env.ADMIN_NOTIFY_EMAIL;
  const from = process.env.MAIL_FROM;
  if (!to || !from) return;

  try {
    const [row] = await db
      .select({
        name: campaigns.name,
        subject: campaigns.subject,
        fromName: campaigns.fromName,
        fromEmail: campaigns.fromEmail,
        senderType: campaigns.senderType,
        organizationName: organizations.name,
        plan: organizations.plan,
        senderAccount: users.email,
      })
      .from(campaigns)
      .innerJoin(organizations, eq(campaigns.organizationId, organizations.id))
      .innerJoin(users, eq(campaigns.userId, users.id))
      .where(eq(campaigns.id, campaignId))
      .limit(1);

    if (!row) return;

    // The whole audience, not just the rows still pending: workers start
    // marking recipients sent the moment the first batch fires, so a
    // "not yet sent" count raced against them and under-reported the size of
    // the very campaign it was announcing.
    const [audience] = await db
      .select({ total: count() })
      .from(campaignRecipients)
      .where(eq(campaignRecipients.campaignId, campaignId));

    const recipients = Number(audience?.total ?? 0);
    const channel = CHANNEL_LABELS[row.senderType] ?? row.senderType;
    const link = `${appBaseUrl()}/admin`;

    const facts: [string, string][] = [
      ["Workspace", `${row.organizationName} (${row.plan})`],
      ["Account", row.senderAccount],
      ["From", `${row.fromName} <${row.fromEmail}>`],
      ["Channel", channel],
      ["Recipients", recipients.toLocaleString()],
    ];

    const html = `
      <div style="font-family: -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif; max-width: 480px; margin: 0 auto; padding: 32px 16px; color: #1a1a1a;">
        <h2 style="margin: 0 0 4px; font-size: 18px;">${escapeHtml(row.organizationName)} is sending a campaign</h2>
        <p style="margin: 0 0 20px; font-size: 15px; line-height: 1.5;">
          <strong>${escapeHtml(row.subject)}</strong><br />
          <span style="color: #666666; font-size: 13px;">${escapeHtml(row.name)}</span>
        </p>
        <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
          ${facts
            .map(
              ([label, value]) => `
            <tr>
              <td style="padding: 4px 12px 4px 0; color: #666666; white-space: nowrap;">${escapeHtml(label)}</td>
              <td style="padding: 4px 0;">${escapeHtml(value)}</td>
            </tr>`,
            )
            .join("")}
        </table>
        <p style="margin: 24px 0 0;">
          <a href="${link}" style="display: inline-block; background: #1a1a1a; color: #ffffff; padding: 10px 20px; border-radius: 8px; text-decoration: none; font-weight: 600;">
            Open the admin console
          </a>
        </p>
      </div>
    `;

    const text = [
      `${row.organizationName} is sending a campaign`,
      "",
      row.subject,
      row.name,
      "",
      ...facts.map(([label, value]) => `${label}: ${value}`),
      "",
      link,
    ].join("\n");

    await sendEmail({
      to,
      subject: `[LetterStack] ${row.organizationName} → ${recipients.toLocaleString()} recipients`,
      html,
      text,
      fromName: "LetterStack",
      fromEmail: from,
    });
  } catch (error) {
    console.error("[admin-notify] campaign send notification failed", error);
  }
}
