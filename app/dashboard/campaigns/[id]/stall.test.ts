import { describe, expect, it } from "vitest";
import { STALL_THRESHOLD_MS, trackStall } from "./stall";

const MINUTE = 60_000;

describe("trackStall", () => {
  it("starts tracking on the first poll", () => {
    const result = trackStall(null, { sent: 0, failed: 0, pending: 10 }, 0);
    expect(result.stalled).toBe(false);
    expect(result.tracker).toEqual({ done: 0, since: 0 });
  });

  it("is not stalled during a normal QStash retry backoff", () => {
    let { tracker } = trackStall(null, { sent: 50, failed: 0, pending: 50 }, 0);
    const result = trackStall(tracker, { sent: 50, failed: 0, pending: 50 }, 2 * MINUTE);
    tracker = result.tracker;
    expect(result.stalled).toBe(false);
  });

  it("is stalled after the threshold with no progress", () => {
    const { tracker } = trackStall(null, { sent: 50, failed: 0, pending: 50 }, 0);
    expect(
      trackStall(tracker, { sent: 50, failed: 0, pending: 50 }, STALL_THRESHOLD_MS).stalled,
    ).toBe(true);
  });

  it("resets when anything finishes, failures included", () => {
    const { tracker } = trackStall(null, { sent: 50, failed: 0, pending: 50 }, 0);
    const result = trackStall(tracker, { sent: 50, failed: 1, pending: 49 }, 10 * MINUTE);
    expect(result.stalled).toBe(false);
    expect(result.tracker).toEqual({ done: 51, since: 10 * MINUTE });
  });

  it("is never stalled with nothing pending", () => {
    const { tracker } = trackStall(null, { sent: 100, failed: 0, pending: 0 }, 0);
    expect(trackStall(tracker, { sent: 100, failed: 0, pending: 0 }, 60 * MINUTE).stalled).toBe(
      false,
    );
  });
});
