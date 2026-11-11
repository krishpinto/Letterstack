import { describe, expect, it } from "vitest";
import {
  IDLE_REFRESH_MS,
  LIVE_REFRESH_MS,
  formatUpdatedAgo,
  refreshDelay,
} from "./refresh";

describe("refreshDelay", () => {
  it("polls fast while a send is live and slowly afterwards", () => {
    expect(refreshDelay(true)).toBe(LIVE_REFRESH_MS);
    expect(refreshDelay(false)).toBe(IDLE_REFRESH_MS);
    expect(IDLE_REFRESH_MS).toBe(60_000);
  });
});

describe("formatUpdatedAgo", () => {
  const now = 10_000_000;

  it("says when nothing has loaded yet", () => {
    expect(formatUpdatedAgo(null, now)).toBe("Not updated yet");
  });

  it("rounds to just now, minutes, hours and days", () => {
    expect(formatUpdatedAgo(now - 5_000, now)).toBe("Updated just now");
    expect(formatUpdatedAgo(now - 3 * 60_000, now)).toBe("Updated 3 min ago");
    expect(formatUpdatedAgo(now - 2 * 3_600_000, now)).toBe("Updated 2 h ago");
    expect(formatUpdatedAgo(now - 3 * 86_400_000, now)).toBe("Updated 3 d ago");
  });

  it("treats a clock that runs behind as just now", () => {
    expect(formatUpdatedAgo(now + 5_000, now)).toBe("Updated just now");
  });
});
