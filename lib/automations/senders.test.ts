import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { AutomationFlow } from "./flow";
import {
  disallowedSenders,
  isAllowedAutomationSender,
  withNormalizedSenders,
} from "./senders";

const ORIGINAL_MAIL_FROM = process.env.MAIL_FROM;

beforeEach(() => {
  process.env.MAIL_FROM = "newsletter@letterstack.site";
});
afterEach(() => {
  process.env.MAIL_FROM = ORIGINAL_MAIL_FROM;
});

function flowWithSenders(...senders: string[]): AutomationFlow {
  const nodes: AutomationFlow["nodes"] = {
    t: { id: "t", type: "trigger", config: { event: "contact.added" }, next: "s0" },
  };
  senders.forEach((fromEmail, i) => {
    nodes[`s${i}`] = {
      id: `s${i}`,
      type: "send_email",
      config: { templateId: "tpl", fromName: "Acme", fromEmail },
      next: i + 1 < senders.length ? `s${i + 1}` : null,
    };
  });
  return { version: 1, rootId: "t", nodes };
}

describe("isAllowedAutomationSender", () => {
  it("allows the shared address, in any case", () => {
    expect(isAllowedAutomationSender("newsletter@letterstack.site", [])).toBe(true);
    expect(isAllowedAutomationSender(" Newsletter@LetterStack.site ", [])).toBe(true);
  });

  it("rejects any other address on the shared domain", () => {
    expect(isAllowedAutomationSender("billing@letterstack.site", [])).toBe(false);
  });

  it("allows any local part on the workspace's own verified domain", () => {
    expect(isAllowedAutomationSender("hello@acme.org", ["acme.org"])).toBe(true);
  });

  it("rejects an address on a domain the workspace has not verified", () => {
    // e.g. another customer's verified domain: SES would send it, we must not.
    expect(isAllowedAutomationSender("ceo@othercustomer.com", ["acme.org"])).toBe(false);
  });

  it("rejects empty input", () => {
    expect(isAllowedAutomationSender("  ", ["acme.org"])).toBe(false);
  });
});

describe("disallowedSenders", () => {
  it("lists every spoofed sender once, normalized", () => {
    const flow = flowWithSenders(
      "hello@acme.org",
      "Billing@LetterStack.site",
      "billing@letterstack.site",
    );
    expect(disallowedSenders(flow, ["acme.org"])).toEqual(["billing@letterstack.site"]);
  });

  it("ignores unconfigured send steps", () => {
    expect(disallowedSenders(flowWithSenders(""), [])).toEqual([]);
  });
});

describe("withNormalizedSenders", () => {
  it("trims and lowercases From addresses without touching the rest", () => {
    const flow = withNormalizedSenders(flowWithSenders(" Hello@Acme.org "));
    expect(flow.nodes.s0.config).toEqual({
      templateId: "tpl",
      fromName: "Acme",
      fromEmail: "hello@acme.org",
    });
    expect(flow.nodes.t).toEqual(flowWithSenders("x").nodes.t);
  });
});
