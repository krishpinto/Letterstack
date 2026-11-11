import { beforeEach, describe, expect, it, vi } from "vitest";

// Every module that touches the database, QStash or SES is replaced. These
// tests exercise the order of operations in dispatchCampaign, which is where
// double sends and double charges come from.
vi.mock("@/db/campaigns", () => ({
  getCampaign: vi.fn(),
  claimCampaignForSending: vi.fn(),
}));
vi.mock("@/db/campaign-recipients", () => ({
  prepareCampaignAudience: vi.fn(),
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

import { claimCampaignForSending, getCampaign } from "@/db/campaigns";
import { prepareCampaignAudience } from "@/db/campaign-recipients";
import { getSendUsage, releaseSendQuota, tryReserveSendQuota } from "@/db/organizations";
import { publishSesBatches } from "./send-campaign";
import { dispatchCampaign, SendRefusedError } from "./dispatch-campaign";

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
};

const audience = [
  { id: "r1", email: "a@x.test" },
  { id: "r2", email: "b@x.test" },
];

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getCampaign).mockResolvedValue(campaign as never);
  vi.mocked(prepareCampaignAudience).mockResolvedValue(audience as never);
  vi.mocked(tryReserveSendQuota).mockResolvedValue(true);
  vi.mocked(claimCampaignForSending).mockResolvedValue(true);
  vi.mocked(publishSesBatches).mockResolvedValue({ batches: 1 });
});

describe("dispatchCampaign", () => {
  it("publishes only after winning the claim", async () => {
    const result = await dispatchCampaign("c1", "now");

    expect(result).toEqual({ outcome: "started", total: 2, batches: 1 });
    expect(claimCampaignForSending).toHaveBeenCalledWith("c1", ["draft", "scheduled"]);
    expect(publishSesBatches).toHaveBeenCalledTimes(1);
    expect(releaseSendQuota).not.toHaveBeenCalled();
  });

  it("hands quota back and publishes nothing when another request claimed first", async () => {
    vi.mocked(claimCampaignForSending).mockResolvedValue(false);

    const result = await dispatchCampaign("c1", "now");

    expect(result).toEqual({ outcome: "already_sending" });
    expect(tryReserveSendQuota).toHaveBeenCalledWith("org1", 2);
    expect(releaseSendQuota).toHaveBeenCalledWith("org1", 2);
    expect(publishSesBatches).not.toHaveBeenCalled();
  });

  it("only lets the schedule start a campaign that is still scheduled", async () => {
    vi.mocked(getCampaign).mockResolvedValue({ ...campaign, status: "scheduled" } as never);

    await dispatchCampaign("c1", "schedule");

    expect(claimCampaignForSending).toHaveBeenCalledWith("c1", ["scheduled"]);
  });

  it("refuses without claiming when the quota is short", async () => {
    vi.mocked(tryReserveSendQuota).mockResolvedValue(false);
    vi.mocked(getSendUsage).mockResolvedValue({ used: 999, limit: 1000 });

    await expect(dispatchCampaign("c1", "now")).rejects.toBeInstanceOf(SendRefusedError);
    expect(claimCampaignForSending).not.toHaveBeenCalled();
    expect(publishSesBatches).not.toHaveBeenCalled();
  });

  it("refuses an empty audience without reserving anything", async () => {
    vi.mocked(prepareCampaignAudience).mockResolvedValue([]);

    await expect(dispatchCampaign("c1", "now")).rejects.toBeInstanceOf(SendRefusedError);
    expect(tryReserveSendQuota).not.toHaveBeenCalled();
  });
});
