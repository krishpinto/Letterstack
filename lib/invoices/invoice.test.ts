import { describe, expect, it } from "vitest";

import { financialYear, invoiceNumber } from "./invoice";

describe("financialYear", () => {
  it("starts the new year at midnight on 1 April in India, not in UTC", () => {
    // 00:10 IST on 1 April 2027 is still 31 March in UTC.
    expect(financialYear(new Date("2027-03-31T18:40:00.000Z"))).toBe("2027-28");
    expect(invoiceNumber(1, new Date("2027-03-31T18:40:00.000Z"))).toBe("LS/2027-28/0001");
  });

  it("keeps 23:59 IST on 31 March in the old year", () => {
    expect(financialYear(new Date("2027-03-31T18:29:00.000Z"))).toBe("2026-27");
  });

  it("puts January to March in the year that started the previous April", () => {
    expect(financialYear(new Date("2027-02-15T06:00:00.000Z"))).toBe("2026-27");
    expect(financialYear(new Date("2026-11-11T06:00:00.000Z"))).toBe("2026-27");
  });

  it("formats the century rollover with two digits", () => {
    expect(financialYear(new Date("2099-06-01T00:00:00.000Z"))).toBe("2099-00");
  });
});
