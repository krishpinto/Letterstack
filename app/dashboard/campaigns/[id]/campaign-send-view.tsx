// This file has been replaced by campaign-detail.tsx.
// Kept as a stub so any stale imports don't hard-crash during migration.
// Safe to delete once you confirm nothing else imports from here.

export type DraftCampaign = {
  id: string;
  name: string;
  subject: string;
  fromName: string;
  fromEmail: string;
  status: string;
  htmlSnapshot: string;
  document: import("@/lib/email/document").EmailDocument | null;
};
