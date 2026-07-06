"use client";

// Read-only-layout React Flow canvas for an AutomationFlow tree. Node
// positions are derived from the tree every render (no dragging) — the
// interesting interactions are the + buttons (insert via palette) and
// clicking a node (opens the config sheet).

import { useMemo } from "react";
import {
  Background,
  BackgroundVariant,
  BaseEdge,
  Controls,
  EdgeLabelRenderer,
  Handle,
  Position,
  ReactFlow,
  getSmoothStepPath,
  type Edge,
  type EdgeProps,
  type Node,
  type NodeProps,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import {
  ClockIcon,
  MailIcon,
  PlusIcon,
  SplitIcon,
  TagIcon,
  UserCogIcon,
  UserXIcon,
  ZapIcon,
} from "lucide-react";

import { cn } from "@/lib/utils";
import {
  TRIGGER_EVENTS,
  type AutomationFlow,
  type AutomationNode,
  type AutomationNodeType,
  type ConditionConfig,
  type DelayConfig,
  type SendEmailConfig,
  type TriggerConfig,
  type UpdateContactConfig,
  type AddCategoryConfig,
} from "@/lib/automations/flow";
import type { BranchHandle } from "@/lib/automations/flow-edit";

// ─── Public props ─────────────────────────────────────────────────────────────

export type FlowCanvasProps = {
  flow: AutomationFlow;
  selectedNodeId: string | null;
  templateNames: Record<string, string>;
  categoryNames: Record<string, string>;
  onSelectNode: (nodeId: string) => void;
  /**
   * Called when a + button is clicked. The palette itself is a normal dialog
   * owned by the builder — Radix triggers anchored inside the React Flow
   * canvas fight its pointer handling and silently fail to open.
   */
  onRequestInsert: (parentId: string, handle: BranchHandle) => void;
};

// ─── Layout ──────────────────────────────────────────────────────────────────

const NODE_W = 280;
const ADD_SIZE = 36;
const ROW_H = 168;
const H_GAP = 100;

type Ctx = {
  flow: AutomationFlow;
  props: FlowCanvasProps;
  nodes: Node[];
  edges: Edge[];
};

function subtreeWidth(flow: AutomationFlow, nodeId: string | null | undefined): number {
  if (!nodeId || !flow.nodes[nodeId]) return NODE_W;
  const node = flow.nodes[nodeId];
  if (node.type === "condition") {
    return (
      subtreeWidth(flow, node.trueNext) + H_GAP + subtreeWidth(flow, node.falseNext)
    );
  }
  return Math.max(NODE_W, subtreeWidth(flow, node.next));
}

function place(
  ctx: Ctx,
  nodeId: string | null | undefined,
  parent: { id: string; handle: BranchHandle } | null,
  centerX: number,
  y: number,
) {
  const { flow, props } = ctx;

  if (!nodeId || !flow.nodes[nodeId]) {
    if (!parent) return;
    const addId = `add:${parent.id}:${parent.handle}`;
    ctx.nodes.push({
      id: addId,
      type: "add",
      position: { x: centerX - ADD_SIZE / 2, y },
      data: { parentId: parent.id, handle: parent.handle, props },
      draggable: false,
    });
    ctx.edges.push(edgeFor(parent, addId, props, true));
    return;
  }

  const node = flow.nodes[nodeId];
  ctx.nodes.push({
    id: node.id,
    type: "step",
    position: { x: centerX - NODE_W / 2, y },
    data: { flowNode: node, props },
    draggable: false,
  });
  if (parent) ctx.edges.push(edgeFor(parent, node.id, props, false));

  if (node.type === "condition") {
    const leftW = subtreeWidth(flow, node.trueNext);
    const rightW = subtreeWidth(flow, node.falseNext);
    const total = leftW + H_GAP + rightW;
    place(
      ctx,
      node.trueNext,
      { id: node.id, handle: "true" },
      centerX - total / 2 + leftW / 2,
      y + ROW_H,
    );
    place(
      ctx,
      node.falseNext,
      { id: node.id, handle: "false" },
      centerX + total / 2 - rightW / 2,
      y + ROW_H,
    );
  } else {
    place(ctx, node.next, { id: node.id, handle: "next" }, centerX, y + ROW_H);
  }
}

function edgeFor(
  parent: { id: string; handle: BranchHandle },
  targetId: string,
  props: FlowCanvasProps,
  targetIsAdd: boolean,
): Edge {
  return {
    id: `e:${parent.id}:${parent.handle}:${targetId}`,
    source: parent.id,
    sourceHandle: parent.handle,
    target: targetId,
    type: "insert",
    data: {
      parentId: parent.id,
      handle: parent.handle,
      props,
      // No mid-edge + button when the edge already ends in an add button.
      showInsert: !targetIsAdd,
    },
  };
}

// ─── Node visuals ────────────────────────────────────────────────────────────

export const NODE_ICONS: Record<AutomationNodeType, typeof MailIcon> = {
  trigger: ZapIcon,
  send_email: MailIcon,
  condition: SplitIcon,
  delay: ClockIcon,
  update_contact: UserCogIcon,
  add_category: TagIcon,
  delete_contact: UserXIcon,
};

export const NODE_LABELS: Record<AutomationNodeType, string> = {
  trigger: "Trigger",
  send_email: "Send email",
  condition: "Condition",
  delay: "Delay",
  update_contact: "Update contact",
  add_category: "Add to category",
  delete_contact: "Delete contact",
};

function nodeSummary(node: AutomationNode, props: FlowCanvasProps): string {
  switch (node.type) {
    case "trigger": {
      const config = node.config as TriggerConfig;
      return (
        TRIGGER_EVENTS.find((t) => t.event === config.event)?.label ??
        "Pick an event"
      );
    }
    case "send_email": {
      const config = node.config as SendEmailConfig;
      if (!config.templateId) return "Pick a template";
      const name = props.templateNames[config.templateId] ?? "Saved template";
      return config.fromEmail ? `${name} · ${config.fromEmail}` : name;
    }
    case "condition": {
      const config = node.config as ConditionConfig;
      const field = config.field === "email" ? "Email" : "Name";
      if (config.operator === "exists") return `${field} is set`;
      if (!config.value) return "Add a condition";
      const op = {
        contains: "contains",
        not_contains: "doesn't contain",
        equals: "equals",
        ends_with: "ends with",
      }[config.operator];
      return `${field} ${op} “${config.value}”`;
    }
    case "delay": {
      const config = node.config as DelayConfig;
      const amount = Math.max(1, Math.floor(config.amount || 1));
      const unit = amount === 1 ? config.unit.slice(0, -1) : config.unit;
      return `Wait ${amount} ${unit}`;
    }
    case "update_contact": {
      const config = node.config as UpdateContactConfig;
      return config.name ? `Set name to “${config.name}”` : "Choose what to update";
    }
    case "add_category": {
      const config = node.config as AddCategoryConfig;
      return config.categoryId
        ? props.categoryNames[config.categoryId] ?? "Category"
        : "Pick a category";
    }
    case "delete_contact":
      return "Remove from the audience";
  }
}

function nodeNeedsSetup(node: AutomationNode): boolean {
  switch (node.type) {
    case "send_email":
      return !(node.config as SendEmailConfig).templateId ||
        !(node.config as SendEmailConfig).fromEmail;
    case "condition": {
      const config = node.config as ConditionConfig;
      return config.operator !== "exists" && !config.value;
    }
    case "add_category":
      return !(node.config as AddCategoryConfig).categoryId;
    default:
      return false;
  }
}

function StepNode({ data }: NodeProps) {
  const { flowNode, props } = data as { flowNode: AutomationNode; props: FlowCanvasProps };
  const Icon = NODE_ICONS[flowNode.type];
  const selected = props.selectedNodeId === flowNode.id;
  const needsSetup = nodeNeedsSetup(flowNode);
  const isCondition = flowNode.type === "condition";

  return (
    <div
      className={cn(
        "w-[280px] cursor-pointer rounded-xl border bg-card px-4 py-3 shadow-sm transition-colors",
        selected
          ? "border-primary ring-2 ring-primary/30"
          : "border-border hover:border-muted-foreground/40",
      )}
      onClick={() => props.onSelectNode(flowNode.id)}
    >
      <Handle type="target" position={Position.Top} className="!opacity-0" />
      <div className="flex items-center gap-3">
        <span
          className={cn(
            "flex size-8 shrink-0 items-center justify-center rounded-lg",
            flowNode.type === "trigger"
              ? "bg-primary/15 text-primary"
              : "bg-muted text-muted-foreground",
          )}
        >
          <Icon className="size-4" />
        </span>
        <div className="min-w-0">
          <p className="text-sm font-semibold">{NODE_LABELS[flowNode.type]}</p>
          <p
            className={cn(
              "truncate text-xs",
              needsSetup ? "text-amber-500" : "text-muted-foreground",
            )}
          >
            {nodeSummary(flowNode, props)}
            {needsSetup ? " — needs setup" : ""}
          </p>
        </div>
      </div>
      {isCondition ? (
        <>
          <Handle
            type="source"
            id="true"
            position={Position.Bottom}
            style={{ left: "25%" }}
            className="!opacity-0"
          />
          <Handle
            type="source"
            id="false"
            position={Position.Bottom}
            style={{ left: "75%" }}
            className="!opacity-0"
          />
        </>
      ) : (
        <Handle
          type="source"
          id="next"
          position={Position.Bottom}
          className="!opacity-0"
        />
      )}
    </div>
  );
}

function AddNode({ data }: NodeProps) {
  const { parentId, handle, props } = data as {
    parentId: string;
    handle: BranchHandle;
    props: FlowCanvasProps;
  };

  return (
    <div>
      <Handle type="target" position={Position.Top} className="!opacity-0" />
      <button
        type="button"
        aria-label="Add step"
        className="nodrag nopan flex size-9 items-center justify-center rounded-full border border-border bg-muted text-muted-foreground transition-colors hover:border-primary hover:text-primary"
        onClick={(event) => {
          event.stopPropagation();
          props.onRequestInsert(parentId, handle);
        }}
      >
        <PlusIcon className="size-4" />
      </button>
    </div>
  );
}

// ─── Edge with insert button ─────────────────────────────────────────────────

function InsertEdge(props: EdgeProps) {
  const {
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
    data,
    id,
  } = props;
  const [path, labelX, labelY] = getSmoothStepPath({
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
    borderRadius: 16,
  });
  const { parentId, handle, showInsert, props: canvasProps } = (data ?? {}) as {
    parentId: string;
    handle: BranchHandle;
    showInsert?: boolean;
    props: FlowCanvasProps;
  };
  const branchLabel =
    handle === "true" ? "True" : handle === "false" ? "False" : null;

  return (
    <>
      <BaseEdge id={id} path={path} className="!stroke-border" />
      <EdgeLabelRenderer>
        {branchLabel && (
          <span
            className="absolute rounded-full border border-border bg-background px-2 py-0.5 text-[10px] font-medium text-muted-foreground"
            style={{
              transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY - (showInsert ? 16 : 0)}px)`,
            }}
          >
            {branchLabel}
          </span>
        )}
        {showInsert && canvasProps && (
          <div
            className="absolute"
            style={{
              transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY + (branchLabel ? 14 : 0)}px)`,
              pointerEvents: "all",
            }}
          >
            <button
              type="button"
              aria-label="Insert step"
              className="nodrag nopan flex size-6 items-center justify-center rounded-full border border-border bg-background text-muted-foreground transition-colors hover:border-primary hover:text-primary"
              onClick={(event) => {
                event.stopPropagation();
                canvasProps.onRequestInsert(parentId, handle);
              }}
            >
              <PlusIcon className="size-3" />
            </button>
          </div>
        )}
      </EdgeLabelRenderer>
    </>
  );
}

// ─── Canvas ──────────────────────────────────────────────────────────────────

const nodeTypes = { step: StepNode, add: AddNode };
const edgeTypes = { insert: InsertEdge };

export function FlowCanvas(props: FlowCanvasProps) {
  const { nodes, edges } = useMemo(() => {
    const ctx: Ctx = { flow: props.flow, props, nodes: [], edges: [] };
    place(ctx, props.flow.rootId, null, 0, 0);
    return { nodes: ctx.nodes, edges: ctx.edges };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.flow, props.selectedNodeId, props.templateNames, props.categoryNames]);

  return (
    <ReactFlow
      nodes={nodes}
      edges={edges}
      nodeTypes={nodeTypes}
      edgeTypes={edgeTypes}
      colorMode="dark"
      fitView
      fitViewOptions={{ padding: 0.35, maxZoom: 1 }}
      minZoom={0.3}
      maxZoom={1.5}
      nodesDraggable={false}
      nodesConnectable={false}
      elementsSelectable={false}
      proOptions={{ hideAttribution: true }}
      className="bg-background"
    >
      <Background variant={BackgroundVariant.Dots} gap={22} size={1.5} />
      <Controls showInteractive={false} />
    </ReactFlow>
  );
}
