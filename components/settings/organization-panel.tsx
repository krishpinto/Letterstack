"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { UserPlusIcon } from "lucide-react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { DeleteConfirmDialog } from "@/components/settings/delete-confirm-dialog";
import { SaveBar } from "@/components/settings/save-bar";
import { InviteMembersDialog } from "@/components/protected-shell/invite-members-dialog";
import { dispatchOrganizationChanged } from "@/lib/dashboard-events";

type OrgType = "personal" | "business";

type Organization = {
  id: string;
  name: string;
  type: string;
  role?: string;
  memberCount?: number;
};

type Member = {
  id: string;
  userId: string;
  role: string;
  joinedAt: string;
  name: string | null;
  email: string;
};

type PendingInvite = {
  id: string;
  email: string;
  role: string;
  createdAt: string;
  expiresAt: string;
};

function initialOf(value: string) {
  return value.trim().slice(0, 1).toUpperCase() || "?";
}

export function OrganizationPanel({
  initialOrganization,
  initialMembers,
  initialPendingInvites,
  currentUserId,
  otherWorkspaceCount,
}: {
  initialOrganization: Organization;
  initialMembers: Member[];
  initialPendingInvites: PendingInvite[];
  currentUserId: string;
  otherWorkspaceCount: number;
}) {
  const router = useRouter();
  const isOwner = initialOrganization.role === "owner";

  const [saved, setSaved] = useState(initialOrganization);
  const [name, setName] = useState(initialOrganization.name);
  const [type, setType] = useState<OrgType>(
    initialOrganization.type === "personal" ? "personal" : "business",
  );
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const [members, setMembers] = useState(initialMembers);
  const [pendingInvites, setPendingInvites] = useState(initialPendingInvites);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [memberError, setMemberError] = useState<string | null>(null);
  const [deleteOrgError, setDeleteOrgError] = useState<string | null>(null);
  const [deletingOrg, setDeletingOrg] = useState(false);

  const dirty = useMemo(
    () => name.trim() !== saved.name || type !== (saved.type === "personal" ? "personal" : "business"),
    [name, type, saved],
  );

  async function handleSave() {
    const trimmed = name.trim();
    if (trimmed.length < 2) {
      setSaveError("Workspace name must be at least 2 characters");
      return;
    }
    setSaving(true);
    setSaveError(null);
    try {
      const response = await fetch(`/api/organizations/${initialOrganization.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: trimmed, type }),
      });
      const data = await response.json().catch(() => null);
      if (!data?.ok) throw new Error(data?.error || "Could not save changes");
      setSaved((current) => ({ ...current, name: data.organization.name, type: data.organization.type }));
      dispatchOrganizationChanged(initialOrganization.id);
      router.refresh();
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : "Could not save changes");
    } finally {
      setSaving(false);
    }
  }

  function handleDiscard() {
    setName(saved.name);
    setType(saved.type === "personal" ? "personal" : "business");
    setSaveError(null);
  }

  async function refreshInvites() {
    try {
      const response = await fetch("/api/organizations/invite");
      const data = await response.json().catch(() => null);
      if (data?.ok) setPendingInvites(data.invites);
    } catch {
      // Non-critical — the list just stays as it was.
    }
  }

  async function handleRemoveMember(memberId: string) {
    setMemberError(null);
    try {
      const response = await fetch(
        `/api/organizations/${initialOrganization.id}/members/${memberId}`,
        { method: "DELETE" },
      );
      const data = await response.json().catch(() => null);
      if (!data?.ok) throw new Error(data?.error || "Could not remove member");
      const removingSelf = members.find((m) => m.id === memberId)?.userId === currentUserId;
      if (removingSelf) {
        router.push("/dashboard");
        router.refresh();
        return;
      }
      setMembers((current) => current.filter((m) => m.id !== memberId));
      router.refresh();
    } catch (error) {
      setMemberError(error instanceof Error ? error.message : "Could not remove member");
    }
  }

  async function handleDeleteOrganization() {
    setDeletingOrg(true);
    setDeleteOrgError(null);
    try {
      const response = await fetch(`/api/organizations/${initialOrganization.id}`, {
        method: "DELETE",
      });
      const data = await response.json().catch(() => null);
      if (!data?.ok) throw new Error(data?.error || "Could not delete workspace");
      router.push("/dashboard");
      router.refresh();
    } catch (error) {
      setDeleteOrgError(error instanceof Error ? error.message : "Could not delete workspace");
      setDeletingOrg(false);
    }
  }

  return (
    <>
      <div className="flex max-w-2xl flex-col gap-8">
        <div className="flex max-w-lg flex-col gap-4">
          <div>
            <h3 className="text-sm font-semibold">Workspace</h3>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {isOwner
                ? "Manage your organization details."
                : "Only the workspace owner can change these."}
            </p>
          </div>
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <Label className="text-sm font-medium">Organization name</Label>
              <Input
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="Acme Inc."
                className="h-8 text-sm"
                disabled={!isOwner}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label className="text-sm font-medium">Type</Label>
              <Select
                value={type}
                onValueChange={(value) => setType(value as OrgType)}
                disabled={!isOwner}
              >
                <SelectTrigger className="h-8 w-full text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="business">Business</SelectItem>
                  <SelectItem value="personal">Personal</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        <Separator />

        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-semibold">Members</h3>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {members.length} {members.length === 1 ? "member" : "members"} in this workspace.
              </p>
            </div>
            <Button size="sm" className="h-8 gap-1.5 text-xs" onClick={() => setInviteOpen(true)}>
              <UserPlusIcon className="size-3.5" />
              Invite members
            </Button>
          </div>

          {memberError && (
            <Alert variant="destructive">
              <AlertDescription>{memberError}</AlertDescription>
            </Alert>
          )}

          <div className="flex flex-col gap-1.5">
            {members.map((member) => {
              const isSelf = member.userId === currentUserId;
              const canRemove = isOwner ? member.role !== "owner" : isSelf && member.role !== "owner";
              return (
                <div
                  key={member.id}
                  className="flex items-center justify-between rounded-lg border border-border/60 bg-muted/20 px-3 py-2"
                >
                  <div className="flex min-w-0 items-center gap-2.5">
                    <Avatar className="size-8 rounded-lg">
                      <AvatarFallback className="rounded-lg bg-muted text-xs font-semibold">
                        {initialOf(member.name || member.email)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">
                        {member.name || member.email}
                        {isSelf && <span className="text-muted-foreground"> (you)</span>}
                      </p>
                      <p className="truncate text-xs text-muted-foreground">{member.email}</p>
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <Badge variant="outline" className="h-5 px-1.5 text-[10px] capitalize">
                      {member.role}
                    </Badge>
                    {canRemove && (
                      <DeleteConfirmDialog
                        trigger={
                          <Button variant="ghost" size="xs" className="text-muted-foreground hover:text-destructive">
                            {isSelf ? "Leave" : "Remove"}
                          </Button>
                        }
                        title={isSelf ? "Leave this workspace?" : `Remove ${member.name || member.email}?`}
                        description={
                          isSelf
                            ? "You'll lose access to this workspace's campaigns, templates, and recipients."
                            : `${member.name || member.email} will lose access to this workspace immediately.`
                        }
                        confirmLabel={isSelf ? "Leave" : "Remove"}
                        onConfirm={() => handleRemoveMember(member.id)}
                      />
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {pendingInvites.length > 0 && (
            <div className="flex flex-col gap-1.5">
              <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Pending invites
              </p>
              {pendingInvites.map((invite) => (
                <div
                  key={invite.id}
                  className="flex items-center justify-between rounded-lg border border-dashed border-border/60 px-3 py-2"
                >
                  <span className="truncate text-sm text-muted-foreground">{invite.email}</span>
                  <Badge variant="outline" className="h-5 px-1.5 text-[10px] capitalize">
                    {invite.role} · pending
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </div>

        {isOwner && (
          <>
            <Separator />
            <div className="flex flex-col gap-4">
              <div>
                <h3 className="text-sm font-semibold">Danger zone</h3>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  Irreversible actions for this workspace.
                </p>
              </div>
              {deleteOrgError && (
                <Alert variant="destructive">
                  <AlertDescription>{deleteOrgError}</AlertDescription>
                </Alert>
              )}
              <div className="flex items-center justify-between rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3">
                <div>
                  <p className="text-sm font-medium">Delete workspace</p>
                  <p className="text-xs text-muted-foreground">
                    Permanently delete this workspace and everything in it — campaigns, templates,
                    recipients, domains.
                  </p>
                </div>
                <DeleteConfirmDialog
                  trigger={
                    <Button
                      variant="destructive"
                      size="xs"
                      disabled={deletingOrg || otherWorkspaceCount === 0}
                    >
                      Delete
                    </Button>
                  }
                  title={`Delete ${saved.name}?`}
                  description="This permanently deletes the workspace and everything in it. This can't be undone."
                  confirmLabel={deletingOrg ? "Deleting…" : "Delete workspace"}
                  onConfirm={handleDeleteOrganization}
                />
              </div>
              {otherWorkspaceCount === 0 && (
                <p className="text-xs text-muted-foreground">
                  This is your only workspace — create another one before deleting this one.
                </p>
              )}
            </div>
          </>
        )}
      </div>

      <InviteMembersDialog
        open={inviteOpen}
        onOpenChange={(next) => {
          setInviteOpen(next);
          if (!next) void refreshInvites();
        }}
        organizationName={saved.name}
      />

      <SaveBar
        dirty={dirty}
        saving={saving}
        error={saveError}
        onSave={handleSave}
        onDiscard={handleDiscard}
      />
    </>
  );
}
