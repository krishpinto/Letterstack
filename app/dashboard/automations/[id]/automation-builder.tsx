"use client";

// Shell for the automation builder: header (name, live toggle, save), data
// fetching for the config sheet (templates, senders, categories), and the
// canvas + sheet wiring. Flow edits all go through lib/automations/flow-edit.

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeftIcon, PlayIcon, SquareIcon } from "lucide-react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import {
  NODE_CATALOG,
  type AutomationFlow,
  type AutomationNodeConfig,
  type AutomationNodeType,
} from "@/lib/automations/flow";
import {
  insertNode,
  removeNode,
  updateNodeConfig,
  type BranchHandle,
} from "@/lib/automations/flow-edit";
import { FlowCanvas, NODE_ICONS } from "./flow-canvas";
import { NodeConfigSheet, type SenderOption } from "./node-config-sheet";

export type AutomationData = {
  id: string;
  name: string;
  status: string;
  flow: AutomationFlow;
};

export function AutomationBuilder({ automation }: { automation: AutomationData }) {
  const [name, setName] = useState(automation.name);
  const [status, setStatus] = useState(automation.status);
  const [flow, setFlow] = useState<AutomationFlow>(automation.flow);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  // Where the next inserted step goes; set by the + buttons on the canvas,
  // consumed by the palette dialog.
  const [insertTarget, setInsertTarget] = useState<{
    parentId: string;
    handle: BranchHandle;
  } | null>(null);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [toggling, setToggling] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Reference data for the config sheet + node summaries
  const [templates, setTemplates] = useState<{ id: string; name: string }[]>([]);
  const [senders, setSenders] = useState<SenderOption[]>([]);
  const [categories, setCategories] = useState<{ id: string; name: string }[]>([]);

  useEffect(() => {
    fetch("/api/templates")
      .then((r) => r.json())
      .then((data) => {
        if (data.ok) {
          setTemplates(
            (data.templates ?? []).map((t: { id: string; name: string }) => ({
              id: t.id,
              name: t.name,
            })),
          );
        }
      })
      .catch(() => {});

    fetch("/api/domains")
      .then((r) => r.json())
      .then((data) => {
        if (!data?.ok && !data?.sharedFromEmail && !data?.domains) return;
        const options: SenderOption[] = [];
        if (data.sharedFromEmail) {
          options.push({
            label: `${data.sharedFromEmail} (LetterStack shared)`,
            email: data.sharedFromEmail,
          });
        }
        for (const domain of data.domains ?? []) {
          options.push({
            label: domain.readyToSend
              ? `hello@${domain.domain}`
              : `hello@${domain.domain} (pending verification)`,
            email: `hello@${domain.domain}`,
            disabled: !domain.readyToSend,
          });
        }
        setSenders(options);
      })
      .catch(() => {});

    fetch("/api/audience/categories")
      .then((r) => r.json())
      .then((data) => {
        if (data.ok) {
          setCategories(
            (data.categories ?? []).map((c: { id: string; name: string }) => ({
              id: c.id,
              name: c.name,
            })),
          );
        }
      })
      .catch(() => {});
  }, []);

  const templateNames = useMemo(
    () => Object.fromEntries(templates.map((t) => [t.id, t.name])),
    [templates],
  );
  const categoryNames = useMemo(
    () => Object.fromEntries(categories.map((c) => [c.id, c.name])),
    [categories],
  );

  const selectedNode = selectedNodeId ? flow.nodes[selectedNodeId] ?? null : null;

  function applyFlow(next: AutomationFlow) {
    setFlow(next);
    setDirty(true);
  }

  function handlePickStep(type: Exclude<AutomationNodeType, "trigger">) {
    if (!insertTarget) return;
    const result = insertNode(flow, insertTarget.parentId, insertTarget.handle, type);
    applyFlow(result.flow);
    setInsertTarget(null);
    if (result.newNodeId) setSelectedNodeId(result.newNodeId);
  }

  function handleConfigChange(nodeId: string, config: AutomationNodeConfig) {
    applyFlow(updateNodeConfig(flow, nodeId, config));
  }

  function handleRemove(nodeId: string) {
    applyFlow(removeNode(flow, nodeId));
    setSelectedNodeId(null);
  }

  async function save(extra?: { status?: "enabled" | "disabled" }) {
    setSaving(true);
    setError(null);
    try {
      const r = await fetch(`/api/automations/${automation.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim() || "Untitled automation",
          flow,
          ...(extra?.status ? { status: extra.status } : {}),
        }),
      });
      const data = await r.json();
      if (!data.ok) {
        setError(data.error || "Could not save");
        return false;
      }
      setDirty(false);
      if (extra?.status) setStatus(extra.status);
      return true;
    } catch {
      setError("Could not reach the server.");
      return false;
    } finally {
      setSaving(false);
    }
  }

  async function toggleLive() {
    setToggling(true);
    // Saving and toggling together — turning on a stale flow would run the
    // wrong steps.
    await save({ status: status === "enabled" ? "disabled" : "enabled" });
    setToggling(false);
  }

  const isLive = status === "enabled";

  return (
    <div className="flex h-[calc(100vh-4rem)] flex-col gap-4 p-4">
      <header className="flex items-center justify-between gap-4 rounded-lg border border-border p-3">
        <div className="flex min-w-0 flex-1 items-center gap-3">
          <Button variant="outline" size="icon-sm" asChild>
            <Link href="/dashboard/automations">
              <ArrowLeftIcon />
            </Link>
          </Button>
          <Input
            value={name}
            onChange={(event) => {
              setName(event.target.value);
              setDirty(true);
            }}
            className="h-8 max-w-72 border-transparent bg-transparent px-2 text-base font-semibold shadow-none focus-visible:border-input"
            aria-label="Automation name"
          />
          <Badge variant={isLive ? "default" : "secondary"}>
            {isLive ? "Live" : "Off"}
          </Badge>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={() => save()}
            disabled={saving || !dirty}
          >
            {saving && <Spinner data-icon="inline-start" />}
            {dirty ? "Save" : "Saved"}
          </Button>
          <Button onClick={toggleLive} disabled={toggling || saving}>
            {toggling ? (
              <Spinner data-icon="inline-start" />
            ) : isLive ? (
              <SquareIcon data-icon="inline-start" />
            ) : (
              <PlayIcon data-icon="inline-start" />
            )}
            {isLive ? "Turn off" : "Turn on"}
          </Button>
        </div>
      </header>

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <div className="min-h-0 flex-1 overflow-hidden rounded-xl border border-border">
        <FlowCanvas
          flow={flow}
          selectedNodeId={selectedNodeId}
          templateNames={templateNames}
          categoryNames={categoryNames}
          onSelectNode={setSelectedNodeId}
          onRequestInsert={(parentId, handle) =>
            setInsertTarget({ parentId, handle })
          }
        />
      </div>

      <Dialog
        open={Boolean(insertTarget)}
        onOpenChange={(open) => !open && setInsertTarget(null)}
      >
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Add a step</DialogTitle>
            <DialogDescription>
              What should happen next in this flow?
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-4">
            {(["Messages", "Flow control", "Audience"] as const).map((group) => (
              <div key={group} className="flex flex-col gap-1.5">
                <p className="text-xs font-medium text-muted-foreground">
                  {group}
                </p>
                {NODE_CATALOG.filter((item) => item.group === group).map(
                  (item) => {
                    const Icon = NODE_ICONS[item.type];
                    return (
                      <button
                        key={item.type}
                        type="button"
                        className="flex items-center gap-3 rounded-lg border border-transparent px-3 py-2 text-left text-sm font-medium transition-colors hover:border-border hover:bg-muted/40"
                        onClick={() => handlePickStep(item.type)}
                      >
                        <span className="flex size-8 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                          <Icon className="size-4" />
                        </span>
                        {item.label}
                      </button>
                    );
                  },
                )}
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      <NodeConfigSheet
        node={selectedNode}
        templates={templates}
        senders={senders}
        categories={categories}
        onClose={() => setSelectedNodeId(null)}
        onConfigChange={handleConfigChange}
        onRemove={handleRemove}
      />
    </div>
  );
}
