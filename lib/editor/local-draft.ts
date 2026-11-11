// Drafts the editor keeps in the browser, and the one-shot handoff the
// templates gallery uses to open a document in /editor.
//
// Before this module, every editor (campaign, template, new template) wrote
// its document into one global key, STORAGE_KEY. /editor read that key on
// mount, so "New template" opened whatever campaign was edited last — or a
// previous user's campaign on a shared browser — and "Save as template" could
// copy it into another workspace.
//
// The rules now:
// - Editors with a server copy (campaigns, saved templates) never write to
//   the browser. The server is their only store.
// - STORAGE_KEY is only a handoff: the gallery writes the chosen document,
//   /editor reads it once and deletes it.
// - The only lasting browser draft is the unsaved /editor document, under a
//   key scoped to the user, the workspace and the kind of document.
// - Sign-out removes all of it.

import {
  isEmailDocument,
  normalizeDocument,
  STORAGE_KEY,
  type EmailDocument,
} from "@/lib/email/document";

/** Written by the campaign page next to STORAGE_KEY when it opens the editor. */
export const LEGACY_EDITING_CAMPAIGN_KEY = "letterstack-editing-campaign";

const DRAFT_PREFIX = "letterstack:draft:v2:";

export type DraftScope = {
  userId: string;
  /** Null when the user has no workspace yet. */
  organizationId: string | null;
};

export type DraftKind = "template";

/** The subset of the Web Storage API used here, so tests can pass a fake. */
export type DraftStorage = Pick<Storage, "getItem" | "setItem" | "removeItem" | "key" | "length">;

export type LocalDraft = {
  document: EmailDocument;
  /**
   * False while the draft is still exactly what the gallery handed over.
   * Only an edited draft is worth asking about before replacing it.
   */
  edited: boolean;
};

export function localDraftKey(scope: DraftScope, kind: DraftKind): string {
  return `${DRAFT_PREFIX}${scope.userId}:${scope.organizationId ?? "none"}:${kind}`;
}

function parseDocument(raw: string | null): EmailDocument | null {
  if (!raw || raw === "null") return null;
  try {
    const parsed: unknown = JSON.parse(raw);
    return isEmailDocument(parsed) ? normalizeDocument(parsed) : null;
  } catch {
    return null;
  }
}

// Storage can throw (private mode, quota, blocked site data). Every access
// goes through these so a broken storage degrades to "no draft".
function safeGet(storage: DraftStorage, key: string): string | null {
  try {
    return storage.getItem(key);
  } catch {
    return null;
  }
}

function safeRemove(storage: DraftStorage, key: string) {
  try {
    storage.removeItem(key);
  } catch {
    // Nothing useful to do.
  }
}

export function readLocalDraft(storage: DraftStorage, key: string): LocalDraft | null {
  const raw = safeGet(storage, key);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<LocalDraft> | null;
    if (parsed && isEmailDocument(parsed.document)) {
      return { document: normalizeDocument(parsed.document), edited: parsed.edited === true };
    }
  } catch {
    // Corrupt: fall through and drop it.
  }
  safeRemove(storage, key);
  return null;
}

/** Throws if storage is unavailable or full, so the caller can report it. */
export function writeLocalDraft(storage: DraftStorage, key: string, draft: LocalDraft) {
  storage.setItem(key, JSON.stringify(draft));
}

export function clearLocalDraft(storage: DraftStorage, key: string) {
  safeRemove(storage, key);
}

/**
 * Reads and deletes the document the templates gallery left for /editor.
 * Deleting it is what keeps the next /editor visit from reopening it.
 */
export function takeEditorHandoff(storage: DraftStorage): EmailDocument | null {
  const doc = parseDocument(safeGet(storage, STORAGE_KEY));
  safeRemove(storage, STORAGE_KEY);
  safeRemove(storage, LEGACY_EDITING_CAMPAIGN_KEY);
  return doc;
}

/**
 * The campaign page still writes the campaign into STORAGE_KEY (and its id
 * into LEGACY_EDITING_CAMPAIGN_KEY) right before opening /editor/<id>. The
 * campaign editor loads from the server, so that copy is only a leak waiting
 * for the next /editor visit. Drop it whenever the marker is there, whatever
 * campaign it names: the page writes both keys and navigates straight here,
 * so a marker for another campaign means an older copy that is just as stale.
 */
export function discardCampaignHandoff(storage: DraftStorage) {
  if (safeGet(storage, LEGACY_EDITING_CAMPAIGN_KEY) === null) return;
  safeRemove(storage, STORAGE_KEY);
  safeRemove(storage, LEGACY_EDITING_CAMPAIGN_KEY);
}

function draftKeys(storage: DraftStorage): string[] {
  const keys: string[] = [];
  try {
    for (let i = 0; i < storage.length; i += 1) {
      const key = storage.key(i);
      if (key?.startsWith(DRAFT_PREFIX)) keys.push(key);
    }
  } catch {
    // Return whatever was collected.
  }
  return keys;
}

/** Removes every editor draft and handoff in this browser. Used on sign-out. */
export function clearAllLocalDrafts(storage: DraftStorage) {
  for (const key of draftKeys(storage)) safeRemove(storage, key);
  safeRemove(storage, STORAGE_KEY);
  safeRemove(storage, LEGACY_EDITING_CAMPAIGN_KEY);
}

/**
 * Removes drafts that belong to anyone but `userId`. Sign-out clears drafts,
 * but a session can also end without it (expiry, a cleared cookie), so the
 * next person to open /editor in this browser cleans up after the last one.
 */
export function clearOtherUsersDrafts(storage: DraftStorage, userId: string) {
  const own = `${DRAFT_PREFIX}${userId}:`;
  for (const key of draftKeys(storage)) {
    if (!key.startsWith(own)) safeRemove(storage, key);
  }
}

/** clearAllLocalDrafts for this browser, safe to call anywhere (no-op on the server). */
export function clearEditorDraftsOnThisDevice() {
  try {
    if (typeof window === "undefined") return;
    clearAllLocalDrafts(window.localStorage);
  } catch {
    // Storage blocked: there is nothing stored to clear.
  }
}
