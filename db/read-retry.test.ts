import { describe, expect, it, vi } from "vitest";

import { isPlainReadRequest, withReadRetry } from "./read-retry";

const single = (query: string) => JSON.stringify({ query, params: [] });

describe("isPlainReadRequest", () => {
  it("accepts plain selects", () => {
    expect(isPlainReadRequest(single('select "id", "updated_at" from "campaigns" where "id" = $1'))).toBe(true);
    expect(isPlainReadRequest(single("  -- comment\n(SELECT count(*) FROM recipients)"))).toBe(true);
  });

  it("rejects anything that writes, locks or has side effects", () => {
    for (const query of [
      'insert into "recipients" ("email") values ($1)',
      'update "organizations" set "emails_sent_count" = 1',
      "with x as (delete from t returning *) select * from x",
      "with x as (select 1) select * from x",
      "select * from campaigns where id = $1 for update",
      "select * from campaigns for no key update skip locked",
      "select nextval('s')",
      "select pg_advisory_lock(1)",
    ]) {
      expect([query, isPlainReadRequest(single(query))]).toEqual([query, false]);
    }
  });

  it("never retries a batch: it is a transaction", () => {
    const body = JSON.stringify({ queries: [{ query: "select 1", params: [] }] });
    expect(isPlainReadRequest(body)).toBe(false);
  });

  it("rejects bodies it cannot read", () => {
    expect(isPlainReadRequest(undefined)).toBe(false);
    expect(isPlainReadRequest("not json")).toBe(false);
  });
});

describe("withReadRetry", () => {
  const ok = () => new Response("{}", { status: 200 });
  const sleep = () => Promise.resolve();

  it("retries a read after a network error and returns the answer", async () => {
    const fetchImpl = vi
      .fn()
      .mockRejectedValueOnce(new TypeError("fetch failed"))
      .mockResolvedValueOnce(ok());
    const fetch = withReadRetry({ fetchImpl, sleep });
    const response = await fetch("https://db", { method: "POST", body: single("select 1") });
    expect(response.status).toBe(200);
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it("retries a read on a gateway error", async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(new Response("", { status: 503 }))
      .mockResolvedValueOnce(ok());
    const fetch = withReadRetry({ fetchImpl, sleep });
    await fetch("https://db", { body: single("select 1") });
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it("gives up after the bounded number of attempts", async () => {
    const fetchImpl = vi.fn().mockRejectedValue(new TypeError("fetch failed"));
    const fetch = withReadRetry({ fetchImpl, sleep, retries: 2 });
    await expect(fetch("https://db", { body: single("select 1") })).rejects.toThrow("fetch failed");
    expect(fetchImpl).toHaveBeenCalledTimes(3);
  });

  it("does not retry a SQL error", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(new Response("{}", { status: 400 }));
    const fetch = withReadRetry({ fetchImpl, sleep });
    const response = await fetch("https://db", { body: single("select 1") });
    expect(response.status).toBe(400);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it("never retries a write, even on a network error", async () => {
    const fetchImpl = vi.fn().mockRejectedValue(new TypeError("fetch failed"));
    const fetch = withReadRetry({ fetchImpl, sleep });
    await expect(
      fetch("https://db", { body: single('update "organizations" set "plan" = $1') }),
    ).rejects.toThrow();
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });
});
