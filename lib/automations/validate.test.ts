import { describe, expect, it } from "vitest";
import { createDefaultFlow, type AutomationFlow } from "./flow";
import { enableProblem } from "./validate";

function flow(nodes: AutomationFlow["nodes"]): AutomationFlow {
  return { version: 1, rootId: "t", nodes };
}

const send = {
  id: "s",
  type: "send_email" as const,
  config: { templateId: "tpl", fromName: "Acme", fromEmail: "hello@acme.com" },
  next: null,
};

describe("enableProblem", () => {
  it("rejects a new draft with only a trigger", () => {
    expect(enableProblem(createDefaultFlow())).toMatch(/at least one step/);
  });

  it("rejects a flow whose root is not a known trigger", () => {
    expect(
      enableProblem(
        flow({ t: { id: "t", type: "trigger", config: { event: "nope" } as never, next: "s" }, s: send }),
      ),
    ).toMatch(/trigger/);
  });

  it("rejects a flow that only waits or branches", () => {
    expect(
      enableProblem(
        flow({
          t: { id: "t", type: "trigger", config: { event: "contact.added" }, next: "d" },
          d: { id: "d", type: "delay", config: { amount: 1, unit: "days" }, next: "c" },
          c: {
            id: "c",
            type: "condition",
            config: { field: "email", operator: "exists", value: "" },
            trueNext: null,
            falseNext: null,
          },
        }),
      ),
    ).toMatch(/at least one step/);
  });

  it("ignores action nodes no path reaches", () => {
    expect(
      enableProblem(
        flow({
          t: { id: "t", type: "trigger", config: { event: "contact.added" }, next: null },
          s: send,
        }),
      ),
    ).toMatch(/at least one step/);
  });

  it("rejects a send step with no template or sender", () => {
    expect(
      enableProblem(
        flow({
          t: { id: "t", type: "trigger", config: { event: "contact.added" }, next: "s" },
          s: { ...send, config: { templateId: "", fromName: "", fromEmail: "" } },
        }),
      ),
    ).toMatch(/Send email/);
  });

  it("finds an unfinished step on a condition branch", () => {
    expect(
      enableProblem(
        flow({
          t: { id: "t", type: "trigger", config: { event: "contact.added" }, next: "c" },
          c: {
            id: "c",
            type: "condition",
            config: { field: "email", operator: "exists", value: "" },
            trueNext: "s",
            falseNext: "a",
          },
          s: send,
          a: { id: "a", type: "add_category", config: { categoryId: "" }, next: null },
        }),
      ),
    ).toMatch(/Add to category/);
  });

  it("accepts a configured flow", () => {
    expect(
      enableProblem(
        flow({
          t: { id: "t", type: "trigger", config: { event: "contact.unsubscribed" }, next: "s" },
          s: send,
        }),
      ),
    ).toBeNull();
  });

  it("survives a cycle in a corrupted flow", () => {
    expect(
      enableProblem(
        flow({
          t: { id: "t", type: "trigger", config: { event: "contact.added" }, next: "s" },
          s: { ...send, next: "s" },
        }),
      ),
    ).toBeNull();
  });
});
