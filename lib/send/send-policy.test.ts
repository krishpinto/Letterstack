import { describe, expect, it } from "vitest";
import { decideCampaignOutcome, planBatches, type RecipientState } from "./send-policy";

const counts = (over: Partial<Parameters<typeof decideCampaignOutcome>[0]>) => ({
  pending: 0,
  sending: 0,
  sent: 0,
  failed: 0,
  ...over,
});

describe("decideCampaignOutcome", () => {
  it("keeps a campaign open while anything is pending or in flight", () => {
    expect(decideCampaignOutcome(counts({ pending: 1, sent: 5 }))).toBe("in_progress");
    expect(decideCampaignOutcome(counts({ sending: 1, sent: 5 }))).toBe("in_progress");
  });

  it("closes a campaign once every recipient has an outcome", () => {
    expect(decideCampaignOutcome(counts({ sent: 5, failed: 1 }))).toBe("sent");
  });

  it("calls a campaign that reached nobody failed", () => {
    expect(decideCampaignOutcome(counts({ failed: 3 }))).toBe("failed");
    expect(decideCampaignOutcome(counts({ sent: 1, failed: 3 }))).toBe("sent");
  });
});

const rows = (spec: string): RecipientState[] =>
  // One character per row: p = pending, s = sent, f = failed, i = in flight.
  [...spec].map((c, i) => ({
    id: `r${String(i).padStart(2, "0")}`,
    status: { p: "pending", s: "sent", f: "failed", i: "sending" }[c]!,
  }));

const plan = (recipients: RecipientState[], dispatchKey = "k1") =>
  planBatches({ campaignId: "c1", dispatchKey, recipients, size: 3, staggerMs: 4000, nowMs: 1000 });

describe("planBatches", () => {
  it("cuts batches over every row so batch N always means the same people", () => {
    const fresh = plan(rows("ppppppp"));
    // The first batch has gone out since; the others must keep their index.
    const later = plan(rows("sssppfp"));

    expect(fresh.map((b) => b.index)).toEqual([0, 1, 2]);
    expect(later.map((b) => b.index)).toEqual([1, 2]);
    expect(later[0].deduplicationId).toBe(fresh[1].deduplicationId);
    expect(later[0].ids).toEqual(["r03", "r04"]);
  });

  it("carries only pending ids and skips finished batches entirely", () => {
    const batches = plan(rows("sfippi"));

    expect(batches).toHaveLength(1);
    expect(batches[0].ids).toEqual(["r03", "r04"]);
  });

  it("staggers by position among queued batches, first one immediate", () => {
    const batches = plan(rows("sssppppp"));

    expect(batches.map((b) => b.notBeforeMs)).toEqual([undefined, 5000]);
  });

  it("gives a new round new deduplication ids", () => {
    const a = plan(rows("pppp"), "k1");
    const b = plan(rows("pppp"), "k2");

    expect(a[0].deduplicationId).toBe("c1-k1-b0");
    expect(b[0].deduplicationId).toBe("c1-k2-b0");
  });

  it("does not depend on the order rows arrive in", () => {
    const ordered = rows("pppppp");
    const shuffled = [ordered[4], ordered[0], ordered[5], ordered[2], ordered[1], ordered[3]];

    expect(plan(shuffled)).toEqual(plan(ordered));
  });
});
