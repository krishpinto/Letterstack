// Automation execution engine. Trigger hooks call enqueueAutomationsForEvent,
// which fans one QStash message out per (automation × contact) to
// /api/send/automation-worker. The worker calls runAutomationFromNode, which
// walks the flow tree inline until it finishes or hits a Delay — a Delay
// re-enqueues the continuation with QStash's notBefore and stops. All of the
// heavy lifting (compile, suppression, unsubscribe links) reuses the campaign
// send path.
//
// QStash delivers at least once, so a message can arrive twice and a failed
// one is replayed from its first node. Each (automation, contact) pass is one
// run with a runId carried through every delay; steps with an outside effect
// (send_email, the publish behind a delay) are claimed once per run in
// automation_step_runs, and a replay skips what an earlier delivery did.

import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import {
  emailTemplates,
  organizations,
  recipientCategories,
  recipients,
} from "@/db/schema";
import {
  claimAutomationStep,
  getAutomationById,
  listEnabledAutomationsForOrganization,
  releaseAutomationStep,
} from "@/db/automations";
import { isSuppressedForOrganization } from "@/db/suppression";
import { tryReserveSendQuota } from "@/db/organizations";
import { listVerifiedSendingDomains } from "@/db/sending-domains";
import { compileEmailDocument } from "@/lib/email/compiler";
import { normalizeDocument, type EmailDocument } from "@/lib/email/document";
import { resolveTemplateVariables } from "@/lib/email/templates";
import {
  personalizeUnsubscribe,
  unsubscribeOneClickUrl,
  unsubscribePageUrl,
} from "@/lib/email/unsubscribe";
import { sendEmail } from "@/lib/send/ses";
import {
  appBaseUrl,
  publishQstashJSON,
  qstashNotBefore,
} from "@/lib/send/qstash";
import {
  delayToMs,
  type AutomationFlow,
  type AutomationNode,
  type ConditionConfig,
  type DelayConfig,
  type SendEmailConfig,
  type TriggerEvent,
  type UpdateContactConfig,
  type AddCategoryConfig,
} from "./flow";
import { isAllowedAutomationSender, normalizeSender } from "./senders";
import {
  delayStepKey,
  hopStepKey,
  newRunId,
  qstashDedupeId,
  sendStepKey,
} from "./steps";

/** Guard against cycles / runaway flows. */
const MAX_STEPS = 25;

export type AutomationContact = {
  id: string;
  email: string;
  name: string | null;
  userId: string;
};

export type AutomationWorkerPayload = {
  automationId: string;
  organizationId: string;
  nodeId: string;
  contact: AutomationContact;
  /**
   * One contact's pass through one automation, minted when the trigger fires
   * and carried through every delay. Keys the step claims. Missing only on
   * messages queued before it existed; the worker fills those in.
   */
  runId?: string;
  /** Set by Delay nodes: don't run nodeId before this time (enables hops past QStash's max delay). */
  resumeAtMs?: number;
  /** How many hops of a long delay this message has already made. */
  hop?: number;
};

/**
 * Called from trigger hooks (contact add, import, unsubscribe). Never throws:
 * an automation failure must not break the operation that triggered it.
 */
export async function enqueueAutomationsForEvent(
  organizationId: string,
  event: TriggerEvent,
  contacts: AutomationContact[],
) {
  if (contacts.length === 0) return;

  try {
    const enabled = await listEnabledAutomationsForOrganization(organizationId);
    const matching = enabled.filter((automation) => {
      const flow = automation.flow as AutomationFlow;
      const root = flow?.nodes?.[flow.rootId];
      const config = root?.config as { event?: TriggerEvent } | undefined;
      return root?.type === "trigger" && config?.event === event && root.next;
    });
    if (matching.length === 0) return;

    const url = `${appBaseUrl()}/api/send/automation-worker`;
    await Promise.all(
      matching.flatMap((automation) => {
        const flow = automation.flow as AutomationFlow;
        const firstNodeId = flow.nodes[flow.rootId].next!;
        return contacts.map((contact) =>
          publishQstashJSON({
            url,
            body: {
              automationId: automation.id,
              organizationId,
              nodeId: firstNodeId,
              contact,
              runId: newRunId(),
            } satisfies AutomationWorkerPayload,
          }),
        );
      }),
    );
  } catch (err) {
    console.error(
      `automations: enqueue failed for ${event} in org ${organizationId}:`,
      err instanceof Error ? err.message : err,
    );
  }
}

