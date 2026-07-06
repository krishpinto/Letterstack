// Pure tree-editing helpers for AutomationFlow. Used by the builder UI only;
// every function returns a new flow object (React state friendly).

import {
  defaultConfigFor,
  newNodeId,
  type AutomationFlow,
  type AutomationNode,
  type AutomationNodeConfig,
  type AutomationNodeType,
} from "./flow";

export type BranchHandle = "next" | "true" | "false";

function cloneFlow(flow: AutomationFlow): AutomationFlow {
  return JSON.parse(JSON.stringify(flow)) as AutomationFlow;
}

function childOf(node: AutomationNode, handle: BranchHandle): string | null {
  if (handle === "true") return node.trueNext ?? null;
  if (handle === "false") return node.falseNext ?? null;
  return node.next ?? null;
}

function setChild(node: AutomationNode, handle: BranchHandle, id: string | null) {
  if (handle === "true") node.trueNext = id;
  else if (handle === "false") node.falseNext = id;
  else node.next = id;
}

/** Insert a new node of `type` under parent[handle], keeping the old subtree. */
export function insertNode(
  flow: AutomationFlow,
  parentId: string,
  handle: BranchHandle,
  type: Exclude<AutomationNodeType, "trigger">,
): { flow: AutomationFlow; newNodeId: string } {
  const next = cloneFlow(flow);
  const parent = next.nodes[parentId];
  if (!parent) return { flow, newNodeId: "" };

  const id = newNodeId();
  const displaced = childOf(parent, handle);
  const node: AutomationNode = {
    id,
    type,
    config: defaultConfigFor(type),
  };
  // The old subtree continues after the new node. A new condition keeps it on
  // the True branch so nothing the user built disappears.
  if (type === "condition") {
    node.trueNext = displaced;
    node.falseNext = null;
  } else {
    node.next = displaced;
  }

  next.nodes[id] = node;
  setChild(parent, handle, id);
  return { flow: next, newNodeId: id };
}

/**
 * Remove a node. Its linear successor (True branch for conditions) is
 * reattached to the parent; a removed condition's False branch is orphaned
 * and cleaned up.
 */
export function removeNode(flow: AutomationFlow, nodeId: string): AutomationFlow {
  if (nodeId === flow.rootId) return flow;
  const next = cloneFlow(flow);
  const node = next.nodes[nodeId];
  if (!node) return flow;

  const survivor =
    node.type === "condition" ? node.trueNext ?? null : node.next ?? null;

  for (const candidate of Object.values(next.nodes)) {
    for (const handle of ["next", "true", "false"] as const) {
      if (childOf(candidate, handle) === nodeId) {
        setChild(candidate, handle, survivor);
      }
    }
  }

  if (node.type === "condition" && node.falseNext) {
    deleteSubtree(next, node.falseNext);
  }
  delete next.nodes[nodeId];
  return next;
}

function deleteSubtree(flow: AutomationFlow, nodeId: string) {
  const node = flow.nodes[nodeId];
  if (!node) return;
  if (node.next) deleteSubtree(flow, node.next);
  if (node.trueNext) deleteSubtree(flow, node.trueNext);
  if (node.falseNext) deleteSubtree(flow, node.falseNext);
  delete flow.nodes[nodeId];
}

/** Replace one node's config. */
export function updateNodeConfig(
  flow: AutomationFlow,
  nodeId: string,
  config: AutomationNodeConfig,
): AutomationFlow {
  const next = cloneFlow(flow);
  const node = next.nodes[nodeId];
  if (!node) return flow;
  node.config = config;
  return next;
}
