// The four campaign fields that live twice: as columns on the campaign row,
// and as copies inside its document. The campaign page edits them through the
// columns; the editor edits them through the document.
//
// The editor's PATCH used to copy all four from the submitted document, so an
// editor tab opened before the sender was changed on the campaign page put
// the old sender back on its next autosave. Now the editor sends only the
// fields it changed itself, and the server keeps the stored value for the
// rest. The version check (db/content-version.ts) catches the case where the
// same field was changed in both places.

export const CAMPAIGN_FIELDS = ["name", "subject", "fromName", "fromEmail"] as const;

export type CampaignField = (typeof CAMPAIGN_FIELDS)[number];
export type CampaignFields = Record<CampaignField, string>;

export function pickCampaignFields(source: CampaignFields): CampaignFields {
  return {
    name: source.name,
    subject: source.subject,
    fromName: source.fromName,
    fromEmail: source.fromEmail,
  };
}

/** Client side: the fields `doc` changed relative to the last saved values. */
export function changedCampaignFields(
  doc: CampaignFields,
  baseline: CampaignFields,
): Partial<CampaignFields> {
  const changed: Partial<CampaignFields> = {};
  for (const key of CAMPAIGN_FIELDS) {
    if (doc[key] !== baseline[key]) changed[key] = doc[key];
  }
  return changed;
}

/**
 * Server side, for a versioned (editor) save: an explicit string in the body
 * wins, anything absent keeps the stored value. An empty sender address keeps
 * the stored one too, because a campaign always needs a From address
 * (updateCampaignDraft has the same rule).
 */
export function resolveEditorFields(body: unknown, stored: CampaignFields): CampaignFields {
  const input = (body && typeof body === "object" ? body : {}) as Record<string, unknown>;
  const pick = (key: CampaignField) =>
    typeof input[key] === "string" ? (input[key] as string) : stored[key];
  return {
    name: pick("name"),
    subject: pick("subject"),
    fromName: pick("fromName"),
    fromEmail: pick("fromEmail") || stored.fromEmail,
  };
}

/**
 * Returns `doc` with its copies of the fields set to `fields`, so the stored
 * document never disagrees with the columns. Returns `doc` itself when they
 * already match, so the caller can skip recompiling.
 */
export function withCampaignFields<D extends CampaignFields>(doc: D, fields: CampaignFields): D {
  const same = CAMPAIGN_FIELDS.every((key) => doc[key] === fields[key]);
  return same ? doc : { ...doc, ...fields };
}
