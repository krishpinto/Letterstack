import { beforeEach, describe, expect, it, vi } from "vitest";

const { verify } = vi.hoisted(() => ({ verify: vi.fn() }));

vi.mock("@upstash/qstash", () => ({
  Receiver: class {
    verify = verify;
  },
}));
vi.mock("@/db/campaign-recipients", () => ({
  recipientStatusCounts: vi.fn(),
  settleStaleClaims: vi.fn(),
}));
vi.mock("@/db/campaigns", () => ({
  markCampaignFailed: vi.fn(),
  markCampaignSent: vi.fn(),
}));
vi.mock("@/lib/notifications/campaign-notifications", () => ({
  notifyCampaignFailed: vi.fn(),
  notifyCampaignFinished: vi.fn(),
}));
vi.mock("./qstash", () => ({
  appBaseUrl: () => "https://app.test",
  publishQstashJSON: vi.fn(),
  qstashNotBefore: (ms: number) => Math.floor(ms / 1000),
}));

import { recipientStatusCounts, settleStaleClaims } from "@/db/campaign-recipients";
import { markCampaignFailed, markCampaignSent } from "@/db/campaigns";
import {
  notifyCampaignFailed,
  notifyCampaignFinished,
} from "@/lib/notifications/campaign-notifications";
import { settleCampaign, verifyQstashRequest } from "./qstash-worker";

const counts = (over: Partial<Record<"pending" | "sending" | "sent" | "failed", number>>) => ({
  pending: 0,
  sending: 0,
  sent: 0,
  failed: 0,
  ...over,
});

beforeEach(() => {
  vi.clearAllMocks();
});

describe("verifyQstashRequest", () => {
  const request = () =>
    new Request("https://app.test/api/send/campaign-worker", {
      method: "POST",
      headers: { "upstash-signature": "sig" },
      body: '{"a":1}',
    });

  it("checks the signature against this route's own URL", async () => {
    verify.mockResolvedValue(true);

    const body = await verifyQstashRequest(request(), "/api/send/campaign-worker");

    expect(body).toBe('{"a":1}');
    expect(verify).toHaveBeenCalledWith({
      body: '{"a":1}',
      signature: "sig",
      url: "https://app.test/api/send/campaign-worker",
    });
  });

  it("rejects when verification fails or throws", async () => {
    verify.mockResolvedValueOnce(false).mockRejectedValueOnce(new Error("bad url"));

    expect(await verifyQstashRequest(request(), "/api/send/campaign-worker")).toBeNull();
    expect(await verifyQstashRequest(request(), "/api/send/campaign-worker")).toBeNull();
  });
});

describe("settleCampaign", () => {
  it("leaves an unfinished campaign alone", async () => {
    vi.mocked(recipientStatusCounts).mockResolvedValue(counts({ pending: 1, sent: 4 }));

    expect(await settleCampaign("c1")).toEqual({ inFlight: 0 });
    expect(markCampaignSent).not.toHaveBeenCalled();
    expect(markCampaignFailed).not.toHaveBeenCalled();
  });

  it("settles timed-out claims first", async () => {
    vi.mocked(recipientStatusCounts).mockResolvedValue(counts({ sending: 2 }));

    expect(await settleCampaign("c1")).toEqual({ inFlight: 2 });
    expect(settleStaleClaims).toHaveBeenCalledWith("c1", expect.any(Number));
  });

  it("marks a finished campaign sent and notifies only from the call that did it", async () => {
    vi.mocked(recipientStatusCounts).mockResolvedValue(counts({ sent: 5, failed: 1 }));
    vi.mocked(markCampaignSent).mockResolvedValueOnce(true).mockResolvedValueOnce(false);

    await settleCampaign("c1");
    await settleCampaign("c1");

    expect(notifyCampaignFinished).toHaveBeenCalledTimes(1);
  });

  it("marks a campaign that reached nobody failed", async () => {
    vi.mocked(recipientStatusCounts).mockResolvedValue(counts({ failed: 3 }));
    vi.mocked(markCampaignFailed).mockResolvedValue(true);

    await settleCampaign("c1");

    expect(markCampaignFailed).toHaveBeenCalledWith("c1", expect.any(String), ["sending"]);
    expect(notifyCampaignFailed).toHaveBeenCalledTimes(1);
    expect(markCampaignSent).not.toHaveBeenCalled();
  });
});
