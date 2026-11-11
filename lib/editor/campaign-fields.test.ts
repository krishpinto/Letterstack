import { describe, expect, it } from "vitest";
import {
  changedCampaignFields,
  resolveEditorFields,
  withCampaignFields,
} from "./campaign-fields";

const stored = {
  name: "Spring sale",
  subject: "20% off",
  fromName: "Shop",
  fromEmail: "news@shop.example",
};

describe("changedCampaignFields", () => {
  it("returns nothing when the editor changed nothing", () => {
    expect(changedCampaignFields({ ...stored }, stored)).toEqual({});
  });

  it("returns only the fields the editor changed", () => {
    expect(changedCampaignFields({ ...stored, subject: "30% off" }, stored)).toEqual({
      subject: "30% off",
    });
  });
});

describe("resolveEditorFields", () => {
  it("keeps the stored values for fields the editor did not send", () => {
    // The editor's document still holds the old sender, but it did not send
    // it, so the sender changed on the campaign page survives.
    const next = resolveEditorFields({ document: {}, subject: "New" }, {
      ...stored,
      fromEmail: "changed@shop.example",
    });
    expect(next).toEqual({ ...stored, subject: "New", fromEmail: "changed@shop.example" });
  });

  it("never clears the sender address", () => {
    expect(resolveEditorFields({ fromEmail: "" }, stored).fromEmail).toBe(stored.fromEmail);
  });

  it("ignores non-string values and a missing body", () => {
    expect(resolveEditorFields({ name: 42 }, stored)).toEqual(stored);
    expect(resolveEditorFields(null, stored)).toEqual(stored);
  });
});

describe("withCampaignFields", () => {
  it("returns the same document when the copies already match", () => {
    const doc = { ...stored, blocks: [] };
    expect(withCampaignFields(doc, stored)).toBe(doc);
  });

  it("aligns stale copies with the stored fields", () => {
    const doc = { ...stored, fromEmail: "old@shop.example", blocks: [] };
    const next = withCampaignFields(doc, stored);
    expect(next).not.toBe(doc);
    expect(next.fromEmail).toBe(stored.fromEmail);
    expect(next.blocks).toBe(doc.blocks);
  });
});
