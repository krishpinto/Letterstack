import { describe, expect, it } from "vitest";
import {
  buildContactsCsv,
  canUnsuppress,
  chunk,
  csvCell,
  exportFileName,
  lockedSuppressionExplanation,
  statusForSuppression,
  summarizeBulk,
  suppressionLabel,
} from "./contacts-helpers";

describe("suppression reasons", () => {
  it("maps reasons to the page's status groups", () => {
    expect(statusForSuppression(null)).toBe("subscribed");
    expect(statusForSuppression("bounce")).toBe("bounced");
    expect(statusForSuppression("complaint")).toBe("bounced");
    expect(statusForSuppression("unsubscribe")).toBe("suppressed");
    expect(statusForSuppression("manual")).toBe("suppressed");
  });

  it("only lets manual suppressions be undone", () => {
    expect(canUnsuppress("manual")).toBe(true);
    for (const reason of ["bounce", "complaint", "unsubscribe", "other", null]) {
      expect(canUnsuppress(reason)).toBe(false);
    }
  });

  it("explains every locked reason and nothing for manual ones", () => {
    expect(lockedSuppressionExplanation("manual")).toBeNull();
    expect(lockedSuppressionExplanation(null)).toBeNull();
    expect(lockedSuppressionExplanation("bounce")).toMatch(/reputation/);
    expect(lockedSuppressionExplanation("complaint")).toMatch(/spam/);
    expect(lockedSuppressionExplanation("unsubscribe")).toMatch(/consent/);
    expect(lockedSuppressionExplanation("other")).toBeTruthy();
  });

  it("labels the badge with the reason", () => {
    expect(suppressionLabel("unsubscribe")).toBe("Unsubscribed");
    expect(suppressionLabel("complaint")).toBe("Complained");
    expect(suppressionLabel("manual")).toBe("Suppressed");
    expect(suppressionLabel(null)).toBe("Subscribed");
  });
});

describe("summarizeBulk", () => {
  it("reports full success", () => {
    expect(
      summarizeBulk({ verb: "Deleted", noun: "contact", total: 3, done: 3, failed: [] }),
    ).toEqual({ kind: "success", message: "Deleted 3 contacts" });
  });

  it("reports partial failure with deduplicated reasons", () => {
    const result = summarizeBulk({
      verb: "Deleted",
      noun: "contact",
      total: 10,
      done: 8,
      failed: ["Contact not found", "Contact not found"],
    });
    expect(result.kind).toBe("error");
    expect(result.message).toBe("Deleted 8 of 10 contacts");
    expect(result.description).toBe("2 failed: Contact not found");
  });

  it("counts silent shortfalls as failures", () => {
    const result = summarizeBulk({ verb: "Suppressed", noun: "contact", total: 5, done: 4, failed: [] });
    expect(result.kind).toBe("error");
    expect(result.description).toBe("1 failed.");
  });

  it("says none when everything failed", () => {
    const result = summarizeBulk({
      verb: "Deleted",
      noun: "contact",
      total: 1,
      done: 0,
      failed: ["Could not reach the server."],
    });
    expect(result.message).toBe("Deleted none of 1 contact");
  });
});

describe("chunk", () => {
  it("splits with a short tail", () => {
    expect(chunk([1, 2, 3], 2)).toEqual([[1, 2], [3]]);
  });
  it("rejects a non-positive size", () => {
    expect(() => chunk([1], 0)).toThrow();
  });
});

describe("CSV export", () => {
  it("quotes cells and neutralises formulas", () => {
    expect(csvCell('say "hi"')).toBe('"say ""hi"""');
    expect(csvCell("=HYPERLINK(1)")).toBe(`"'=HYPERLINK(1)"`);
    expect(csvCell("-5")).toBe(`"'-5"`);
  });

  it("writes a header, folders and CRLF rows", () => {
    const csv = buildContactsCsv([
      {
        name: null,
        email: "a@b.co",
        status: "subscribed",
        folders: ["VIP", "News"],
        createdAt: "2026-01-01T00:00:00.000Z",
      },
    ]);
    expect(csv.split("\r\n")).toEqual([
      '"Name","Email","Status","Folders","Added"',
      '"","a@b.co","subscribed","VIP; News","2026-01-01T00:00:00.000Z"',
    ]);
  });

  it("names the file after the folder", () => {
    expect(exportFileName(null)).toBe("letterstack-audience.csv");
    expect(exportFileName("VIP Customers!")).toBe("letterstack-audience-vip-customers.csv");
  });
});
