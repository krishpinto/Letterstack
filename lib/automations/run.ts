// Automation execution engine. Trigger hooks call enqueueAutomationsForEvent,
// which fans one QStash message out per (automation × contact) to
// /api/send/automation-worker. The worker calls runAutomationFromNode, which
// walks the flow tree inline until it finishes or hits a Delay — a Delay
// re-enqueues the continuation with QStash's notBefore and stops. All of the
// heavy lifting (compile, suppression, unsubscribe links) reuses the campaign
// send path.

import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import {
  emailTemplates,
  organizations,
  recipientCategories,
  recipients,
} from "@/db/schema";
import {
  getAutomationById,
  listEnabledAutomationsForOrganization,
} from "@/db/automations";
import { isSuppressedForOrganization } from "@/db/suppression";
import { compileEmailDocument } from "@/lib/email/compiler";
import { normalizeDocument, type EmailDocument } from "@/lib/email/document";
import { resolveTemplateVariables } from "@/lib/email/templates";
import {
  personalizeUnsubscribe,
  unsubscribeOneClickUrl,
  unsubscribePageUrl,
} from "@/lib/email/unsubscribe";
import { sendEmail } from "@/lib/send/ses";
import { appBaseUrl, publishQstashJSON } from "@/lib/send/qstash";
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
  payload: AutomationWorkerPayload,
): Promise<string[]> {
  const trace: string[] = [];
  const automation = await getAutomationById(payload.automationId);

  if (!automation) return ["automation missing — skipped"];
  if (automation.organizationId !== payload.organizationId) {
    return ["organization mismatch — skipped"];
  }
  if (automation.status !== "enabled") return ["automation disabled — skipped"];

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
        await publishQstashJSON({
          url: `${appBaseUrl()}/api/send/automation-worker`,
          notBefore: Math.floor((Date.now() + ms) / 1000),
          body: {
            automationId: automation.id,
            organizationId: automation.organizationId,
            nodeId: node.next,
            contact,
          } satisfies AutomationWorkerPayload,
        });
        trace.push(`delay: resuming in ${Math.round(ms / 60000)} min`);
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
): Promise<string> {
  if (!config.templateId || !config.fromEmail) {
    return "not configured — skipped";
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
    unsubscribePageUrl(base, contact.userId, contact.email),
  );

  await sendEmail({
    to: contact.email,
    subject: doc.subject || template.subject || template.name,
    html: personalized.html,
    text: personalized.text,
    fromName: config.fromName || "LetterStack",
    fromEmail: config.fromEmail,
    listUnsubscribeUrl: unsubscribeOneClickUrl(base, contact.userId, contact.email),
    tags: [{ name: "automationId", value: automationId }],
  });

  return `sent to ${contact.email}`;
}
