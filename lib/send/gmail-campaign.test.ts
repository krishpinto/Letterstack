import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/db/campaign-recipients", () => ({
  claimCampaignRecipient: vi.fn(),
  finishCampaignRecipient: vi.fn(),
  returnCampaignRecipientToPending: vi.fn(),
}));
vi.mock("@/db/suppression", () => ({ isSuppressedForOrganization: vi.fn() }));
vi.mock("@/db/connected-mailboxes", () => ({ getMailbox: vi.fn(), releaseMailboxQuota: vi.fn() }));
vi.mock("@/db/organizations", () => ({ releaseSendQuota: vi.fn() }));
vi.mock("./gmail-auth", () => ({
  getValidAccessToken: vi.fn(),
  MailboxReauthRequiredError: class extends Error {},
}));
vi.mock("./gmail", () => ({ sendGmailMessage: vi.fn() }));
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
import { getMailbox } from "@/db/connected-mailboxes";
import { getValidAccessToken, MailboxReauthRequiredError } from "./gmail-auth";
import { sendGmailMessage } from "./gmail";
import { publishQstashJSON } from "./qstash";
import { sendGmailChunk, type GmailRunPayload } from "./gmail-campaign";
import { GMAIL_CHUNK_SIZE } from "./send-policy";

const ids = Array.from({ length: GMAIL_CHUNK_SIZE + 5 }, (_, i) => `r${String(i).padStart(2, "0")}`);

const payload: GmailRunPayload = {
  content: { subject: "Hi", html: "<p>hi</p>", text: "hi", fromName: "Me", fromEmail: "me@gmail.test" },
  userId: "u1",
  organizationId: "org1",
  mailboxId: "m1",
  campaignId: "c1",
  campaignRecipientIds: ids,
  offset: 0,
  dispatchKey: "k1",
};

/** Run the chunk with the pacing sleeps fast-forwarded. */
async function run(input: GmailRunPayload) {
  const pending = sendGmailChunk(input);
  pending.catch(() => {});
  await vi.runAllTimersAsync();
  return pending;
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers();
  vi.mocked(getMailbox).mockResolvedValue({ id: "m1", email: "me@gmail.test" } as never);
  vi.mocked(claimCampaignRecipient).mockImplementation(async (id: string) => ({
    id,
    email: `${id}@x.test`,
  }));
  vi.mocked(isSuppressedForOrganization).mockResolvedValue(false);
  vi.mocked(getValidAccessToken).mockResolvedValue("token");
  vi.mocked(sendGmailMessage).mockResolvedValue("g1");
  vi.mocked(finishCampaignRecipient).mockResolvedValue(true);
});

afterEach(() => {
  vi.useRealTimers();
});

describe("sendGmailChunk", () => {
  it("sends one chunk, then queues the next from where it stopped", async () => {
    const result = await run(payload);

    expect(sendGmailMessage).toHaveBeenCalledTimes(GMAIL_CHUNK_SIZE);
    expect(result.continued).toBe(true);
    expect(publishQstashJSON).toHaveBeenCalledWith(
      expect.objectContaining({
        url: "https://app.test/api/send/gmail-campaign-worker",
        deduplicationId: `c1-k1-g${GMAIL_CHUNK_SIZE}`,
        body: expect.objectContaining({ offset: GMAIL_CHUNK_SIZE, campaignRecipientIds: ids }),
      }),
    );
  });

  it("queues nothing after the last chunk", async () => {
    const result = await run({ ...payload, offset: GMAIL_CHUNK_SIZE });

    expect(sendGmailMessage).toHaveBeenCalledTimes(5);
    expect(result.continued).toBe(false);
    expect(publishQstashJSON).not.toHaveBeenCalled();
  });

  it("stops the run when the mailbox needs reconnecting", async () => {
    vi.mocked(getValidAccessToken).mockRejectedValue(new MailboxReauthRequiredError("reauth"));

    const result = await run(payload);

    expect(result.haltedForReconnect).toBe(true);
    expect(returnCampaignRecipientToPending).toHaveBeenCalledWith("r00");
    expect(publishQstashJSON).not.toHaveBeenCalled();
  });

  it("reads a message queued before chunking as the start of a run", async () => {
    const legacy = { ...payload, offset: undefined, dispatchKey: undefined };

    await run(legacy);

    expect(sendGmailMessage).toHaveBeenCalledTimes(GMAIL_CHUNK_SIZE);
    expect(publishQstashJSON).toHaveBeenCalledWith(
      expect.objectContaining({ deduplicationId: `c1-legacy-g${GMAIL_CHUNK_SIZE}` }),
    );
  });
});
