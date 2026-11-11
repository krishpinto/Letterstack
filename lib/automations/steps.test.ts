import { describe, expect, it } from "vitest";
import {
  delayStepKey,
  hopStepKey,
  legacyRunId,
  newRunId,
  qstashDedupeId,
  sendStepKey,
} from "./steps";

describe("automation step keys", () => {
  it("gives each kind of step on a node its own key", () => {
    const keys = [sendStepKey("n_1"), delayStepKey("n_1"), hopStepKey("n_1", 1)];
    expect(new Set(keys).size).toBe(3);
  });

  it("gives each hop of a long delay its own key", () => {
    expect(hopStepKey("n_1", 1)).not.toBe(hopStepKey("n_1", 2));
  });

  it("builds QStash deduplication ids from safe characters only", () => {
    const id = qstashDedupeId("6f1c0b9e-1111-4222-8333-944455556666", hopStepKey("n_ab", 2));
    expect(id).toMatch(/^[A-Za-z0-9._-]+$/);
    expect(id).toContain("6f1c0b9e-1111-4222-8333-944455556666");
  });

  it("keeps dedupe ids distinct across runs and steps", () => {
    expect(qstashDedupeId("run-a", delayStepKey("n_1"))).not.toBe(
      qstashDedupeId("run-b", delayStepKey("n_1")),
    );
    expect(qstashDedupeId("run-a", delayStepKey("n_1"))).not.toBe(
      qstashDedupeId("run-a", delayStepKey("n_2")),
    );
  });
});

describe("run ids", () => {
  it("mints a different id for every run", () => {
    expect(newRunId()).not.toBe(newRunId());
  });

  it("derives a stable id for a legacy message from its QStash message id", () => {
    expect(legacyRunId("msg_123")).toBe(legacyRunId("msg_123"));
    expect(legacyRunId("msg_123")).not.toBe(legacyRunId("msg_456"));
  });

  it("falls back to a fresh id when the message id is missing", () => {
    expect(legacyRunId(null)).not.toBe(legacyRunId(null));
    expect(legacyRunId("  ")).not.toBe("qstash-");
  });
});
