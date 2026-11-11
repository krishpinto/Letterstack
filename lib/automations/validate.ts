// What a flow needs before it may go live.
//
// isValidFlow (./flow) only checks the shape of what the API received, which
// a brand-new draft passes: a trigger and nothing after it. Switching such a
// flow on did nothing at all, and a send step with no template or sender was
// skipped on every run without telling anyone. This is the stricter check for
// "enabled": run when an automation is switched on, and when a flow is saved
// while it is live. Drafts can still be saved half-finished.

import {
  NODE_CATALOG,
  TRIGGER_EVENTS,
  type AddCategoryConfig,
  type AutomationFlow,
  type AutomationNode,
  type SendEmailConfig,
  type TriggerConfig,
} from "./flow";

/** Node types that change something, as opposed to routing or waiting. */
const ACTION_TYPES = new Set<AutomationNode["type"]>([
  "send_email",
  "update_contact",
  "add_category",
  "delete_contact",
]);

function label(node: AutomationNode): string {
  return NODE_CATALOG.find((item) => item.type === node.type)?.label ?? node.type;
}

/** Every node reachable from the trigger, in walk order. Cycle-safe. */
function reachableSteps(flow: AutomationFlow): AutomationNode[] {
  const seen = new Set<string>();
  const out: AutomationNode[] = [];
  const queue: (string | null | undefined)[] = [flow.nodes[flow.rootId]?.next];
  while (queue.length > 0) {
    const id = queue.shift();
    if (!id || seen.has(id)) continue;
    seen.add(id);
    const node = flow.nodes[id];
    if (!node) continue;
    out.push(node);
    queue.push(node.next, node.trueNext, node.falseNext);
  }
  return out;
}

function unconfigured(node: AutomationNode): boolean {
  switch (node.type) {
    case "send_email": {
      const config = node.config as SendEmailConfig;
      return !config?.templateId || !config?.fromEmail?.trim();
    }
    case "add_category":
      return !(node.config as AddCategoryConfig)?.categoryId;
    default:
      return false;
  }
}

/**
 * Why this flow can't be switched on, as a sentence for the person turning it
 * on, or null when it can.
 */
export function enableProblem(flow: AutomationFlow): string | null {
  const root = flow.nodes[flow.rootId];
  const event = (root?.config as TriggerConfig | undefined)?.event;
  if (root?.type !== "trigger" || !TRIGGER_EVENTS.some((t) => t.event === event)) {
    return "Choose a trigger before turning this automation on.";
  }

  const steps = reachableSteps(flow);
  if (!steps.some((node) => ACTION_TYPES.has(node.type))) {
    return "Add at least one step that does something (such as Send email) before turning this automation on.";
  }

  const incomplete = steps.find(unconfigured);
  if (incomplete) {
    return `Finish setting up the "${label(incomplete)}" step before turning this automation on.`;
  }

  return null;
}
