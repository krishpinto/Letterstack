import { describe, expect, it } from "vitest";

import { classifyRefund, pendingSettlementSteps } from "./settlement";

const base = {
  status: "paid",
  planGrantedAt: null,
  grantsPlan: true,
  invoice: null,
  hasBuyerEmail: true,
};

describe("pendingSettlementSteps", () => {
  it("runs every step on a freshly paid order", () => {
    expect(pendingSettlementSteps(base)).toEqual(["grant-plan", "issue-invoice", "send-invoice"]);
  });

  it("resumes a settlement whose grant failed after the order was marked paid", () => {
    // The money bug: charged, marked paid, grant threw. A retry used to see
    // "already paid" and stop. It must grant, then invoice.
    expect(pendingSettlementSteps({ ...base, status: "paid", planGrantedAt: null })).toContain("grant-plan");
  });

  it("does not grant twice once the grant is recorded", () => {
    const steps = pendingSettlementSteps({ ...base, planGrantedAt: new Date() });
    expect(steps).not.toContain("grant-plan");
    expect(steps).toEqual(["issue-invoice", "send-invoice"]);
  });

  it("only re-sends an invoice that never went out", () => {
    const granted = new Date();
    expect(pendingSettlementSteps({ ...base, planGrantedAt: granted, invoice: { sentAt: null } })).toEqual(["send-invoice"]);
    expect(pendingSettlementSteps({ ...base, planGrantedAt: granted, invoice: { sentAt: granted } })).toEqual([]);
  });

  it("issues but cannot send an invoice without a buyer email", () => {
    expect(pendingSettlementSteps({ ...base, planGrantedAt: new Date(), hasBuyerEmail: false })).toEqual(["issue-invoice"]);
  });

  it("never invoices an item that grants no plan", () => {
    expect(pendingSettlementSteps({ ...base, grantsPlan: false })).toEqual(["grant-plan"]);
  });

  it("does nothing for a refunded or unpaid order", () => {
    expect(pendingSettlementSteps({ ...base, status: "refunded" })).toEqual([]);
    expect(pendingSettlementSteps({ ...base, status: "created" })).toEqual([]);
  });
});

describe("classifyRefund", () => {
  it("reads Razorpay's own verdict", () => {
    expect(classifyRefund({ chargedPaise: 100_000, amountRefundedPaise: 100_000, refundStatus: "full" })).toBe("full");
    expect(classifyRefund({ chargedPaise: 100_000, amountRefundedPaise: 40_000, refundStatus: "partial" })).toBe("partial");
  });

  it("calls it full when the running total covers what we charged", () => {
    expect(classifyRefund({ chargedPaise: 100_000, amountRefundedPaise: 100_000, refundStatus: null })).toBe("full");
  });

  it("does not treat a partial refund as full", () => {
    expect(classifyRefund({ chargedPaise: 100_000, amountRefundedPaise: 99_999, refundStatus: undefined })).toBe("partial");
  });

  it("reports no refund when nothing was refunded", () => {
    expect(classifyRefund({ chargedPaise: 100_000, amountRefundedPaise: 0, refundStatus: null })).toBe("none");
  });
});
