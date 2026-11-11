import { describe, expect, it, vi } from "vitest";

// rate-limit.ts imports the database client, which refuses to load without
// DATABASE_URL. The pure window logic under test never touches it.
vi.mock("@/db/client", () => ({ db: {} }));

import { applyHit, clientIp, evaluate } from "./rate-limit";

const MINUTE = 60_000;
const t = (ms: number) => new Date(Date.UTC(2026, 0, 1) + ms);

describe("applyHit", () => {
  it("starts a window on the first hit", () => {
    expect(applyHit(null, t(0), MINUTE)).toEqual({ windowStart: t(0), count: 1 });
  });

  it("counts up inside the window", () => {
    const state = applyHit({ windowStart: t(0), count: 3 }, t(59_999), MINUTE);
    expect(state).toEqual({ windowStart: t(0), count: 4 });
  });

  it("resets once the full window has elapsed", () => {
    const state = applyHit({ windowStart: t(0), count: 99 }, t(MINUTE), MINUTE);
    expect(state).toEqual({ windowStart: t(MINUTE), count: 1 });
  });
});

describe("evaluate", () => {
  const rule = { limit: 3, windowMs: MINUTE };

  it("allows up to the limit", () => {
    expect(evaluate({ windowStart: t(0), count: 3 }, t(10), rule)).toEqual({
      ok: true,
      retryAfterSeconds: 0,
    });
  });

  it("blocks past the limit and says when the window resets", () => {
    const result = evaluate({ windowStart: t(0), count: 4 }, t(20_000), rule);
    expect(result).toEqual({ ok: false, retryAfterSeconds: 40 });
  });

  it("never reports a zero retry while blocked", () => {
    const result = evaluate({ windowStart: t(0), count: 4 }, t(MINUTE - 1), rule);
    expect(result.retryAfterSeconds).toBe(1);
  });

  it("blocks the hit after the limit in a sequence", () => {
    let state = null;
    const verdicts: boolean[] = [];
    for (let i = 0; i < 5; i++) {
      state = applyHit(state, t(i * 1000), MINUTE);
      verdicts.push(evaluate(state, t(i * 1000), rule).ok);
    }
    expect(verdicts).toEqual([true, true, true, false, false]);
  });
});

describe("clientIp", () => {
  it("prefers x-real-ip", () => {
    const headers = new Headers({ "x-real-ip": "1.1.1.1", "x-forwarded-for": "2.2.2.2" });
    expect(clientIp(headers)).toBe("1.1.1.1");
  });

  it("falls back to the first x-forwarded-for entry", () => {
    const headers = new Headers({ "x-forwarded-for": "2.2.2.2, 10.0.0.1" });
    expect(clientIp(headers)).toBe("2.2.2.2");
  });

  it("buckets callers with no address together", () => {
    expect(clientIp(new Headers())).toBe("unknown");
  });
});
