// The automation flow model. Stored in automations.flow as JSONB and shared
// by the canvas builder (which derives its layout from it) and the execution
// engine (which walks it per contact). It is a tree, not a graph: every node
// has one parent, linear nodes have one `next`, conditions have two branches.

export type TriggerEvent = "contact.added" | "contact.unsubscribed";

export type AutomationNodeType =
  | "trigger"
  | "send_email"
  | "condition"
  | "delay"
  | "update_contact"
  | "delete_contact"
  | "add_category";

export type TriggerConfig = { event: TriggerEvent };

export type SendEmailConfig = {
  templateId: string;
  fromName: string;
  fromEmail: string;
};

export type ConditionField = "email" | "name";
export type ConditionOperator =
  | "contains"
  | "not_contains"
  | "equals"
  | "ends_with"
  | "exists";

export type ConditionConfig = {
  field: ConditionField;
  operator: ConditionOperator;
  value: string;
};

export type DelayUnit = "minutes" | "hours" | "days";
export type DelayConfig = { amount: number; unit: DelayUnit };

export type UpdateContactConfig = { name: string };
export type AddCategoryConfig = { categoryId: string };

export type AutomationNodeConfig =
  | TriggerConfig
  | SendEmailConfig
  | ConditionConfig
  | DelayConfig
  | UpdateContactConfig
  | AddCategoryConfig
  | Record<string, never>;

export type AutomationNode = {
  id: string;
  type: AutomationNodeType;
  config: AutomationNodeConfig;
  /** Linear successor (all node types except condition). */
  next?: string | null;
  /** Condition branches. */
  trueNext?: string | null;
  falseNext?: string | null;
};

export type AutomationFlow = {
  version: 1;
  rootId: string;
  nodes: Record<string, AutomationNode>;
};

// ─── Catalogs (drive the builder palette and labels) ─────────────────────────

export const TRIGGER_EVENTS: {
  event: TriggerEvent;
  label: string;
  description: string;
}[] = [
  {
    event: "contact.added",
    label: "Contact added",
    description: "Fires when a new contact joins the audience (form signup, manual add, or import).",
  },
  {
    event: "contact.unsubscribed",
    label: "Contact unsubscribed",
    description: "Fires when a contact unsubscribes from your emails.",
  },
];

export const NODE_CATALOG: {
  type: Exclude<AutomationNodeType, "trigger">;
  label: string;
  group: "Messages" | "Flow control" | "Audience";
}[] = [
  { type: "send_email", label: "Send email", group: "Messages" },
  { type: "condition", label: "Condition", group: "Flow control" },
  { type: "delay", label: "Delay", group: "Flow control" },
  { type: "update_contact", label: "Update contact", group: "Audience" },
  { type: "add_category", label: "Add to category", group: "Audience" },
  { type: "delete_contact", label: "Delete contact", group: "Audience" },
];

export const CONDITION_FIELDS: { value: ConditionField; label: string }[] = [
  { value: "email", label: "Email address" },
  { value: "name", label: "Name" },
];

export const CONDITION_OPERATORS: {
  value: ConditionOperator;
  label: string;
  needsValue: boolean;
}[] = [
  { value: "contains", label: "contains", needsValue: true },
  { value: "not_contains", label: "does not contain", needsValue: true },
  { value: "equals", label: "equals", needsValue: true },
  { value: "ends_with", label: "ends with", needsValue: true },
  { value: "exists", label: "is set", needsValue: false },
];

export const DELAY_UNITS: { value: DelayUnit; label: string }[] = [
  { value: "minutes", label: "minutes" },
  { value: "hours", label: "hours" },
  { value: "days", label: "days" },
];

// ─── Helpers ─────────────────────────────────────────────────────────────────

export function newNodeId() {
  return `n_${Math.random().toString(36).slice(2, 10)}`;
}

export function createDefaultFlow(): AutomationFlow {
  const rootId = newNodeId();
  return {
    version: 1,
    rootId,
    nodes: {
      [rootId]: {
        id: rootId,
        type: "trigger",
        config: { event: "contact.added" },
        next: null,
      },
    },
  };
}

export function defaultConfigFor(
  type: Exclude<AutomationNodeType, "trigger">,
): AutomationNodeConfig {
  switch (type) {
    case "send_email":
      return { templateId: "", fromName: "", fromEmail: "" };
    case "condition":
      return { field: "email", operator: "contains", value: "" };
    case "delay":
      return { amount: 1, unit: "days" };
    case "update_contact":
      return { name: "" };
    case "add_category":
      return { categoryId: "" };
    case "delete_contact":
      return {};
  }
}

export function delayToMs(config: DelayConfig): number {
  const amount = Math.max(1, Math.floor(config.amount || 1));
  switch (config.unit) {
    case "minutes":
      return amount * 60_000;
    case "hours":
      return amount * 3_600_000;
    case "days":
      return amount * 86_400_000;
  }
}

/** Basic structural sanity check for a flow coming in over the API. */
export function isValidFlow(flow: unknown): flow is AutomationFlow {
  if (!flow || typeof flow !== "object") return false;
  const f = flow as AutomationFlow;
  if (f.version !== 1 || typeof f.rootId !== "string") return false;
  if (!f.nodes || typeof f.nodes !== "object") return false;
  const root = f.nodes[f.rootId];
  if (!root || root.type !== "trigger") return false;
  return Object.values(f.nodes).every(
    (node) =>
      node &&
      typeof node.id === "string" &&
      typeof node.type === "string" &&
      node.config !== undefined,
  );
}
