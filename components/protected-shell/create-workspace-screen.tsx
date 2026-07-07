"use client";

import { useEffect, useState } from "react";
import {
  BriefcaseBusinessIcon,
  Layers2Icon,
  UserRoundIcon,
  XIcon,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  ExpandableScreen,
  ExpandableScreenContent,
  ExpandableScreenTrigger,
  useExpandableScreen,
} from "@/components/ui/expandable-screen";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { cn } from "@/lib/utils";
import type { NavbarOrganization } from "./top-navbar";

type WorkspaceType = "business" | "personal";

const TYPE_OPTIONS: {
  value: WorkspaceType;
  label: string;
  description: string;
  icon: typeof UserRoundIcon;
}[] = [
  {
    value: "business",
    label: "Business",
    description: "Teams, companies, client campaigns.",
    icon: BriefcaseBusinessIcon,
  },
  {
    value: "personal",
    label: "Personal",
    description: "Solo newsletters and experiments.",
    icon: UserRoundIcon,
  },
];

/** Drives the expandable screen from the parent's `open` state. */
function ScreenSync({ open }: { open: boolean }) {
  const { isExpanded, expand, collapse } = useExpandableScreen();

  useEffect(() => {
    if (open && !isExpanded) expand();
    else if (!open && isExpanded) collapse();
    // expand/collapse are stable enough; syncing on state only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, isExpanded]);

  return null;
}

type CreateWorkspaceScreenProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userEmail: string;
  onCreated: (
    organization: NavbarOrganization,
    organizations?: NavbarOrganization[],
  ) => void;
};

/**
 * Plane-style full-screen workspace creation. The expandable screen morphs
 * out of the navbar (an invisible trigger marks the origin) into a takeover
 * with the form on the left column.
 */
export function CreateWorkspaceScreen({
  open,
  onOpenChange,
  userEmail,
  onCreated,
}: CreateWorkspaceScreenProps) {
  const [name, setName] = useState("");
  const [type, setType] = useState<WorkspaceType>("business");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function close() {
    onOpenChange(false);
    setName("");
    setType("business");
    setError(null);
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmed = name.trim();
    if (trimmed.length < 2) {
      setError("Workspace name must be at least 2 characters.");
      return;
    }
    setCreating(true);
    setError(null);
    try {
      const r = await fetch("/api/organizations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: trimmed, type }),
      });
      const data = await r.json().catch(() => null);
      if (!r.ok || !data?.ok) {
        throw new Error(data?.error ?? "Could not create workspace.");
      }
      onCreated(
        data.organization as NavbarOrganization,
        Array.isArray(data.organizations) ? data.organizations : undefined,
      );
      close();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Could not create workspace.",
      );
    } finally {
      setCreating(false);
    }
  }

  return (
    <ExpandableScreen
      layoutId="create-workspace-screen"
      animationDuration={0.35}
      contentRadius="14px"
    >
      <ScreenSync open={open} />

      {/* Invisible morph origin sitting in the navbar near the switcher. */}
      <ExpandableScreenTrigger className="pointer-events-none size-px opacity-0">
        <span aria-hidden />
      </ExpandableScreenTrigger>

      <ExpandableScreenContent
        showCloseButton={false}
        className="border border-border bg-background"
      >
        <div className="flex min-h-full flex-col px-6 py-6 sm:px-10">
          {/* ── Top row: brand + account ── */}
          <div className="flex shrink-0 items-center justify-between">
            <span className="flex items-center gap-2">
              <span className="flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                <Layers2Icon className="size-4" />
              </span>
              <span className="text-sm font-semibold">LetterStack</span>
            </span>
            <span className="flex items-center gap-3">
              <span className="hidden text-sm text-muted-foreground sm:inline">
                {userEmail}
              </span>
              <Button
                variant="ghost"
                size="icon"
                className="size-8 rounded-full text-muted-foreground hover:text-foreground"
                onClick={close}
                aria-label="Close"
              >
                <XIcon className="size-4" />
              </Button>
            </span>
          </div>

          {/* ── Form column ── */}
          <div className="mx-auto w-full max-w-md flex-1 pt-[14vh] pb-16 lg:mx-0 lg:ml-[20%]">
            <h1 className="text-2xl font-semibold tracking-normal">
              Create your workspace
            </h1>

            <form onSubmit={handleSubmit} className="mt-9 grid gap-7">
              <div className="grid gap-2">
                <label
                  htmlFor="workspace-name"
                  className="text-sm font-medium"
                >
                  Name your workspace
                  <span className="text-destructive"> *</span>
                </label>
                <Input
                  id="workspace-name"
                  autoFocus
                  value={name}
                  disabled={creating}
                  placeholder="Something familiar and recognizable is always best."
                  onChange={(event) => setName(event.target.value)}
                />
              </div>

              <div className="grid gap-2">
                <span className="text-sm font-medium">
                  What kind of workspace is this?
                  <span className="text-destructive"> *</span>
                </span>
                <ToggleGroup
                  type="single"
                  value={type}
                  onValueChange={(value) => {
                    if (value) setType(value as WorkspaceType);
                  }}
                  variant="outline"
                  className="grid w-full grid-cols-1 gap-3 sm:grid-cols-2"
                >
                  {TYPE_OPTIONS.map((option) => (
                    <ToggleGroupItem
                      key={option.value}
                      value={option.value}
                      disabled={creating}
                      className={cn(
                        "h-auto justify-start rounded-xl p-3.5 text-left",
                        "data-[state=on]:border-primary data-[state=on]:bg-primary/5",
                      )}
                    >
                      <span className="flex items-start gap-3">
                        <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-muted text-foreground">
                          <option.icon className="size-4" />
                        </span>
                        <span className="flex flex-col gap-0.5">
                          <span className="text-sm font-medium">
                            {option.label}
                          </span>
                          <span className="text-xs leading-5 text-muted-foreground">
                            {option.description}
                          </span>
                        </span>
                      </span>
                    </ToggleGroupItem>
                  ))}
                </ToggleGroup>
              </div>

              {error && <p className="text-sm text-destructive">{error}</p>}

              <div className="flex items-center gap-2 pt-1">
                <Button
                  type="submit"
                  disabled={creating || name.trim().length < 2}
                >
                  {creating && <Spinner data-icon="inline-start" />}
                  {creating ? "Creating..." : "Create workspace"}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={close}
                  disabled={creating}
                >
                  Go back
                </Button>
              </div>
            </form>
          </div>
        </div>
      </ExpandableScreenContent>
    </ExpandableScreen>
  );
}
