import crypto from "node:crypto";
import { beforeAll, describe, expect, it } from "vitest";
import {
  legacyUnsubscribeOrganizations,
  signUnsubscribeToken,
  unsubscribeOneClickUrl,
  unsubscribePageUrl,
  verifyUnsubscribeToken,
} from "./unsubscribe";

const SECRET = "test-unsubscribe-secret";

beforeAll(() => {
  process.env.UNSUBSCRIBE_SECRET = SECRET;
});

function b64url(buf: Buffer) {
  return buf.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/** A token in the pre-organization format, exactly as old emails carry it. */
function legacyToken(userId: string, email: string) {
  const payload = b64url(Buffer.from(JSON.stringify({ u: userId, e: email })));
  const sig = b64url(crypto.createHmac("sha256", SECRET).update(payload).digest());
  return `${payload}.${sig}`;
}

describe("unsubscribe tokens", () => {
  it("carries the sending organization", () => {
    const token = signUnsubscribeToken("org-b", "user-1", "reader@example.com");
    expect(verifyUnsubscribeToken(token)).toEqual({
      organizationId: "org-b",
      userId: "user-1",
      email: "reader@example.com",
    });
  });

  it("still accepts tokens minted before the organization was recorded", () => {
    expect(verifyUnsubscribeToken(legacyToken("user-1", "reader@example.com"))).toEqual({
      organizationId: null,
      userId: "user-1",
      email: "reader@example.com",
    });
  });

  it("rejects a token whose payload was swapped to another workspace", () => {
    const token = signUnsubscribeToken("org-b", "user-1", "reader@example.com");
    const [, sig] = token.split(".");
    const forged = b64url(
      Buffer.from(JSON.stringify({ o: "org-a", u: "user-1", e: "reader@example.com" })),
    );
    expect(verifyUnsubscribeToken(`${forged}.${sig}`)).toBeNull();
  });

  it("rejects malformed input", () => {
    expect(verifyUnsubscribeToken("")).toBeNull();
    expect(verifyUnsubscribeToken("abc")).toBeNull();
    expect(verifyUnsubscribeToken("abc.def")).toBeNull();
  });

  it("builds page and one-click URLs whose tokens name the organization", () => {
    for (const url of [
      unsubscribePageUrl("https://x.test", "org-b", "user-1", "a@b.co"),
      unsubscribeOneClickUrl("https://x.test", "org-b", "user-1", "a@b.co"),
    ]) {
      const token = new URL(url).searchParams.get("t") ?? "";
      expect(verifyUnsubscribeToken(token)?.organizationId).toBe("org-b");
    }
  });
});

describe("legacyUnsubscribeOrganizations", () => {
  it("suppresses in every workspace that sent to or holds the address", () => {
    const orgs = legacyUnsubscribeOrganizations({
      campaignOrganizationIds: ["org-b"],
      recipientOrganizationIds: ["org-b", "org-c"],
      memberOrganizationIds: ["org-a", "org-b", "org-c"],
    });
    expect(orgs.sort()).toEqual(["org-b", "org-c"]);
  });

  it("does not suppress in a member workspace that never had the address", () => {
    const orgs = legacyUnsubscribeOrganizations({
      campaignOrganizationIds: ["org-b"],
      recipientOrganizationIds: [],
      memberOrganizationIds: ["org-a", "org-b"],
    });
    expect(orgs).toEqual(["org-b"]);
  });

  it("falls back to every member workspace rather than dropping the request", () => {
    const orgs = legacyUnsubscribeOrganizations({
      campaignOrganizationIds: [],
      recipientOrganizationIds: [],
      memberOrganizationIds: ["org-a", "org-b"],
    });
    expect(orgs.sort()).toEqual(["org-a", "org-b"]);
  });

  it("returns nothing when there is nowhere to suppress", () => {
    expect(
      legacyUnsubscribeOrganizations({
        campaignOrganizationIds: [],
        recipientOrganizationIds: [],
        memberOrganizationIds: [],
      }),
    ).toEqual([]);
  });
});