/** Walk the flow from a node. Returns a short trace for logging. */
export async function runAutomationFromNode(
  payload: AutomationWorkerPayload & { runId: string },
): Promise<string[]> {
  const trace: string[] = [];
  const { runId } = payload;
  const automation = await getAutomationById(payload.automationId);

  if (!automation) return ["automation missing — skipped"];
  if (automation.organizationId !== payload.organizationId) {
    return ["organization mismatch — skipped"];
  }
  if (automation.status !== "enabled") return ["automation disabled — skipped"];

  // Delay resumption that arrived early (delays longer than QStash's max
  // delay hop in stretches): sleep another stretch and come back.
  if (payload.resumeAtMs && payload.resumeAtMs - Date.now() > 5_000) {
    const hop = (payload.hop ?? 0) + 1;
    const published = await publishOnce(
      automation.id,
      runId,
      hopStepKey(payload.nodeId, hop),
      {
        notBefore: qstashNotBefore(payload.resumeAtMs),
        body: { ...payload, hop } satisfies AutomationWorkerPayload,
      },
    );
    return [
      published
        ? `delay: not due yet — hopped toward ${new Date(payload.resumeAtMs).toISOString()}`
        : "delay: hop already published by an earlier delivery — stopped",
    ];
  }

  const flow = automation.flow as AutomationFlow;
  let nodeId: string | null | undefined = payload.nodeId;
  let contact = payload.contact;

  for (let step = 0; step < MAX_STEPS && nodeId; step++) {
    const node: AutomationNode | undefined = flow.nodes[nodeId];
    if (!node) {
      trace.push(`node ${nodeId} missing (flow edited) — stopped`);
      break;
    }

    switch (node.type) {
      case "trigger": {
        nodeId = node.next;
        break;
      }

      case "send_email": {
        const result = await executeSendEmail(
          node.config as SendEmailConfig,
          automation.organizationId,
          automation.id,
          contact,
          { runId, stepKey: sendStepKey(node.id) },
        );
        trace.push(`send_email: ${result}`);
        nodeId = node.next;
        break;
      }

      case "condition": {
        const passed = evaluateCondition(node.config as ConditionConfig, contact);
        trace.push(`condition: ${passed}`);
        nodeId = passed ? node.trueNext : node.falseNext;
        break;
      }

      case "delay": {
        if (!node.next) {
          trace.push("delay: nothing after it — done");
          nodeId = null;
          break;
        }
        const ms = delayToMs(node.config as DelayConfig);
        const resumeAtMs = Date.now() + ms;
        const published = await publishOnce(automation.id, runId, delayStepKey(node.id), {
          notBefore: qstashNotBefore(resumeAtMs),
          body: {
            automationId: automation.id,
            organizationId: automation.organizationId,
            nodeId: node.next,
            contact,
            runId,
            resumeAtMs,
          } satisfies AutomationWorkerPayload,
        });
        trace.push(
          published
            ? `delay: resuming in ${Math.round(ms / 60000)} min`
            : "delay: continuation already published by an earlier delivery — stopped",
        );
        return trace;
      }

      case "update_contact": {
        const config = node.config as UpdateContactConfig;
        if (config.name?.trim()) {
          await db
            .update(recipients)
            .set({ name: config.name.trim() })
            .where(eq(recipients.id, contact.id));
          contact = { ...contact, name: config.name.trim() };
        }
        trace.push("update_contact: done");
        nodeId = node.next;
        break;
      }

      case "add_category": {
        const config = node.config as AddCategoryConfig;
        if (config.categoryId) {
          await db
            .insert(recipientCategories)
            .values({ recipientId: contact.id, categoryId: config.categoryId })
            .onConflictDoNothing();
        }
        trace.push("add_category: done");
        nodeId = node.next;
        break;
      }

      case "delete_contact": {
        await db.delete(recipients).where(eq(recipients.id, contact.id));
        trace.push("delete_contact: done");
        nodeId = node.next;
        break;
      }
    }
  }

  if (trace.length === 0) trace.push("nothing to do");
  return trace;
}

/**
 * Publish a continuation of this run at most once. Returns false when an
 * earlier delivery already claimed the step: that delivery published (or is
 * publishing) the same continuation, and a second one would walk the rest of
 * the flow twice. If QStash rejects the publish the claim is given back and
 * the error rethrown, so the worker returns 500 and QStash retries.
 */
