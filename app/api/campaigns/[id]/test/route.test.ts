import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/auth-helpers", () => ({ currentUserId: vi.fn() }));
vi.mock("@/db/campaigns", () => ({ getCampaignForUser: vi.fn() }));
vi.mock("@/db/organizations", () => ({
  getSendUsage: vi.fn(),
  releaseSendQuota: vi.fn(),
  tryReserveSendQuota: vi.fn(),
}));
vi.mock("@/db/rate-limits", () => ({ tryConsumeRateLimit: vi.fn() }));
vi.mock("@/db/suppression", () => ({ isSuppressedForOrganization: vi.fn() }));
vi.mock("@/lib/send/ses", () => ({ sendEmail: vi.fn() }));
vi.mock("@/lib/send/qstash", () => ({ appBaseUrl: () => "https://app.test" }));
vi.mock("@/lib/send/dispatch-campaign", () => ({
  assertCampaignCanSend: vi.fn(),
  SendRefusedError: class SendRefusedError extends Error {},
}));
vi.mock("@/lib/email/unsubscribe", () => ({
  personalizeUnsubscribe: (content: { html: string; text: string }) => content,
  unsubscribeOneClickUrl: () => "https://app.test/u/one-click",
  unsubscribePageUrl: () => "https://app.test/u",
}));

import { currentUserId } from "@/lib/auth-helpers";
import { getCampaignForUser } from "@/db/campaigns";
import { releaseSendQuota, tryReserveSendQuota } from "@/db/organizations";
import { tryConsumeRateLimit } from "@/db/rate-limits";
import { isSuppressedForOrganization } from "@/db/suppression";
import { sendEmail } from "@/lib/send/ses";
import { POST } from "./route";

const campaign = {
  id: "c1",
  organizationId: "org1",
  subject: "Hello",
  htmlSnapshot: "<p>hi</p>",
  textSnapshot: "hi",
  fromName: "Acme",
  fromEmail: "news@acme.test",
  replyTo: null,
  senderType: "domain",
};

function call(email: string) {
  return POST(
    new Request("https://app.test/api/campaigns/c1/test", {
      method: "POST",
      body: JSON.stringify({ email }),
    }),
    { params: Promise.resolve({ id: "c1" }) },
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(currentUserId).mockResolvedValue("u1");
  vi.mocked(getCampaignForUser).mockResolvedValue(campaign as never);
  vi.mocked(isSuppressedForOrganization).mockResolvedValue(false);
  vi.mocked(tryConsumeRateLimit).mockResolvedValue(true);
  vi.mocked(tryReserveSendQuota).mockResolvedValue(true);
  vi.mocked(sendEmail).mockResolvedValue("m1");
});

describe("POST /api/campaigns/[id]/test", () => {
  it("counts test emails against the rate limit and the monthly quota", async () => {
    const response = await call("a@x.test, b@x.test");

    expect(response.status).toBe(200);
    expect(tryConsumeRateLimit).toHaveBeenCalledWith("test-send:user:u1", 2, 20, 3600);
    expect(tryReserveSendQuota).toHaveBeenCalledWith("org1", 2);
    expect(sendEmail).toHaveBeenCalledTimes(2);
  });

  it("skips suppressed addresses and does not count them", async () => {
    vi.mocked(isSuppressedForOrganization).mockImplementation(
      async (_org: string, email: string) => email === "gone@x.test",
    );

    const response = await call("gone@x.test a@x.test");
    const body = await response.json();

    expect(body).toMatchObject({ ok: true, count: 1, skipped: ["gone@x.test"] });
    expect(tryReserveSendQuota).toHaveBeenCalledWith("org1", 1);
    expect(sendEmail).toHaveBeenCalledWith(expect.objectContaining({ to: "a@x.test" }));
  });

  it("refuses over the hourly limit without reserving quota or sending", async () => {
    vi.mocked(tryConsumeRateLimit).mockResolvedValue(false);

    const response = await call("a@x.test");

    expect(response.status).toBe(429);
    expect(tryReserveSendQuota).not.toHaveBeenCalled();
    expect(sendEmail).not.toHaveBeenCalled();
  });

  it("refuses when the monthly quota is used up", async () => {
    vi.mocked(tryReserveSendQuota).mockResolvedValue(false);
    const { getSendUsage } = await import("@/db/organizations");
    vi.mocked(getSendUsage).mockResolvedValue({ used: 1000, limit: 1000 } as never);

    const response = await call("a@x.test");

    expect(response.status).toBe(400);
    expect(sendEmail).not.toHaveBeenCalled();
  });

  it("refunds a test SES refused, but not one lost to a dropped connection", async () => {
    vi.mocked(sendEmail)
      .mockRejectedValueOnce(Object.assign(new Error("Rejected"), { $metadata: { httpStatusCode: 400 } }))
      .mockRejectedValueOnce(Object.assign(new Error("socket hang up"), { code: "ECONNRESET" }))
      .mockResolvedValueOnce("m3");

    await call("a@x.test b@x.test c@x.test");

    expect(releaseSendQuota).toHaveBeenCalledWith("org1", 1);
  });

  it("sends the same address once even if it is typed twice", async () => {
    await call("a@x.test A@x.test");

    expect(sendEmail).toHaveBeenCalledTimes(1);
  });

  it("refuses a Gmail campaign instead of letting SES reject it", async () => {
    vi.mocked(getCampaignForUser).mockResolvedValue({ ...campaign, senderType: "mailbox" } as never);

    const response = await call("a@x.test");

    expect(response.status).toBe(400);
    expect(tryReserveSendQuota).not.toHaveBeenCalled();
  });
});
