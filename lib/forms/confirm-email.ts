// The double opt-in confirmation email, sent through the same SES transport as
// campaigns. Deliberately plain, text-forward HTML — a utility email, not a
// designed newsletter, which also dodges spam filters. The recipient must click
// the link before they're ever added to the list.

import { sendEmail } from "@/lib/send/ses";
import type { SignupForm } from "@/db/signup-forms";

export async function sendSubscribeConfirmationEmail(
  form: SignupForm,
  to: string,
  confirmUrl: string,
) {
  const from = process.env.MAIL_FROM;
  if (!from) throw new Error("MAIL_FROM missing");

  const accent = /^#[0-9a-fA-F]{6}$/.test(form.accentColor)
    ? form.accentColor
    : "#4f46e5";

  const html = `
    <div style="font-family: -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif; max-width: 480px; margin: 0 auto; padding: 32px 16px; color: #1a1a1a;">
      <h2 style="margin: 0 0 16px; font-size: 20px;">Confirm your subscription</h2>
      <p style="margin: 0 0 16px; line-height: 1.6;">
        You asked to subscribe to <strong>${escapeHtml(form.headline)}</strong>.
        Click below to confirm — we won't send you anything until you do.
      </p>
      <p style="margin: 0 0 24px;">
        <a href="${confirmUrl}" style="display: inline-block; background: ${accent}; color: #ffffff; padding: 10px 20px; border-radius: 8px; text-decoration: none; font-weight: 600;">
          Confirm subscription
        </a>
      </p>
      <p style="margin: 0 0 8px; font-size: 13px; color: #666666; line-height: 1.6;">
        If the button doesn't work, paste this into your browser:<br />
        <a href="${confirmUrl}" style="color: #666666; word-break: break-all;">${confirmUrl}</a>
      </p>
      <p style="margin: 16px 0 0; font-size: 13px; color: #666666; line-height: 1.6;">
        Didn't request this? You can safely ignore this email — nothing will be
        sent and you won't be added to any list.
      </p>
    </div>
  `;

  const text = [
    "Confirm your subscription",
    "",
    `You asked to subscribe to "${form.headline}". Confirm with the link below —`,
    "we won't send you anything until you do.",
    "",
    confirmUrl,
    "",
    "Didn't request this? You can safely ignore this email.",
  ].join("\n");

  await sendEmail({
    to,
    subject: "Confirm your subscription",
    html,
    text,
    fromName: "LetterStack",
    fromEmail: from,
  });
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
