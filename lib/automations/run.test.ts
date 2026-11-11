// Replays of one automation-worker message must not repeat a send or a
// delay. Everything that reaches the database, SES or QStash is mocked; the
// step claims are an in-memory set with the same insert-if-absent rule as
// automation_step_runs.

import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AutomationFlow } from "./flow";

const state = vi.hoisted(() => ({
  claims: new Set<string>(),
  flow: null as unknown,
  updateFails: false,
}));

const mocks = vi.hoisted(() => ({
  sendEmail: vi.fn(),
  publish: vi.fn(),
  reserve: vi.fn(),
}));

vi.mock("@/db/client", async () => {
  const schema = await import("@/db/schema");
  return {
    db: {
      select: () => ({
        from: (table: unknown) => ({
          where: async () =>
            table === schema.emailTemplates
              ? [
                  {
                    id: "tpl-1",
                    organizationId: "org-1",
                    name: "Welcome",
                    subject: "Welcome",
                    document: { subject: "Welcome" },
                  },
                ]
              : [{ name: "Acme" }],
        }),
      }),
      update: () => ({
        set: () => ({
          where: async () => {
            if (state.updateFails) throw new Error("database hiccup");
          },
        }),
      }),
    },
  };
});

vi.mock("@/db/automations", () => ({
  getAutomationById: async (id: string) => ({
    id,
    organizationId: "org-1",
    status: "enabled",
    flow: state.flow,
  }),
  listEnabledAutomationsForOrganization: async () => [],
  claimAutomationStep: async (_automationId: string, runId: string, key: string) => {
    const claim = `${runId}|${key}`;
    if (state.claims.has(claim)) return false;
    state.claims.add(claim);
    return true;
  },
  releaseAutomationStep: async (runId: string, key: string) => {
    state.claims.delete(`${runId}|${key}`);
  },
}));

vi.mock("@/db/suppression", () => ({
  isSuppressedForOrganization: async () => false,
}));
vi.mock("@/db/organizations", () => ({ tryReserveSendQuota: mocks.reserve }));
vi.mock("@/db/sending-domains", () => ({
  listVerifiedSendingDomains: async () => ["acme.com"],
}));
vi.mock("@/lib/email/compiler", () => ({
  compileEmailDocument: () => ({ html: "<p>{{unsubscribe_url}}</p>", text: "{{unsubscribe_url}}" }),
}));
vi.mock("@/lib/email/document", () => ({ normalizeDocument: (doc: unknown) => doc }));
vi.mock("@/lib/email/templates", () => ({ resolveTemplateVariables: () => {} }));
vi.mock("@/lib/send/ses", () => ({ sendEmail: mocks.sendEmail }));
vi.mock("@/lib/send/qstash", () => ({
  appBaseUrl: () => "https://app.test",
  publishQstashJSON: mocks.publish,
  qstashNotBefore: (ms: number) => Math.floor(ms / 1000),
}));

const { runAutomationFromNode } = await import("./run");

function flow(nodes: AutomationFlow["nodes"]): AutomationFlow {
  return { version: 1, rootId: "t", nodes };
}

const sendThenUpdate = flow({
  t: { id: "t", type: "trigger", config: { event: "contact.added" }, next: "s" },
  s: {
    id: "s",
    type: "send_email",
    config: { templateId: "tpl-1", fromName: "Acme", fromEmail: "hello@acme.com" },
    next: "u",
  },
  u: { id: "u", type: "update_contact", config: { name: "Ada" }, next: null },
});

const sendThenDelay = flow({
  t: { id: "t", type: "trigger", config: { event: "contact.added" }, next: "s" },
  s: {
    id: "s",
    type: "send_email",
    config: { templateId: "tpl-1", fromName: "Acme", fromEmail: "hello@acme.com" },
    next: "d",
  },
  d: { id: "d", type: "delay", config: { amount: 1, unit: "days" }, next: "s2" },
  s2: {
    id: "s2",
    type: "send_email",
    config: { templateId: "tpl-1", fromName: "Acme", fromEmail: "hello@acme.com" },
    next: null,
  },
});

const payload = {
  automationId: "auto-1",
  organizationId: "org-1",
  nodeId: "s",
  contact: { id: "c-1", email: "ada@example.com", name: null, userId: "user-1" },
  runId: "run-1",
};

beforeEach(() => {
  process.env.UNSUBSCRIBE_SECRET = "test-secret";
  state.claims.clear();
  state.updateFails = false;
  mocks.sendEmail.mockReset().mockResolvedValue(undefined);
  mocks.publish.mockReset().mockResolvedValue(undefined);
  mocks.reserve.mockReset().mockResolvedValue(true);
});

describe("runAutomationFromNode replays", () => {
  it("does not resend or re-reserve quota when a later step threw", async () => {
    state.flow = sendThenUpdate;
    state.updateFails = true;
    await expect(runAutomationFromNode(payload)).rejects.toThrow("database hiccup");

    // QStash redelivers the same message; the later step now succeeds.
    state.updateFails = false;
    const trace = await runAutomationFromNode(payload);

    expect(mocks.sendEmail).toHaveBeenCalledTimes(1);
    expect(mocks.reserve).toHaveBeenCalledTimes(1);
    expect(trace[0]).toMatch(/already sent/);
    expect(trace).toContain("update_contact: done");
  });

  it("retries the send when SES refused it", async () => {
    state.flow = sendThenUpdate;
    mocks.sendEmail.mockRejectedValueOnce(new Error("SES throttled"));
    await expect(runAutomationFromNode(payload)).rejects.toThrow("SES throttled");

    const trace = await runAutomationFromNode(payload);
    expect(mocks.sendEmail).toHaveBeenCalledTimes(2);
    expect(trace[0]).toBe("send_email: sent to ada@example.com");
  });

  it("publishes a delay's continuation once, with a dedupe id and the run id", async () => {
    state.flow = sendThenDelay;
    await runAutomationFromNode(payload);
    const replay = await runAutomationFromNode(payload);

    expect(mocks.publish).toHaveBeenCalledTimes(1);
    const message = mocks.publish.mock.calls[0][0];
    expect(message.deduplicationId).toMatch(/run-1/);
    expect(message.body).toMatchObject({ nodeId: "s2", runId: "run-1" });
    expect(replay.at(-1)).toMatch(/already published/);
  });

  it("gives a send's claim back when the allowance is used up", async () => {
    state.flow = sendThenUpdate;
    mocks.reserve.mockResolvedValueOnce(false);
    const first = await runAutomationFromNode(payload);
    expect(first[0]).toMatch(/allowance reached/);

    const second = await runAutomationFromNode(payload);
    expect(second[0]).toBe("send_email: sent to ada@example.com");
    expect(mocks.sendEmail).toHaveBeenCalledTimes(1);
  });

  it("treats separate runs for the same contact independently", async () => {
    state.flow = sendThenUpdate;
    await runAutomationFromNode(payload);
    await runAutomationFromNode({ ...payload, runId: "run-2" });
    expect(mocks.sendEmail).toHaveBeenCalledTimes(2);
  });
});
