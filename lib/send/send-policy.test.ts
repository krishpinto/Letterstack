import { describe, expect, it } from "vitest";
import {
  classifySendError,
  decideCampaignOutcome,
  nextGmailChunk,
  planBatches,
  type RecipientState,
} from "./send-policy";

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

describe("classifySendError", () => {
  const awsError = (name: string, httpStatusCode: number, message = name) =>
    Object.assign(new Error(message), { name, $metadata: { httpStatusCode } });

  it("retries SES throttling and server errors", () => {
    expect(classifySendError(awsError("TooManyRequestsException", 429)).retryable).toBe(true);
    expect(classifySendError(awsError("ThrottlingException", 400)).retryable).toBe(true);
    expect(classifySendError(awsError("LimitExceededException", 400)).retryable).toBe(true);
    expect(classifySendError(awsError("InternalFailure", 500)).retryable).toBe(true);
    expect(classifySendError(awsError("Whatever", 503)).retryable).toBe(true);
  });

  it("retries network failures", () => {
    const reset = Object.assign(new Error("socket hang up"), { code: "ECONNRESET" });
    expect(classifySendError(reset).retryable).toBe(true);
  });

  it("retries Gmail rate limits and 5xx by status", () => {
    expect(classifySendError(Object.assign(new Error("Rate limit"), { status: 429 })).retryable).toBe(true);
    expect(classifySendError(Object.assign(new Error("Backend"), { code: 500 })).retryable).toBe(true);
  });

  it("fails permanently on rejections, with the provider's message", () => {
    const rejected = awsError("MessageRejected", 400, "Email address is not verified.");
    expect(classifySendError(rejected)).toEqual({
      retryable: false,
      reason: "Email address is not verified.",
    });
    expect(classifySendError(awsError("MailFromDomainNotVerifiedException", 400)).retryable).toBe(false);
    expect(classifySendError(awsError("BadRequestException", 400)).retryable).toBe(false);
  });

  it("treats an unknown throw as permanent", () => {
    expect(classifySendError("boom")).toEqual({ retryable: false, reason: "Unknown error" });
  });
});

describe("nextGmailChunk", () => {
  const ids = ["a", "b", "c", "d", "e"];

  it("walks a run in fixed chunks and stops at the end", () => {
    expect(nextGmailChunk(ids, 0, 2)).toEqual({ chunk: ["a", "b"], nextOffset: 2 });
    expect(nextGmailChunk(ids, 2, 2)).toEqual({ chunk: ["c", "d"], nextOffset: 4 });
    expect(nextGmailChunk(ids, 4, 2)).toEqual({ chunk: ["e"], nextOffset: null });
  });

  it("ends exactly on the last id", () => {
    expect(nextGmailChunk(["a", "b"], 0, 2)).toEqual({ chunk: ["a", "b"], nextOffset: null });
  });

  it("is empty past the end", () => {
    expect(nextGmailChunk(ids, 9, 2)).toEqual({ chunk: [], nextOffset: null });
  });
});
