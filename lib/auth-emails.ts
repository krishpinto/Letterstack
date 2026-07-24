// Transactional auth emails, sent through the same SES transport as
// campaigns. Deliberately plain HTML — this is a utility email, not a
// designed newsletter, and plain text-forward messages dodge spam filters.

import { sendEmail } from "@/lib/send/ses";
import { appBaseUrl } from "@/lib/send/qstash";

export async function sendPasswordResetEmail(to: string, rawToken: string) {
  const from = process.env.MAIL_FROM;
  if (!from) throw new Error("MAIL_FROM missing");

  const url = `${appBaseUrl()}/reset-password?token=${encodeURIComponent(rawToken)}`;

  const html = `
    <div style="font-family: -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif; max-width: 480px; margin: 0 auto; padding: 32px 16px; color: #1a1a1a;">
      <h2 style="margin: 0 0 16px; font-size: 20px;">Reset your LetterStack password</h2>
      <p style="margin: 0 0 16px; line-height: 1.6;">
        Someone (hopefully you) asked to reset the password for this account.
        This link works once and expires in 1 hour.
      </p>
      <p style="margin: 0 0 24px;">
        <a href="${url}" style="display: inline-block; background: #1a1a1a; color: #ffffff; padding: 10px 20px; border-radius: 8px; text-decoration: none; font-weight: 600;">
          Choose a new password
        </a>
      </p>
      <p style="margin: 0 0 8px; font-size: 13px; color: #666666; line-height: 1.6;">
        If the button doesn't work, paste this into your browser:<br />
        <a href="${url}" style="color: #666666; word-break: break-all;">${url}</a>
      </p>
      <p style="margin: 16px 0 0; font-size: 13px; color: #666666; line-height: 1.6;">
        Didn't request this? You can safely ignore this email — your password
        stays as it is.
      </p>
    </div>
  `;

  const text = [
    "Reset your LetterStack password",
    "",
    "Someone (hopefully you) asked to reset the password for this account.",
    "This link works once and expires in 1 hour.",
    "",
    url,
    "",
    "Didn't request this? You can safely ignore this email.",
  ].join("\n");

  await sendEmail({
    to,
    subject: "Reset your LetterStack password",
    html,
    text,
    fromName: "LetterStack",
    fromEmail: from,
  });
}

export async function sendOrganizationInviteEmail(
  to: string,
  organizationName: string,
  inviterName: string,
  rawToken: string,
) {
  const from = process.env.MAIL_FROM;
  if (!from) throw new Error("MAIL_FROM missing");

  const url = `${appBaseUrl()}/invite/${encodeURIComponent(rawToken)}`;
  const inviter = inviterName || "A teammate";

  const html = `
    <div style="font-family: -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif; max-width: 480px; margin: 0 auto; padding: 32px 16px; color: #1a1a1a;">
      <h2 style="margin: 0 0 16px; font-size: 20px;">You're invited to ${organizationName} on LetterStack</h2>
      <p style="margin: 0 0 16px; line-height: 1.6;">
        ${inviter} invited you to join <strong>${organizationName}</strong>. This link works once and expires in 7 days.
      </p>
      <p style="margin: 0 0 24px;">
        <a href="${url}" style="display: inline-block; background: #1a1a1a; color: #ffffff; padding: 10px 20px; border-radius: 8px; text-decoration: none; font-weight: 600;">
          Accept invite
        </a>
      </p>
      <p style="margin: 0; font-size: 13px; color: #666666; line-height: 1.6;">
        If the button doesn't work, paste this into your browser:<br />
        <a href="${url}" style="color: #666666; word-break: break-all;">${url}</a>
      </p>
    </div>
  `;

  const text = [
    `You're invited to ${organizationName} on LetterStack`,
    "",
    `${inviter} invited you to join ${organizationName}. This link works once and expires in 7 days.`,
    "",
    url,
  ].join("\n");

  await sendEmail({
    to,
    subject: `You're invited to ${organizationName} on LetterStack`,
    html,
    text,
    fromName: "LetterStack",
    fromEmail: from,
  });
}
