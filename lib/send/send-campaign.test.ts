import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/db/campaign-recipients", () => ({
  claimCampaignRecipient: vi.fn(),
  finishCampaignRecipient: vi.fn(),
  returnCampaignRecipientToPending: vi.fn(),
}));
vi.mock("@/db/suppression", () => ({ isSuppressedForOrganization: vi.fn() }));
vi.mock("@/db/organizations", () => ({ releaseSendQuota: vi.fn() }));
vi.mock("./ses", () => ({ sendEmail: vi.fn() }));
vi.mock("./qstash", () => ({
  appBaseUrl: () => "https://app.test",
  publishQstashJSON: vi.fn(),
  qstashNotBefore: (ms: number) => Math.floor(ms / 1000),
}));
vi.mock("@/lib/email/unsubscribe", () => ({
  personalizeUnsubscribe: (content: { html: string; text: string }) => content,
  unsubscribeOneClickUrl: () => "https://app.test/u/one-click",
  unsubscribePageUrl: () => "https://app.test/u",
}));

import {
  claimCampaignRecipient,
  finishCampaignRecipient,
  returnCampaignRecipientToPending,
} from "@/db/campaign-recipients";
import { isSuppressedForOrganization } from "@/db/suppression";
import { releaseSendQuota } from "@/db/organizations";
import { sendEmail } from "./ses";
import { RetryableSendError, sendCampaignBatch, type FrozenContent } from "./send-campaign";

const content: FrozenContent = {
  subject: "Hello",
  html: "<p>hi</p>",
  text: "hi",
  fromName: "Acme",
  fromEmail: "news@acme.test",
};

