/**
 * The shared markup for a notification email.
 *
 * Nothing to do with lib/email/compiler.ts, which is the only thing allowed
 * to build *campaign* HTML from an EmailDocument. These are our own
 * transactional notes to a customer — a handful of facts and a link — and
 * running them through the block compiler would mean inventing a document
 * just to render a table. Same reasoning as lib/auth-emails.ts.
 *
 * Inline styles and a table, like everything else that has to survive a mail
 * client.
 */

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export type NotificationEmail = { html: string; text: string };

export function renderNotificationEmail(input: {
  heading: string;
  lead?: string;
  subhead?: string;
  facts: [string, string][];
  /** Shown above the button, for anything the reader should act on. */
  note?: string;
  action?: { label: string; href: string };
  /** Why this email arrived, and where to turn it off. */
  footer: string;
}): NotificationEmail {
  const { heading, lead, subhead, facts, note, action, footer } = input;

  const html = `
    <div style="font-family: -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif; max-width: 480px; margin: 0 auto; padding: 32px 16px; color: #1a1a1a;">
      <h2 style="margin: 0 0 4px; font-size: 18px;">${escapeHtml(heading)}</h2>
      ${
        lead
          ? `<p style="margin: 0 0 20px; font-size: 15px; line-height: 1.5;">
              <strong>${escapeHtml(lead)}</strong>${
                subhead
                  ? `<br /><span style="color: #666666; font-size: 13px;">${escapeHtml(subhead)}</span>`
                  : ""
              }
            </p>`
          : ""
      }
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
      ${
        note
          ? `<p style="margin: 20px 0 0; padding: 12px 14px; background: #fff8e1; border-radius: 8px; font-size: 13px; line-height: 1.5;">${escapeHtml(note)}</p>`
          : ""
      }
      ${
        action
          ? `<p style="margin: 24px 0 0;">
              <a href="${action.href}" style="display: inline-block; background: #1a1a1a; color: #ffffff; padding: 10px 20px; border-radius: 8px; text-decoration: none; font-weight: 600;">
                ${escapeHtml(action.label)}
              </a>
            </p>`
          : ""
      }
      <p style="margin: 28px 0 0; color: #999999; font-size: 12px; line-height: 1.5;">${escapeHtml(footer)}</p>
    </div>
  `;

  const text = [
    heading,
    "",
    ...(lead ? [lead] : []),
    ...(subhead ? [subhead] : []),
    ...(lead || subhead ? [""] : []),
    ...facts.map(([label, value]) => `${label}: ${value}`),
    ...(note ? ["", note] : []),
    ...(action ? ["", `${action.label}: ${action.href}`] : []),
    "",
    footer,
  ].join("\n");

  return { html, text };
}
