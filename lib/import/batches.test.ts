import { describe, expect, it } from "vitest";
import {
  IMPORT_AUTOMATION_CAP,
  addImportSummary,
  chunkRows,
  describeStoppedImport,
  emptyImportSummary,
  importPercent,
  remainingAutomationBudget,
} from "./batches";

describe("chunkRows", () => {
  it("splits into fixed-size chunks with a short last one", () => {
    const chunks = chunkRows([1, 2, 3, 4, 5], 2);
    expect(chunks).toEqual([[1, 2], [3, 4], [5]]);
  });

  it("returns no chunks for no rows", () => {
    expect(chunkRows([], 10)).toEqual([]);
  });

  it("rejects a zero chunk size", () => {
    expect(() => chunkRows([1], 0)).toThrow();
  });
});

describe("addImportSummary", () => {
  it("adds chunk summaries field by field", () => {
    let total = emptyImportSummary();
    total = addImportSummary(total, { received: 1000, imported: 900, duplicates: 100 });
    total = addImportSummary(total, { received: 500, imported: 450, invalid: 50 });
    expect(total.received).toBe(1500);
    expect(total.imported).toBe(1350);
    expect(total.duplicates).toBe(100);
    expect(total.invalid).toBe(50);
    expect(total.addedToFolder).toBe(0);
  });

  it("ignores fields an older server does not send and junk values", () => {
    const total = addImportSummary(emptyImportSummary(), {
      imported: "3",
      typos: undefined,
      deadDomain: "x",
    });
    expect(total.imported).toBe(3);
    expect(total.typos).toBe(0);
    expect(total.deadDomain).toBe(0);
  });

  it("does not mutate the running total", () => {
    const total = emptyImportSummary();
    addImportSummary(total, { imported: 5 });
    expect(total.imported).toBe(0);
  });
});

describe("remainingAutomationBudget", () => {
  it("starts at the cap and counts down to zero", () => {
    expect(remainingAutomationBudget(0)).toBe(IMPORT_AUTOMATION_CAP);
    expect(remainingAutomationBudget(400)).toBe(IMPORT_AUTOMATION_CAP - 400);
    expect(remainingAutomationBudget(IMPORT_AUTOMATION_CAP + 5)).toBe(0);
  });

  it("treats junk as nothing queued", () => {
    expect(remainingAutomationBudget(Number.NaN)).toBe(IMPORT_AUTOMATION_CAP);
    expect(remainingAutomationBudget(-3)).toBe(IMPORT_AUTOMATION_CAP);
  });
});

describe("importPercent", () => {
  it("is 0 with no chunks and clamps to 0–100", () => {
    expect(importPercent(0, 0)).toBe(0);
    expect(importPercent(1, 4)).toBe(25);
    expect(importPercent(9, 4)).toBe(100);
    expect(importPercent(-1, 4)).toBe(0);
  });
});

describe("describeStoppedImport", () => {
  it("says nothing was imported when the first batch fails", () => {
    expect(describeStoppedImport(emptyImportSummary(), 0, 3)).toBe(
      "Batch 1 of 3 didn't import. Nothing has been imported yet.",
    );
  });

  it("says what earlier batches saved and where Retry resumes", () => {
    const total = addImportSummary(emptyImportSummary(), {
      received: 2000,
      imported: 1850,
    });
    const text = describeStoppedImport(total, 2, 5);
    expect(text).toContain("Batch 3 of 5");
    expect(text).toContain("1,850 new contacts");
    expect(text).toContain("Retry continues from batch 3");
  });
});
