import { describe, expect, it } from "vitest";
import { createDocument, STORAGE_KEY } from "@/lib/email/document";
import {
  clearAllLocalDrafts,
  clearLocalDraft,
  clearOtherUsersDrafts,
  discardCampaignHandoff,
  LEGACY_EDITING_CAMPAIGN_KEY,
  localDraftKey,
  readLocalDraft,
  takeEditorHandoff,
  writeLocalDraft,
  type DraftStorage,
} from "./local-draft";

function memoryStorage(initial: Record<string, string> = {}): DraftStorage & {
  data: Map<string, string>;
} {
  const data = new Map(Object.entries(initial));
  return {
    data,
    getItem: (key) => data.get(key) ?? null,
    setItem: (key, value) => void data.set(key, value),
    removeItem: (key) => void data.delete(key),
    key: (index) => Array.from(data.keys())[index] ?? null,
    get length() {
      return data.size;
    },
  };
}

const alice = { userId: "user-a", organizationId: "org-1" };

describe("localDraftKey", () => {
  it("scopes drafts by user, workspace and kind", () => {
    const keys = new Set([
      localDraftKey(alice, "template"),
      localDraftKey({ userId: "user-b", organizationId: "org-1" }, "template"),
      localDraftKey({ userId: "user-a", organizationId: "org-2" }, "template"),
      localDraftKey({ userId: "user-a", organizationId: null }, "template"),
    ]);
    expect(keys.size).toBe(4);
    expect(localDraftKey(alice, "template")).not.toBe(STORAGE_KEY);
  });
});

describe("local drafts", () => {
  it("round-trips a draft and its edited flag", () => {
    const storage = memoryStorage();
    const key = localDraftKey(alice, "template");
    const doc = createDocument({ name: "Spring sale" });
    writeLocalDraft(storage, key, { document: doc, edited: true });

    const draft = readLocalDraft(storage, key);
    expect(draft?.edited).toBe(true);
    expect(draft?.document.name).toBe("Spring sale");
  });

  it("is invisible to another user or workspace", () => {
    const storage = memoryStorage();
    writeLocalDraft(storage, localDraftKey(alice, "template"), {
      document: createDocument(),
      edited: true,
    });
    expect(
      readLocalDraft(storage, localDraftKey({ userId: "user-b", organizationId: "org-1" }, "template")),
    ).toBeNull();
    expect(
      readLocalDraft(storage, localDraftKey({ userId: "user-a", organizationId: "org-2" }, "template")),
    ).toBeNull();
  });

  it("drops a corrupt draft instead of throwing", () => {
    const key = localDraftKey(alice, "template");
    const storage = memoryStorage({ [key]: "{not json" });
    expect(readLocalDraft(storage, key)).toBeNull();
    expect(storage.data.has(key)).toBe(false);
  });

  it("clears one draft", () => {
    const storage = memoryStorage();
    const key = localDraftKey(alice, "template");
    writeLocalDraft(storage, key, { document: createDocument(), edited: false });
    clearLocalDraft(storage, key);
    expect(readLocalDraft(storage, key)).toBeNull();
  });
});

describe("takeEditorHandoff", () => {
  it("returns the gallery's document once, then nothing", () => {
    const doc = createDocument({ name: "Newsletter" });
    const storage = memoryStorage({ [STORAGE_KEY]: JSON.stringify(doc) });
    expect(takeEditorHandoff(storage)?.name).toBe("Newsletter");
    expect(takeEditorHandoff(storage)).toBeNull();
  });

  it("ignores and removes garbage", () => {
    const storage = memoryStorage({ [STORAGE_KEY]: "null" });
    expect(takeEditorHandoff(storage)).toBeNull();
    expect(storage.data.has(STORAGE_KEY)).toBe(false);
  });

  it("survives storage that throws", () => {
    const storage: DraftStorage = {
      getItem: () => {
        throw new Error("SecurityError");
      },
      setItem: () => {},
      removeItem: () => {
        throw new Error("SecurityError");
      },
      key: () => null,
      length: 0,
    };
    expect(takeEditorHandoff(storage)).toBeNull();
  });
});

describe("discardCampaignHandoff", () => {
  it("drops the copy the campaign page left before opening the editor", () => {
    const storage = memoryStorage({
      [STORAGE_KEY]: JSON.stringify(createDocument()),
      [LEGACY_EDITING_CAMPAIGN_KEY]: "camp-1",
    });
    discardCampaignHandoff(storage);
    expect(storage.data.size).toBe(0);
  });

  it("leaves a gallery handoff alone when the campaign page wrote nothing", () => {
    const storage = memoryStorage({ [STORAGE_KEY]: JSON.stringify(createDocument()) });
    discardCampaignHandoff(storage);
    expect(storage.data.has(STORAGE_KEY)).toBe(true);
  });
});

describe("clearOtherUsersDrafts", () => {
  it("keeps every draft of the signed-in user and removes everyone else's", () => {
    const storage = memoryStorage({ "theme-preference": "dark" });
    const own1 = localDraftKey(alice, "template");
    const own2 = localDraftKey({ userId: "user-a", organizationId: "org-2" }, "template");
    const other = localDraftKey({ userId: "user-b", organizationId: "org-1" }, "template");
    for (const key of [own1, own2, other]) {
      writeLocalDraft(storage, key, { document: createDocument(), edited: true });
    }

    clearOtherUsersDrafts(storage, "user-a");
    expect(storage.data.has(own1)).toBe(true);
    expect(storage.data.has(own2)).toBe(true);
    expect(storage.data.has(other)).toBe(false);
    expect(storage.data.has("theme-preference")).toBe(true);
  });
});

describe("clearAllLocalDrafts", () => {
  it("removes every draft and handoff but nothing else", () => {
    const storage = memoryStorage({
      [STORAGE_KEY]: "{}",
      [LEGACY_EDITING_CAMPAIGN_KEY]: "camp-1",
      "theme-preference": "dark",
    });
    writeLocalDraft(storage, localDraftKey(alice, "template"), {
      document: createDocument(),
      edited: true,
    });
    writeLocalDraft(storage, localDraftKey({ userId: "user-b", organizationId: null }, "template"), {
      document: createDocument(),
      edited: false,
    });

    clearAllLocalDrafts(storage);
    expect(Array.from(storage.data.keys())).toEqual(["theme-preference"]);
  });
});
