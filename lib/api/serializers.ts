/**
 * The public response shapes.
 *
 * These live in one file because they are the contract. An internal route
 * can return whatever its page happens to need and change next week; once an
 * outside integration parses a field, renaming it breaks their code. Keeping
 * the mapping here rather than inline in each route makes "this is a
 * breaking change" a visible edit to a visible file.
 *
 * camelCase, matching the rest of the codebase — consistency inside the
 * product is worth more than matching any particular vendor's house style.
 * Timestamps are ISO 8601 UTC strings, never epoch numbers, so they survive
 * JSON without a timezone argument.
 */

type RecipientRow = {
  id: string;
  email: string;
  name: string | null;
  createdAt: Date;
};

export type ApiContact = {
  id: string;
  email: string;
  name: string | null;
  createdAt: string;
};

export function serializeContact(row: RecipientRow): ApiContact {
  return {
    id: row.id,
    email: row.email,
    name: row.name,
    createdAt: row.createdAt.toISOString(),
  };
}

type CampaignRow = {
  id: string;
  name: string;
  subject: string;
  status: string;
  fromName: string;
  fromEmail: string;
  createdAt: Date;
  scheduledAt: Date | null;
  sentAt: Date | null;
  audienceCount?: number;
  sentCount?: number;
};

export type ApiCampaign = {
  id: string;
  name: string;
  subject: string;
  status: string;
  fromName: string;
  fromEmail: string;
  createdAt: string;
  scheduledAt: string | null;
  sentAt: string | null;
  audienceCount: number;
  sentCount: number;
};

export function serializeCampaign(row: CampaignRow): ApiCampaign {
  return {
    id: row.id,
    name: row.name,
    subject: row.subject,
    status: row.status,
    fromName: row.fromName,
    fromEmail: row.fromEmail,
    createdAt: row.createdAt.toISOString(),
    scheduledAt: row.scheduledAt?.toISOString() ?? null,
    sentAt: row.sentAt?.toISOString() ?? null,
    audienceCount: row.audienceCount ?? 0,
    sentCount: row.sentCount ?? 0,
  };
}
