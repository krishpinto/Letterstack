"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  MoreHorizontalIcon,
  PlusIcon,
  Trash2Icon,
  WorkflowIcon,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Spinner } from "@/components/ui/spinner";
import { BarSpinner } from "@/components/bar-spinner";
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

  async function toggleStatus(automation: AutomationRow) {
    const next = automation.status === "enabled" ? "disabled" : "enabled";
    setList((current) =>
      current.map((item) =>
        item.id === automation.id ? { ...item, status: next } : item,
      ),
    );
    await fetch(`/api/automations/${automation.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: next }),
    }).catch(() => void load());
  }

  async function remove(id: string) {
    setList((current) => current.filter((item) => item.id !== id));
    await fetch(`/api/automations/${id}`, { method: "DELETE" }).catch(() =>
      void load(),
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <header className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-normal">Automations</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Flows that run on their own — welcome emails for new subscribers,
            cleanup when someone unsubscribes.
          </p>
        </div>
        <Button onClick={createAutomation} disabled={creating}>
          {creating ? (
            <Spinner data-icon="inline-start" />
          ) : (
            <PlusIcon data-icon="inline-start" />
          )}
          Create automation
        </Button>
      </header>

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
                  <div className="flex items-center justify-center gap-2 py-10 text-sm text-muted-foreground">
                    <BarSpinner size={18} />
                    Loading automations…
                  </div>
                </TableCell>
              </TableRow>
            )}

            {!loading && list.length === 0 && (
              <TableRow>
                <TableCell colSpan={5}>
                  <div className="flex flex-col items-center gap-3 py-14 text-center">
                    <span className="flex size-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
                      <WorkflowIcon className="size-5" />
                    </span>
                    <div>
                      <p className="text-sm font-medium">No automations yet</p>
                      <p className="mt-1 text-sm text-muted-foreground">
                        Start with a welcome email for every new subscriber.
                      </p>
                    </div>
                    <Button size="sm" onClick={createAutomation} disabled={creating}>
                      <PlusIcon data-icon="inline-start" />
                      Create automation
                    </Button>
                  </div>
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
                        <Button variant="ghost" size="icon-sm">
                          <MoreHorizontalIcon />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem
                          variant="destructive"
                          onClick={() => remove(automation.id)}
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
