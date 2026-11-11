// Names for the steps of an automation run that must happen at most once.
//
// QStash delivers every worker message at least once, and when the worker
// fails it redelivers the whole message, which restarts the walk at the same
// node. Steps that only read or that are idempotent (conditions, contact
// updates, add-to-category, delete) can safely run again. Steps with an
// outside effect cannot: a send_email would mail the contact twice and spend
// quota twice, and a delay would publish a second continuation that walks the
// rest of the flow in parallel. Those steps are claimed in
// automation_step_runs under (runId, stepKey) before they act.

import crypto from "node:crypto";

/** The claim key for a send_email node. */
export function sendStepKey(nodeId: string): string {
  return `send:${nodeId}`;
}

/** The claim key for the continuation a delay node publishes. */
export function delayStepKey(nodeId: string): string {
  return `delay:${nodeId}`;
}

/**
 * The claim key for one hop of a long delay. A delay longer than QStash's
 * maximum is split into hops (see qstashNotBefore), each a separate publish,
 * so each hop number is its own step.
 */
export function hopStepKey(nodeId: string, hop: number): string {
  return `hop:${nodeId}:${hop}`;
}

/**
 * A QStash deduplication id for a publish made by a claimed step. The claim
 * already stops a second publish; this also covers two deliveries that race
 * between the claim and the publish. QStash only documents ids made of
 * letters, digits, dots, dashes and underscores, so anything else is mapped
 * to an underscore.
 */
export function qstashDedupeId(runId: string, stepKey: string): string {
  return `automation.${runId}.${stepKey}`.replace(/[^A-Za-z0-9._-]/g, "_");
}

/** A fresh run id, minted once per (automation, contact) when a trigger fires. */
export function newRunId(): string {
  return crypto.randomUUID();
}

/**
 * The run id for a message published before run ids existed. QStash keeps a
 * message's id across its retries, so it identifies the run well enough to
 * stop a retry repeating a send. Without one (never expected from QStash)
 * the message gets a fresh id and simply has no replay protection.
 */
export function legacyRunId(qstashMessageId: string | null | undefined): string {
  const id = qstashMessageId?.trim();
  return id ? `qstash-${id}` : newRunId();
}
