import { afterEach, describe, expect, it, vi } from "vitest";
import {
  ApiError,
  NETWORK_ERROR_MESSAGE,
  errorMessage,
  errorMessageFrom,
  fetchJson,
} from "./fetch-json";

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("errorMessageFrom", () => {
  it("prefers the server's own error text", () => {
    expect(errorMessageFrom({ ok: false, error: "Verify your email to send" }, 403)).toBe(
      "Verify your email to send",
    );
  });

  it("explains common statuses when the body has no error", () => {
    expect(errorMessageFrom(null, 429)).toMatch(/too many requests/i);
    expect(errorMessageFrom({}, 401)).toMatch(/sign in/i);
    expect(errorMessageFrom(null, 0)).toBe(NETWORK_ERROR_MESSAGE);
  });

  it("uses the fallback for anything else", () => {
    expect(errorMessageFrom({ error: "  " }, 500, "Could not send")).toBe("Could not send");
  });
});

describe("fetchJson", () => {
  it("resolves with the body on an ok response", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => jsonResponse({ ok: true, items: [1] })));
    await expect(fetchJson<{ items: number[] }>("/api/x")).resolves.toEqual({
      ok: true,
      items: [1],
    });
  });

  it("throws the server's error when the body says ok: false", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => jsonResponse({ ok: false, error: "Monthly limit reached" }, 402)),
    );
    const error = await fetchJson("/api/x").catch((e) => e);
    expect(error).toBeInstanceOf(ApiError);
    expect(error.message).toBe("Monthly limit reached");
    expect(error.status).toBe(402);
  });

  it("treats ok: false as a failure even with a 200 status", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => jsonResponse({ ok: false, error: "Nope" })));
    await expect(fetchJson("/api/x")).rejects.toThrow("Nope");
  });

  it("reports network failures as status 0", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new TypeError("Failed to fetch");
      }),
    );
    const error = await fetchJson("/api/x").catch((e) => e);
    expect(error.status).toBe(0);
    expect(error.message).toBe(NETWORK_ERROR_MESSAGE);
  });

  it("handles a non-JSON error page", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("<html>Gateway Timeout</html>", { status: 504 })),
    );
    await expect(fetchJson("/api/x")).rejects.toThrow(/too long/i);
  });

  it("sends a json body with the right header", async () => {
    const spy = vi.fn(async (_url: string, _init?: RequestInit) => jsonResponse({ ok: true }));
    vi.stubGlobal("fetch", spy);
    await fetchJson("/api/x", { method: "POST", json: { email: "a@b.co" } });
    const init = spy.mock.calls[0][1]!;
    expect(init.body).toBe('{"email":"a@b.co"}');
    expect(init.headers).toEqual({ "Content-Type": "application/json" });
  });
});

describe("errorMessage", () => {
  it("reads ApiErrors and plain errors", () => {
    expect(errorMessage(new ApiError("Quota used up", 402))).toBe("Quota used up");
    expect(errorMessage(new TypeError("Failed to fetch"))).toBe(NETWORK_ERROR_MESSAGE);
    expect(errorMessage("weird", "Fallback")).toBe("Fallback");
  });
});