/** A tiny stand-in for the claim UPDATE: each id can be claimed once. */
function claimOnce(emails: Record<string, string>) {
  const claimed = new Set<string>();
  vi.mocked(claimCampaignRecipient).mockImplementation(async (id: string) => {
    if (claimed.has(id) || !(id in emails)) return null;
    claimed.add(id);
    return { id, email: emails[id] };
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(isSuppressedForOrganization).mockResolvedValue(false);
  vi.mocked(sendEmail).mockResolvedValue("ses-message-id");
  vi.mocked(finishCampaignRecipient).mockResolvedValue(true);
});

describe("sendCampaignBatch", () => {
  it("sends once per recipient even when the same batch is delivered twice", async () => {
    claimOnce({ r1: "a@x.test", r2: "b@x.test" });

    const first = sendCampaignBatch(content, ["r1", "r2"], "u1", "org1", "c1");
    const second = sendCampaignBatch(content, ["r1", "r2"], "u1", "org1", "c1");
    const results = await Promise.all([first, second]);

    expect(sendEmail).toHaveBeenCalledTimes(2);
    expect(results[0].sent + results[1].sent).toBe(2);
  });

  it("does nothing for rows it could not claim", async () => {
    vi.mocked(claimCampaignRecipient).mockResolvedValue(null);

    const result = await sendCampaignBatch(content, ["r1"], "u1", "org1", "c1");

    expect(result).toEqual({ sent: 0, failed: 0, unrecorded: 0 });
    expect(sendEmail).not.toHaveBeenCalled();
    expect(finishCampaignRecipient).not.toHaveBeenCalled();
  });

  it("fails a suppressed address without sending to it", async () => {
    claimOnce({ r1: "a@x.test" });
    vi.mocked(isSuppressedForOrganization).mockResolvedValue(true);

    const result = await sendCampaignBatch(content, ["r1"], "u1", "org1", "c1");

    expect(sendEmail).not.toHaveBeenCalled();
    expect(finishCampaignRecipient).toHaveBeenCalledWith("r1", "failed", "suppressed");
    expect(result.failed).toBe(1);
  });

  it("never marks a delivered email failed when recording it keeps failing", async () => {
    claimOnce({ r1: "a@x.test" });
    vi.mocked(finishCampaignRecipient).mockRejectedValue(new Error("db down"));
    vi.spyOn(console, "error").mockImplementation(() => {});

    const result = await sendCampaignBatch(content, ["r1"], "u1", "org1", "c1");

    expect(result).toEqual({ sent: 0, failed: 0, unrecorded: 1 });
    expect(finishCampaignRecipient).toHaveBeenCalledTimes(2);
    expect(finishCampaignRecipient).not.toHaveBeenCalledWith("r1", "failed", expect.anything());
  });

  it("puts the row back when it fails before reaching SES", async () => {
    claimOnce({ r1: "a@x.test" });
    vi.mocked(isSuppressedForOrganization).mockRejectedValue(new Error("db down"));

    await expect(sendCampaignBatch(content, ["r1"], "u1", "org1", "c1")).rejects.toThrow(
      "db down",
    );
    expect(returnCampaignRecipientToPending).toHaveBeenCalledWith("r1");
    expect(sendEmail).not.toHaveBeenCalled();
  });

  it("puts a throttled row back and stops the batch so QStash retries it", async () => {
    claimOnce({ r1: "a@x.test", r2: "b@x.test", r3: "c@x.test" });
    const throttled = Object.assign(new Error("Maximum sending rate exceeded."), {
      name: "TooManyRequestsException",
      $metadata: { httpStatusCode: 429 },
    });
    vi.mocked(sendEmail).mockResolvedValueOnce("m1").mockRejectedValueOnce(throttled);

    const attempt = sendCampaignBatch(content, ["r1", "r2", "r3"], "u1", "org1", "c1");

    await expect(attempt).rejects.toBeInstanceOf(RetryableSendError);
    expect(returnCampaignRecipientToPending).toHaveBeenCalledWith("r2");
    expect(finishCampaignRecipient).not.toHaveBeenCalledWith("r2", "failed", expect.anything());
    // r3 was never claimed, so it is still pending for the retry.
    expect(claimCampaignRecipient).not.toHaveBeenCalledWith("r3");
  });

  it("fails a rejected address with the provider's reason and carries on", async () => {
    claimOnce({ r1: "a@x.test", r2: "b@x.test" });
    const rejected = Object.assign(new Error("Email address is not verified."), {
      name: "MessageRejected",
      $metadata: { httpStatusCode: 400 },
    });
    vi.mocked(sendEmail).mockRejectedValueOnce(rejected).mockResolvedValueOnce("m2");

    const result = await sendCampaignBatch(content, ["r1", "r2"], "u1", "org1", "c1");

    expect(finishCampaignRecipient).toHaveBeenCalledWith(
      "r1",
      "failed",
      "Email address is not verified.",
    );
    expect(result).toMatchObject({ sent: 1, failed: 1 });
  });

  it("gives back quota for suppressed and refused rows, never for sent ones", async () => {
    claimOnce({ r1: "a@x.test", r2: "b@x.test", r3: "c@x.test" });
    vi.mocked(isSuppressedForOrganization).mockImplementation(
      async (_org: string, email: string) => email === "a@x.test",
    );
    const rejected = Object.assign(new Error("Rejected"), { name: "MessageRejected" });
    vi.mocked(sendEmail).mockRejectedValueOnce(rejected).mockResolvedValueOnce("m3");

    await sendCampaignBatch(content, ["r1", "r2", "r3"], "u1", "org1", "c1");

    expect(releaseSendQuota).toHaveBeenCalledTimes(1);
    expect(releaseSendQuota).toHaveBeenCalledWith("org1", 2);
  });

  it("still gives back quota when the batch stops for a retry", async () => {
    claimOnce({ r1: "a@x.test", r2: "b@x.test" });
    vi.mocked(isSuppressedForOrganization).mockImplementation(
      async (_org: string, email: string) => email === "a@x.test",
    );
    vi.mocked(sendEmail).mockRejectedValueOnce(
      Object.assign(new Error("slow down"), { name: "ThrottlingException" }),
    );

    await expect(sendCampaignBatch(content, ["r1", "r2"], "u1", "org1", "c1")).rejects.toBeInstanceOf(
      RetryableSendError,
    );
    // r1 was suppressed (released); r2 went back to pending (still reserved).
    expect(releaseSendQuota).toHaveBeenCalledWith("org1", 1);
  });

  it("releases nothing when everything was sent", async () => {
    claimOnce({ r1: "a@x.test" });

    await sendCampaignBatch(content, ["r1"], "u1", "org1", "c1");

    expect(releaseSendQuota).not.toHaveBeenCalled();
  });
});
