// Version tokens for optimistic concurrency on editor saves.
//
// An editor loads a row together with its version, sends that version back
// with each save, and the UPDATE only matches if the row still has it. A tab
// that loaded the row before someone else saved gets a 409 instead of
// silently overwriting their work.
//
// The token is an md5 of the editable content, computed by Postgres, rather
// than an updated_at timestamp:
// - campaigns has no updated_at, and adding one needs a migration that must
//   run before the deploy, or every campaign query breaks.
// - email_templates.updated_at mixes precisions (microseconds from the column
//   default, milliseconds from the PATCH route's `new Date()`), so a value
//   round-tripped through JSON does not always compare equal.
// A content hash has neither problem, needs no schema change, and changes
// exactly when the content does. `jsonb::text` is canonical (sorted keys,
// fixed spacing), so the same document always hashes the same.

import { and, eq, getTableColumns, sql } from "drizzle-orm";
import { db } from "./client";
import { campaigns, emailTemplates } from "./schema";
import type { EmailDocument } from "@/lib/email/document";

/** Changes whenever the design or the fields an editor save can write change. */
export const campaignVersion = sql<string>`md5(concat_ws('|', ${campaigns.name}, ${campaigns.subject}, ${campaigns.fromName}, ${campaigns.fromEmail}, ${campaigns.document}::text))`;

/**
 * Templates are versioned on the design only. The template's name is changed
 * from the templates page, never by the editor's save, so a rename there
 * should not make an open editor tab think its design was overwritten.
 */
export const templateVersion = sql<string>`md5(coalesce(${emailTemplates.document}::text, ''))`;

export async function getCampaignVersion(id: string): Promise<string | null> {
  const [row] = await db
    .select({ version: campaignVersion })
    .from(campaigns)
    .where(eq(campaigns.id, id));
  return row?.version ?? null;
}

export async function getTemplateWithVersion(id: string, organizationId: string) {
  const [row] = await db
    .select({ ...getTableColumns(emailTemplates), version: templateVersion })
    .from(emailTemplates)
    .where(and(eq(emailTemplates.id, id), eq(emailTemplates.organizationId, organizationId)));
  if (!row) return null;
  const { version, ...template } = row;
  return { template, version };
}

/**
 * The editor's save: updateCampaignDraft (db/campaigns.ts) plus the version
 * guard. Same status rule — only drafts and scheduled campaigns change — and
 * the row must still have `expectedVersion`, or nothing is written and this
 * returns null. One guarded UPDATE, so the check and the write cannot be
 * split by a concurrent save (neon-http has no transactions to lean on).
 *
 * Kept beside the version expression rather than in db/campaigns.ts so the
 * two save paths can be folded together in one later change.
 */
export async function updateCampaignDraftAtVersion(
  id: string,
  organizationId: string,
  expectedVersion: string,
  input: {
    name: string;
    subject: string;
    fromName: string;
    fromEmail: string;
    html: string;
    text: string;
    document: EmailDocument;
    replyTo?: string | null;
    senderType?: string;
    mailboxId?: string | null;
  },
) {
  const [row] = await db
    .update(campaigns)
    .set({
      name: input.name,
      subject: input.subject,
      fromName: input.fromName,
      fromEmail: input.fromEmail,
      ...(input.replyTo !== undefined ? { replyTo: input.replyTo } : {}),
      ...(input.senderType !== undefined ? { senderType: input.senderType } : {}),
      ...(input.mailboxId !== undefined ? { mailboxId: input.mailboxId } : {}),
      document: input.document,
      htmlSnapshot: input.html,
      textSnapshot: input.text,
    })
    .where(
      and(
        eq(campaigns.id, id),
        eq(campaigns.organizationId, organizationId),
        sql`${campaigns.status} in ('draft', 'scheduled')`,
        sql`${campaignVersion} = ${expectedVersion}`,
      ),
    )
    .returning({ ...getTableColumns(campaigns), version: campaignVersion });

  if (!row) return null;
  const { version, ...campaign } = row;
  return { campaign, version };
}
