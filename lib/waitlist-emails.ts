// Early-access waitlist transactional emails. Same transport and plain-HTML
// style as lib/auth-emails.ts.

import { sendEmail } from "@/lib/send/ses";
import { appBaseUrl } from "@/lib/send/qstash";

export async function sendWaitlistAppliedEmail(to: string, name: string | null) {
  const from = process.env.MAIL_FROM;
  if (!from) throw new Error("MAIL_FROM missing");

  const greeting = name ? `Hi ${name},` : "Hi,";

  const html = `
    <div style="font-family: -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif; max-width: 480px; margin: 0 auto; padding: 32px 16px; color: #1a1a1a;">
      <h2 style="margin: 0 0 16px; font-size: 20px;">You're on the LetterStack waitlist</h2>
      <p style="margin: 0 0 16px; line-height: 1.6;">
        ${greeting}
      </p>
      <p style="margin: 0 0 16px; line-height: 1.6;">
        Thanks for signing up. We're letting in a small number of beta orgs
        at a time, so we can't give everyone instant access yet — but your
        account is in the queue.
      </p>
      <p style="margin: 0; line-height: 1.6;">
        You'll get an email the moment your account is approved. No need to
        do anything else for now.
      </p>
    </div>
  `;

  const text = [
    "You're on the LetterStack waitlist",
    "",
    greeting,
    "",
    "Thanks for signing up. We're letting in a small number of beta orgs at a time, so we can't give everyone instant access yet — but your account is in the queue.",
    "",
    "You'll get an email the moment your account is approved. No need to do anything else for now.",
  ].join("\n");

  await sendEmail({
    to,
    subject: "You're on the LetterStack waitlist",
    html,
    text,
    fromName: "LetterStack",
    fromEmail: from,
  });
}

export async function sendWaitlistApprovedEmail(to: string, name: string | null) {
  const from = process.env.MAIL_FROM;
  if (!from) throw new Error("MAIL_FROM missing");

  const greeting = name ? `Hi ${name},` : "Hi,";
  const url = `${appBaseUrl()}/login`;

  const html = `
    <div style="font-family: -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif; max-width: 480px; margin: 0 auto; padding: 32px 16px; color: #1a1a1a;">
      <h2 style="margin: 0 0 16px; font-size: 20px;">You're in — welcome to LetterStack</h2>
      <p style="margin: 0 0 16px; line-height: 1.6;">
        ${greeting}
      </p>
      <p style="margin: 0 0 24px; line-height: 1.6;">
        Your account has been approved. Log back in to set up your
        organization and start building your first campaign.
      </p>
      <p style="margin: 0 0 24px;">
        <a href="${url}" style="display: inline-block; background: #1a1a1a; color: #ffffff; padding: 10px 20px; border-radius: 8px; text-decoration: none; font-weight: 600;">
          Log in to LetterStack
        </a>
      </p>
      <p style="margin: 0; font-size: 13px; color: #666666; line-height: 1.6;">
        If the button doesn't work, paste this into your browser:<br />
        <a href="${url}" style="color: #666666; word-break: break-all;">${url}</a>
      </p>
    </div>
  `;

  const text = [
    "You're in — welcome to LetterStack",
    "",
    greeting,
    "",
    "Your account has been approved. Log back in to set up your organization and start building your first campaign.",
    "",
    url,
  ].join("\n");

  await sendEmail({
    to,
    subject: "You're in — welcome to LetterStack",
    html,
    text,
    fromName: "LetterStack",
    fromEmail: from,
  });
}
