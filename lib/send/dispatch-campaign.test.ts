import { beforeEach, describe, expect, it, vi } from "vitest";

// Every module that touches the database, QStash or SES is replaced. These
// tests exercise the order of operations in dispatchCampaign and
// resumeCampaign, which is where double sends and double charges come from.
vi.mock("@/db/campaigns", () => ({
  getCampaign: vi.fn(),
  claimCampaignForSending: vi.fn(),
  claimDispatchRound: vi.fn(),
  revertCampaignClaim: vi.fn(),
}));
vi.mock("@/db/campaign-recipients", () => ({
  readSendableAudience: vi.fn(),
  failPendingRecipients: vi.fn(),
  listRecipientStates: vi.fn(),
  recipientStatusCounts: vi.fn(),
}));
vi.mock("@/db/organizations", () => ({
  getSendUsage: vi.fn(),
  releaseSendQuota: vi.fn(),
  startTrialClockOnFirstSend: vi.fn(),
  tryReserveSendQuota: vi.fn(),
}));
vi.mock("@/db/connected-mailboxes", () => ({
  getMailbox: vi.fn(),
  getMailboxSendUsage: vi.fn(),
  releaseMailboxQuota: vi.fn(),
  tryReserveMailboxQuota: vi.fn(),
}));
vi.mock("@/lib/admin-notify", () => ({ notifyAdminsOfCampaignSend: vi.fn() }));
vi.mock("./send-campaign", () => ({ publishSesBatches: vi.fn() }));
vi.mock("./gmail-campaign", () => ({ publishGmailRun: vi.fn() }));
vi.mock("./qstash-worker", () => ({ settleCampaign: vi.fn() }));

import {
  claimCampaignForSending,
  claimDispatchRound,
  getCampaign,
  revertCampaignClaim,
} from "@/db/campaigns";
import {
  failPendingRecipients,
  readSendableAudience,
  recipientStatusCounts,
} from "@/db/campaign-recipients";
import { getSendUsage, releaseSendQuota, tryReserveSendQuota } from "@/db/organizations";
import { publishSesBatches } from "./send-campaign";
import { settleCampaign } from "./qstash-worker";
import {
  dispatchCampaign,
  ensureCampaignQueued,
  QueueIncompleteError,
  resumeCampaign,
  SendRefusedError,
} from "./dispatch-campaign";

const dispatchedAt = new Date("2026-11-11T10:00:00.000Z");

const campaign = {
  id: "c1",
  organizationId: "org1",
  userId: "u1",
  status: "draft",
  subject: "Hello",
  htmlSnapshot: "<p>hi</p>",
  textSnapshot: "hi",
  fromName: "Acme",
  fromEmail: "news@acme.test",
  replyTo: null,
  senderType: "shared",
  mailboxId: null,
  sentAt: null,
  lastDispatchedAt: null,
};

const audience = {
  allowed: [
    { id: "r1", email: "a@x.test" },
    { id: "r2", email: "b@x.test" },
  ],
  suppressed: [{ id: "r3", email: "gone@x.test" }],
};

const counts = (over: Partial<Record<"pending" | "sending" | "sent" | "failed", number>>) => ({
  pending: 0,
  sending: 0,
  sent: 0,
  failed: 0,
  ...over,
});

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getCampaign).mockResolvedValue(campaign as never);
  vi.mocked(readSendableAudience).mockResolvedValue(audience as never);
  vi.mocked(tryReserveSendQuota).mockResolvedValue(true);
  vi.mocked(claimCampaignForSending).mockResolvedValue(dispatchedAt);
  vi.mocked(publishSesBatches).mockResolvedValue({ queued: 1, total: 1 });
  vi.mocked(settleCampaign).mockResolvedValue({ inFlight: 0 });
});

