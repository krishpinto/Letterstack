import { describe, expect, it } from "vitest";

import { decideAddIdentity, isPlatformDomain, shouldReleaseIdentity } from "./domain-ownership";

describe("isPlatformDomain", () => {
  it("matches the platform domain and its subdomains only", () => {
    expect(isPlatformDomain("letterstack.site", "letterstack.site")).toBe(true);
    expect(isPlatformDomain("acme.letterstack.site", "letterstack.site")).toBe(true);
    expect(isPlatformDomain("notletterstack.site", "letterstack.site")).toBe(false);
    expect(isPlatformDomain("acme.com", "letterstack.site")).toBe(false);
  });

  it("never matches when no platform domain is configured", () => {
    expect(isPlatformDomain("acme.com", "")).toBe(false);
  });
});

describe("decideAddIdentity", () => {
  it("uses an identity this request just created", () => {
    expect(decideAddIdentity({ identityExisted: false, connectedBeforeRequest: false })).toBe("use");
    expect(decideAddIdentity({ identityExisted: false, connectedBeforeRequest: true })).toBe("use");
  });

  it("re-uses an existing identity for a workspace that already held the domain", () => {
    expect(decideAddIdentity({ identityExisted: true, connectedBeforeRequest: true })).toBe("use");
  });

  it("refuses to adopt an existing identity for a newly connected domain", () => {
    // The takeover: acme.com was disconnected (or its workspace deleted), its
    // verified identity stayed in SES, and a different workspace adds it.
    expect(decideAddIdentity({ identityExisted: true, connectedBeforeRequest: false })).toBe(
      "refuse",
    );
  });
});

describe("shouldReleaseIdentity", () => {
  const base = { domain: "acme.com", platformDomain: "letterstack.site" };

  it("releases when the disconnecting workspace is the only holder", () => {
    expect(
      shouldReleaseIdentity({ ...base, ownerOrganizationIds: ["org-a"], releasingOrganizationId: "org-a" }),
    ).toBe(true);
  });

  it("keeps the identity while another workspace still references the domain", () => {
    expect(
      shouldReleaseIdentity({
        ...base,
        ownerOrganizationIds: ["org-a", "org-b"],
        releasingOrganizationId: "org-a",
      }),
    ).toBe(false);
  });

  it("never releases a domain the caller does not hold", () => {
    expect(
      shouldReleaseIdentity({ ...base, ownerOrganizationIds: ["org-b"], releasingOrganizationId: "org-a" }),
    ).toBe(false);
    expect(
      shouldReleaseIdentity({ ...base, ownerOrganizationIds: [], releasingOrganizationId: "org-a" }),
    ).toBe(false);
  });

  it("releases after a cascade only when no rows remain", () => {
    expect(
      shouldReleaseIdentity({ ...base, ownerOrganizationIds: [], releasingOrganizationId: null }),
    ).toBe(true);
    expect(
      shouldReleaseIdentity({ ...base, ownerOrganizationIds: ["org-b"], releasingOrganizationId: null }),
    ).toBe(false);
  });

  it("never releases the platform's own domain", () => {
    expect(
      shouldReleaseIdentity({
        domain: "news.letterstack.site",
        platformDomain: "letterstack.site",
        ownerOrganizationIds: [],
        releasingOrganizationId: null,
      }),
    ).toBe(false);
  });
});
