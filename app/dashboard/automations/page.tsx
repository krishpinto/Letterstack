"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  MoreHorizontalIcon,
  PlusIcon,
  Trash2Icon,
  WorkflowIcon,
} from "lucide-react";

import { confirmDialog } from "@/components/app-dialogs";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { IconStack } from "@/components/reui/icon-stack";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Spinner } from "@/components/ui/spinner";
import { PageLoader } from "@/components/bar-spinner";
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { onOrganizationChanged } from "@/lib/dashboard-events";
import {
  TRIGGER_EVENTS,
  type AutomationFlow,
  type TriggerEvent,
} from "@/lib/automations/flow";

type AutomationRow = {
  id: string;
  name: string;
  status: string;
  flow: AutomationFlow;
  createdAt: string;
  updatedAt: string;
};

function triggerLabel(flow: AutomationFlow): string {
  const root = flow?.nodes?.[flow?.rootId];
  const event = (root?.config as { event?: TriggerEvent } | undefined)?.event;
  return (
    TRIGGER_EVENTS.find((t) => t.event === event)?.label ?? "No trigger"
  );
}

function stepCount(flow: AutomationFlow): number {
  return Math.max(0, Object.keys(flow?.nodes ?? {}).length - 1);
}

export default function AutomationsPage() {
  const router = useRouter();
  const [list, setList] = useState<AutomationRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch("/api/automations");
      const data = await r.json();
      setList(data.ok ? data.automations : []);
    } catch {
      setList([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    return onOrganizationChanged(() => void load());
  }, [load]);

  async function createAutomation() {
    setCreating(true);
    try {
      const r = await fetch("/api/automations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "Untitled automation" }),
      });
      const data = await r.json();
      if (data.ok) {
        router.push(`/dashboard/automations/${data.automation.id}`);
        return;
      }
    } catch {
      // fall through to reset
    }
    setCreating(false);
  }

  function setStatus(id: string, status: string) {
    setList((current) =>
      current.map((item) => (item.id === id ? { ...item, status } : item)),
    );
  }

  async function toggleStatus(automation: AutomationRow) {
    const previous = automation.status;
    const next = previous === "enabled" ? "disabled" : "enabled";
    setError(null);
    // Flip optimistically, but put it back if the server refuses: a switch
    // that stays "on" after a 400 tells the owner mail is going out when it
    // isn't.
    setStatus(automation.id, next);
    try {
      const r = await fetch(`/api/automations/${automation.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: next }),
      });
      const data = await r.json().catch(() => null);
      if (!r.ok || !data?.ok) {
        setStatus(automation.id, previous);
        setError(
          `Couldn't turn "${automation.name}" ${next === "enabled" ? "on" : "off"}: ${
            data?.error || "the server refused the change."
          }`,
        );
      }
    } catch {
      setStatus(automation.id, previous);
      setError("Could not reach the server.");
    }
  }

  async function remove(automation: AutomationRow) {
    const ok = await confirmDialog({
      title: `Delete ${automation.name || "this automation"}?`,
      description:
        automation.status === "enabled"
          ? "It is live: it stops immediately, including for contacts partway through it. This cannot be undone."
          : "This cannot be undone.",
      confirmLabel: "Delete",
      destructive: true,
    });
    if (!ok) return;

    setError(null);
    setList((current) => current.filter((item) => item.id !== automation.id));
    try {
      const r = await fetch(`/api/automations/${automation.id}`, { method: "DELETE" });
      const data = await r.json().catch(() => null);
      if (!r.ok || !data?.ok) {
        setError(data?.error || "Could not delete the automation.");
        void load();
      }
    } catch {
      setError("Could not reach the server.");
      void load();
    }
  }

  return (
    <div className="flex flex-col gap-6">
      {/* The module sidebar + breadcrumb already title this page. */}
      <header className="flex items-center justify-end gap-4">
        <Button onClick={createAutomation} disabled={creating}>
          {creating ? (
            <Spinner data-icon="inline-start" />
          ) : (
            <PlusIcon data-icon="inline-start" />
          )}
          Create automation
        </Button>
      </header>

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <div className="rounded-xl border border-border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Trigger</TableHead>
              <TableHead className="hidden lg:table-cell">Steps</TableHead>
              <TableHead>Active</TableHead>
              <TableHead className="w-12" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading && (
              <TableRow>
                <TableCell colSpan={5}>
                  <PageLoader className="min-h-0 py-10" label="Loading automations…" />
                </TableCell>
              </TableRow>
            )}

            {!loading && list.length === 0 && (
              <TableRow>
                <TableCell colSpan={5}>
                  <Empty className="border-0 py-14">
                    <EmptyHeader>
                      <EmptyMedia>
                        <IconStack aria-hidden="true" className="h-24 w-22">
                          <WorkflowIcon className="size-5" />
                        </IconStack>
                      </EmptyMedia>
                      <EmptyTitle>No automations yet</EmptyTitle>
                      <EmptyDescription>
                        Start with a welcome email for every new subscriber.
                      </EmptyDescription>
                    </EmptyHeader>
                    <EmptyContent>
                      <Button size="sm" onClick={createAutomation} disabled={creating}>
                        <PlusIcon data-icon="inline-start" />
                        Create automation
                      </Button>
                    </EmptyContent>
                  </Empty>
                </TableCell>
              </TableRow>
            )}

            {!loading &&
              list.map((automation) => (
                <TableRow
                  key={automation.id}
                  className="cursor-pointer"
                  onClick={() =>
                    router.push(`/dashboard/automations/${automation.id}`)
                  }
                >
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                        <WorkflowIcon className="size-4" />
                      </span>
                      <span className="font-medium">{automation.name}</span>
                    </div>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {triggerLabel(automation.flow)}
                  </TableCell>
                  <TableCell className="hidden tabular-nums text-muted-foreground lg:table-cell">
                    {stepCount(automation.flow)}
                  </TableCell>
                  <TableCell onClick={(event) => event.stopPropagation()}>
                    <div className="flex items-center gap-2">
                      <Switch
                        checked={automation.status === "enabled"}
                        onCheckedChange={() => toggleStatus(automation)}
                        aria-label="Toggle automation"
                      />
                      <Badge
                        variant={
                          automation.status === "enabled" ? "default" : "secondary"
                        }
                      >
                        {automation.status === "enabled" ? "Live" : "Off"}
                      </Badge>
                    </div>
                  </TableCell>
                  <TableCell onClick={(event) => event.stopPropagation()}>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          aria-label="Automation actions"
                        >
                          <MoreHorizontalIcon />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem
                          variant="destructive"
                          onClick={() => void remove(automation)}
                        >
                          <Trash2Icon />
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
