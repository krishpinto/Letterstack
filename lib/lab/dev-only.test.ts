import { afterEach, describe, expect, it, vi } from "vitest";

import { devOnly, isLabEnabled } from "./dev-only";

describe("isLabEnabled", () => {
  it("is on only under next dev", () => {
    expect(isLabEnabled("development")).toBe(true);
    expect(isLabEnabled("production")).toBe(false);
    expect(isLabEnabled("test")).toBe(false);
    expect(isLabEnabled(undefined)).toBe(false);
  });
});

describe("devOnly", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("returns 404 without calling the handler outside development", async () => {
    vi.stubEnv("NODE_ENV", "production");
    const handler = vi.fn(async () => new Response("ran"));
    const response = await devOnly(handler)();
    expect(response.status).toBe(404);
    expect(handler).not.toHaveBeenCalled();
  });

  it("passes through in development", async () => {
    vi.stubEnv("NODE_ENV", "development");
    const response = await devOnly(async (n: number) => new Response(String(n)))(7);
    expect(await response.text()).toBe("7");
  });
});
