// Which campaigns the editor may change. Mirrors the status guard in
// updateCampaignDraft (db/campaigns.ts): scheduled campaigns stay editable
// because the send reads the snapshot at fire time; anything that has started
// sending is a record of what went out and must not change.
export const EDITABLE_CAMPAIGN_STATUSES: readonly string[] = ["draft", "scheduled"];

export function isCampaignEditable(status: string): boolean {
  return EDITABLE_CAMPAIGN_STATUSES.includes(status);
}
