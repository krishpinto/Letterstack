import { describe, expect, it } from "vitest";
import { isHardBounce, parseSesEvent, readIdTag } from "./ses-event";

const CAMPAIGN = "5f0c3f43-6d1c-4b5a-9a43-3d3f2f0f7c11";
const AUTOMATION = "9b2e7d6a-0c4f-4e1b-8f5a-2a1d3c4b5e6f";

function bounce(bounceType: string, emails: string[], tags: Record<string, string[]> = {}) {
  return {
    eventType: "Bounce",
    bounce: {
      bounceType,
      bouncedRecipients: emails.map((emailAddress) => ({ emailAddress })),
    },
    mail: { destination: emails, tags },
  };
}

describe("isHardBounce", () => {
  it("is true only for Permanent bounces", () => {
    expect(isHardBounce("Permanent")).toBe(true);
    expect(isHardBounce("Transient")).toBe(false);
    expect(isHardBounce("Undetermined")).toBe(false);
    expect(isHardBounce(undefined)).toBe(false);
  });
});

describe("parseSesEvent", () => {
  it("suppresses every recipient of a hard bounce", () => {
    const event = parseSesEvent(bounce("Permanent", ["a@example.com", "b@example.com"]));
    expect(event?.type).toBe("Bounce");
    expect(event?.recipients).toEqual([
      { email: "a@example.com", suppress: true },
      { email: "b@example.com", suppress: true },
    ]);
  });

  it("records soft bounces without suppressing them", () => {
    for (const type of ["Transient", "Undetermined"]) {
      expect(parseSesEvent(bounce(type, ["a@example.com"]))?.recipients).toEqual([
        { email: "a@example.com", suppress: false },
      ]);
    }
  });

  it("suppresses every complained recipient", () => {
    const event = parseSesEvent({
      eventType: "Complaint",
      complaint: {
        complainedRecipients: [{ emailAddress: "a@example.com" }, { emailAddress: "b@example.com" }],
      },
      mail: { destination: ["a@example.com", "b@example.com"] },
    });
    expect(event?.recipients.map((r) => r.suppress)).toEqual([true, true]);
    expect(event?.recipients.map((r) => r.email)).toEqual(["a@example.com", "b@example.com"]);
  });

  it("never suppresses on a guess when SES names nobody", () => {
    const event = parseSesEvent({
      eventType: "Bounce",
      bounce: { bounceType: "Permanent", bouncedRecipients: [] },
      mail: { destination: ["a@example.com"] },
    });
    expect(event?.recipients).toEqual([{ email: "a@example.com", suppress: false }]);
  });

  it("reads identity notifications (notificationType) the same way", () => {
    const event = parseSesEvent({
      notificationType: "Bounce",
      bounce: { bounceType: "Permanent", bouncedRecipients: [{ emailAddress: "a@example.com" }] },
      mail: { destination: ["a@example.com"] },
    });
    expect(event?.recipients).toEqual([{ email: "a@example.com", suppress: true }]);
  });

  it("takes Delivery recipients from the delivery block and opens from the destination", () => {
    const delivery = parseSesEvent({
      eventType: "Delivery",
      delivery: { recipients: ["a@example.com"] },
      mail: { destination: ["a@example.com", "b@example.com"] },
    });
    expect(delivery?.recipients).toEqual([{ email: "a@example.com", suppress: false }]);

    const open = parseSesEvent({ eventType: "Open", mail: { destination: ["a@example.com"] } });
    expect(open?.recipients).toEqual([{ email: "a@example.com", suppress: false }]);
  });

  it("deduplicates recipients and skips non-string addresses", () => {
    const event = parseSesEvent({
      eventType: "Bounce",
      bounce: {
        bounceType: "Permanent",
        bouncedRecipients: [
          { emailAddress: "a@example.com" },
          { emailAddress: "a@example.com" },
          { emailAddress: 42 },
          null,
        ],
      },
    });
    expect(event?.recipients).toEqual([{ email: "a@example.com", suppress: true }]);
  });

  it("returns null for a message that isn't an object", () => {
    expect(parseSesEvent(null)).toBeNull();
    expect(parseSesEvent("Bounce")).toBeNull();
    expect(parseSesEvent([])).toBeNull();
  });

  it("carries the campaign and automation tags", () => {
    const event = parseSesEvent(
      bounce("Permanent", ["a@example.com"], {
        campaignId: [CAMPAIGN],
        automationId: [AUTOMATION],
      }),
    );
    expect(event?.campaignId).toBe(CAMPAIGN);
    expect(event?.automationId).toBe(AUTOMATION);
  });
});

describe("readIdTag", () => {
  it("ignores tags that aren't uuids, so the events insert can't fail on them", () => {
    const event = { mail: { tags: { campaignId: ["not-a-uuid"], type: ["invoice"] } } };
    expect(readIdTag(event, "campaignId")).toBeNull();
    expect(readIdTag(event, "type")).toBeNull();
    expect(readIdTag({}, "campaignId")).toBeNull();
    expect(readIdTag({ mail: { tags: { campaignId: "scalar" } } }, "campaignId")).toBeNull();
  });
});