async function publishOnce(
  automationId: string,
  runId: string,
  stepKey: string,
  message: { notBefore: number; body: AutomationWorkerPayload },
): Promise<boolean> {
  if (!(await claimAutomationStep(automationId, runId, stepKey))) return false;
  try {
    await publishQstashJSON({
      url: `${appBaseUrl()}/api/send/automation-worker`,
      notBefore: message.notBefore,
      body: message.body,
      deduplicationId: qstashDedupeId(runId, stepKey),
    });
  } catch (err) {
    await releaseAutomationStep(runId, stepKey);
    throw err;
  }
  return true;
}

function evaluateCondition(config: ConditionConfig, contact: AutomationContact) {
  const raw = config.field === "email" ? contact.email : contact.name ?? "";
  const value = raw.toLowerCase();
  const target = (config.value ?? "").toLowerCase();

  switch (config.operator) {
    case "contains":
      return value.includes(target);
    case "not_contains":
      return !value.includes(target);
    case "equals":
      return value === target;
    case "ends_with":
      return value.endsWith(target);
    case "exists":
      return raw.trim().length > 0;
    default:
      return false;
  }
}

async function executeSendEmail(
  config: SendEmailConfig,
  organizationId: string,
  automationId: string,
  contact: AutomationContact,
  step: { runId: string; stepKey: string },
): Promise<string> {
  if (!config.templateId || !config.fromEmail) {
    return "not configured — skipped";
  }
  // Re-checked here, not only on save: a flow saved before the check
  // existed, or whose domain has since been removed, must not send.
  const fromEmail = normalizeSender(config.fromEmail);
  if (
    !isAllowedAutomationSender(fromEmail, await listVerifiedSendingDomains(organizationId))
  ) {
    return `sender ${fromEmail} not allowed for this workspace — skipped`;
  }
  if (await isSuppressedForOrganization(organizationId, contact.email)) {
    return `suppressed ${contact.email} — skipped`;
  }

  const [template] = await db
    .select()
    .from(emailTemplates)
    .where(eq(emailTemplates.id, config.templateId));
  if (!template || template.organizationId !== organizationId || !template.document) {
    return "template missing — skipped";
  }

  const [organization] = await db
    .select({ name: organizations.name })
    .from(organizations)
    .where(eq(organizations.id, organizationId));

  // Build the whole message before claiming the step, so nothing between the
  // claim and the SES call can fail except SES itself.
  const doc = normalizeDocument(
    JSON.parse(JSON.stringify(template.document)) as EmailDocument,
  );
  resolveTemplateVariables(doc, {
    organization: organization?.name || config.fromName || "our team",
  });
  const compiled = compileEmailDocument(doc);

  const base = appBaseUrl();
  const personalized = personalizeUnsubscribe(
    { html: compiled.html, text: compiled.text },
    unsubscribePageUrl(base, organizationId, contact.userId, contact.email),
  );

  // At most once per run: a redelivery of this message (QStash retries after
  // a later step threw, or delivers twice) finds the claim and skips, so the
  // contact is not mailed twice and quota is not spent twice.
  if (!(await claimAutomationStep(automationId, step.runId, step.stepKey))) {
    return `already sent to ${contact.email} by an earlier delivery — skipped`;
  }

  // Reserve last, after every reason to skip, so a skipped step doesn't
  // spend the workspace's monthly allowance.
  if (!(await tryReserveSendQuota(organizationId, 1))) {
    // Nothing was sent. Give the claim back; a replay hits the same limit
    // unless the allowance has grown since.
    await releaseAutomationStep(step.runId, step.stepKey);
    return `monthly send allowance reached — skipped ${contact.email}`;
  }

  try {
    await sendEmail({
      to: contact.email,
      subject: doc.subject || template.subject || template.name,
      html: personalized.html,
      text: personalized.text,
      fromName: config.fromName || "LetterStack",
      fromEmail,
      listUnsubscribeUrl: unsubscribeOneClickUrl(base, organizationId, contact.userId, contact.email),
      tags: [{ name: "automationId", value: automationId }],
    });
  } catch (err) {
    // SES refused the message, so QStash's retry should try again. If the
    // function dies before this line instead, the claim stays and the step
    // is skipped on replay: at most once, as for campaign sends. The unit of
    // quota reserved above is not returned (there is no refund path yet), so
    // a retry after an SES error reserves another.
    await releaseAutomationStep(step.runId, step.stepKey);
    throw err;
  }

  return `sent to ${contact.email}`;
}
