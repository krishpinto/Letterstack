import { afterEach, describe, expect, it, vi } from "vitest";
import { SaveError } from "./save-queue";
import { patchDocument, saveErrorFromResponse } from "./save-request";

describe("saveErrorFromResponse", () => {
  it("maps an expired session to unauthorized", () => {
    expect(saveErrorFromResponse(401, { ok: false, error: "Unauthorized" }).kind).toBe(
      "unauthorized",
    );
  });

  it("maps a version mismatch to conflict", () => {
    const err = saveErrorFromResponse(409, { ok: false, code: "conflict", error: "Changed" });
    expect(err.kind).toBe("conflict");
    expect(err.message).toBe("Changed");
  });

  it("maps a sent campaign to locked", () => {
    expect(saveErrorFromResponse(409, { ok: false, code: "locked" }).kind).toBe("locked");
  });

  it("maps other failures, including unparseable bodies, to failed", () => {
    expect(saveErrorFromResponse(404, { ok: false, error: "Campaign not found" })).toMatchObject({
      kind: "failed",
      message: "Campaign not found",
    });
    expect(saveErrorFromResponse(502, null).kind).toBe("failed");
  });
});

describe("patchDocument", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  function stubFetch(impl: () => Promise<Response>) {
    vi.stubGlobal("fetch", vi.fn(impl));
  }

  it("resolves with the new version on success", async () => {
    stubFetch(async () => Response.json({ ok: true, version: "abc" }));
    await expect(patchDocument("/api/x", { document: {} })).resolves.toBe("abc");
  });

  it("rejects when the body says ok: false, even with HTTP 200", async () => {
    stubFetch(async () => Response.json({ ok: false, error: "nope" }));
    await expect(patchDocument("/api/x", {})).rejects.toMatchObject({
      kind: "failed",
      message: "nope",
    });
  });

  it("rejects when the response is not JSON", async () => {
    stubFetch(async () => new Response("<html>login</html>", { status: 200 }));
    await expect(patchDocument("/api/x", {})).rejects.toBeInstanceOf(SaveError);
  });

  it("rejects on a network failure", async () => {
    stubFetch(async () => {
      throw new TypeError("Failed to fetch");
    });
    await expect(patchDocument("/api/x", {})).rejects.toMatchObject({ kind: "failed" });
  });

  it("rejects with conflict on 409", async () => {
    stubFetch(async () => Response.json({ ok: false, code: "conflict" }, { status: 409 }));
    await expect(patchDocument("/api/x", {})).rejects.toMatchObject({ kind: "conflict" });
  });
});