describe("dispatchCampaign", () => {
  it("publishes only after winning the claim, keyed by the round", async () => {
    const result = await dispatchCampaign("c1", "now");

    expect(result).toEqual({ outcome: "started", total: 2, batches: 1 });
    expect(claimCampaignForSending).toHaveBeenCalledWith("c1", ["draft", "scheduled"]);
    expect(publishSesBatches).toHaveBeenCalledWith(
      expect.objectContaining({ dispatchKey: String(dispatchedAt.getTime()) }),
    );
    expect(releaseSendQuota).not.toHaveBeenCalled();
  });

  it("reserves only for sendable rows and fails suppressed ones after the claim", async () => {
    await dispatchCampaign("c1", "now");

    expect(tryReserveSendQuota).toHaveBeenCalledWith("org1", 2);
    expect(failPendingRecipients).toHaveBeenCalledWith(["r3"], "suppressed");
    const claimOrder = vi.mocked(claimCampaignForSending).mock.invocationCallOrder[0];
    const failOrder = vi.mocked(failPendingRecipients).mock.invocationCallOrder[0];
    expect(failOrder).toBeGreaterThan(claimOrder);
  });

  it("hands quota back and changes nothing when another request claimed first", async () => {
    vi.mocked(claimCampaignForSending).mockResolvedValue(null);

    const result = await dispatchCampaign("c1", "now");

    expect(result).toEqual({ outcome: "already_sending" });
    expect(releaseSendQuota).toHaveBeenCalledWith("org1", 2);
    expect(failPendingRecipients).not.toHaveBeenCalled();
    expect(publishSesBatches).not.toHaveBeenCalled();
  });

  it("only lets the schedule start a campaign that is still scheduled", async () => {
    vi.mocked(getCampaign).mockResolvedValue({ ...campaign, status: "scheduled" } as never);

    await dispatchCampaign("c1", "schedule");

    expect(claimCampaignForSending).toHaveBeenCalledWith("c1", ["scheduled"]);
  });

  it("refuses without claiming when the quota is short", async () => {
    vi.mocked(tryReserveSendQuota).mockResolvedValue(false);
    vi.mocked(getSendUsage).mockResolvedValue({ used: 999, limit: 1000 } as never);

    await expect(dispatchCampaign("c1", "now")).rejects.toBeInstanceOf(SendRefusedError);
    expect(claimCampaignForSending).not.toHaveBeenCalled();
    expect(publishSesBatches).not.toHaveBeenCalled();
  });

  it("refuses an empty audience without reserving anything", async () => {
    vi.mocked(readSendableAudience).mockResolvedValue({ allowed: [], suppressed: [] });

    await expect(dispatchCampaign("c1", "now")).rejects.toBeInstanceOf(SendRefusedError);
    expect(tryReserveSendQuota).not.toHaveBeenCalled();
  });

  it("puts a Send now back and releases quota when nothing could be queued", async () => {
    vi.mocked(publishSesBatches).mockResolvedValue({ queued: 0, total: 2 });

    await expect(dispatchCampaign("c1", "now")).rejects.toThrow("Nothing was sent");
    expect(revertCampaignClaim).toHaveBeenCalledWith("c1", "draft");
    expect(releaseSendQuota).toHaveBeenCalledWith("org1", 2);
  });

  it("keeps a scheduled send's claim when nothing could be queued, for the retry", async () => {
    vi.mocked(getCampaign).mockResolvedValue({ ...campaign, status: "scheduled" } as never);
    vi.mocked(publishSesBatches).mockResolvedValue({ queued: 0, total: 2 });

    await expect(dispatchCampaign("c1", "schedule")).rejects.toBeInstanceOf(QueueIncompleteError);
    expect(revertCampaignClaim).not.toHaveBeenCalled();
    expect(releaseSendQuota).not.toHaveBeenCalled();
  });

  it("reports a partial queue without giving quota back", async () => {
    vi.mocked(publishSesBatches).mockResolvedValue({ queued: 1, total: 3 });

    await expect(dispatchCampaign("c1", "now")).rejects.toBeInstanceOf(QueueIncompleteError);
    expect(revertCampaignClaim).not.toHaveBeenCalled();
    expect(releaseSendQuota).not.toHaveBeenCalled();
  });
});

describe("resumeCampaign", () => {
  const sending = { ...campaign, status: "sending", lastDispatchedAt: dispatchedAt };
  const nextRound = new Date("2026-11-11T10:05:00.000Z");

  beforeEach(() => {
    vi.mocked(getCampaign).mockResolvedValue(sending as never);
    vi.mocked(recipientStatusCounts).mockResolvedValue(counts({ pending: 4, sent: 6 }));
    vi.mocked(claimDispatchRound).mockResolvedValue(nextRound);
  });

  it("re-queues pending rows in a new round without reserving quota", async () => {
    const result = await resumeCampaign("c1");

    expect(result).toEqual({ outcome: "resumed", pending: 4, batches: 1 });
    expect(tryReserveSendQuota).not.toHaveBeenCalled();
    expect(publishSesBatches).toHaveBeenCalledWith(
      expect.objectContaining({ dispatchKey: String(nextRound.getTime()) }),
    );
  });

  it("settles timed-out claims before deciding anything", async () => {
    await resumeCampaign("c1");

    expect(settleCampaign).toHaveBeenCalledWith("c1");
  });

  it("does nothing when no row is pending", async () => {
    vi.mocked(recipientStatusCounts).mockResolvedValue(counts({ sending: 2, sent: 8 }));
    vi.mocked(settleCampaign).mockResolvedValue({ inFlight: 2 });

    const result = await resumeCampaign("c1");

    expect(result).toEqual({ outcome: "nothing_to_resume", inFlight: 2 });
    expect(claimDispatchRound).not.toHaveBeenCalled();
    expect(publishSesBatches).not.toHaveBeenCalled();
  });

  it("starts one round for two quick clicks", async () => {
    vi.mocked(claimDispatchRound).mockResolvedValueOnce(nextRound).mockResolvedValueOnce(null);

    const results = await Promise.all([resumeCampaign("c1"), resumeCampaign("c1")]);

    expect(results.map((r) => r.outcome).sort()).toEqual(["resumed", "too_soon"]);
    expect(publishSesBatches).toHaveBeenCalledTimes(1);
  });

  it("refuses a campaign that is not sending", async () => {
    vi.mocked(getCampaign).mockResolvedValue({ ...campaign, status: "sent" } as never);

    expect(await resumeCampaign("c1")).toEqual({ outcome: "not_sending" });
    expect(settleCampaign).not.toHaveBeenCalled();
  });
});

describe("ensureCampaignQueued", () => {
  it("re-runs the current round with its original key and reserves nothing", async () => {
    vi.mocked(getCampaign).mockResolvedValue({
      ...campaign,
      status: "sending",
      lastDispatchedAt: dispatchedAt,
    } as never);

    await ensureCampaignQueued("c1");

    expect(publishSesBatches).toHaveBeenCalledWith(
      expect.objectContaining({ dispatchKey: String(dispatchedAt.getTime()) }),
    );
    expect(claimDispatchRound).not.toHaveBeenCalled();
    expect(tryReserveSendQuota).not.toHaveBeenCalled();
  });
});
