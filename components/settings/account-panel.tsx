"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { signOut } from "next-auth/react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { DeleteConfirmDialog } from "@/components/settings/delete-confirm-dialog";
import { SaveBar } from "@/components/settings/save-bar";

type Profile = {
  id: string;
  name: string | null;
  email: string;
  createdAt: string;
};

export function AccountPanel({ initialProfile }: { initialProfile: Profile }) {
  const router = useRouter();
  const [saved, setSaved] = useState(initialProfile);
  const [name, setName] = useState(initialProfile.name ?? "");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const dirty = useMemo(() => name.trim() !== (saved.name ?? ""), [name, saved.name]);

  async function handleSave() {
    const trimmed = name.trim();
    if (!trimmed) {
      setSaveError("Name can't be empty");
      return;
    }
    setSaving(true);
    setSaveError(null);
    try {
      const response = await fetch("/api/account/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: trimmed }),
      });
      const data = await response.json().catch(() => null);
      if (!data?.ok) throw new Error(data?.error || "Could not save changes");
      setSaved((current) => ({ ...current, name: data.profile.name }));
      router.refresh();
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : "Could not save changes");
    } finally {
      setSaving(false);
    }
  }

  function handleDiscard() {
    setName(saved.name ?? "");
    setSaveError(null);
  }

  async function handleDeleteAccount() {
    setDeleting(true);
    setDeleteError(null);
    try {
      const response = await fetch("/api/account/profile", { method: "DELETE" });
      const data = await response.json().catch(() => null);
      if (!data?.ok) throw new Error(data?.error || "Could not delete account");
      await signOut({ callbackUrl: "/login" });
    } catch (error) {
      setDeleteError(error instanceof Error ? error.message : "Could not delete account");
      setDeleting(false);
    }
  }

  return (
    <>
      <div className="flex max-w-lg flex-col gap-8">
        <div className="flex flex-col gap-4">
          <div>
            <h3 className="text-sm font-semibold">Profile</h3>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Your display name, shown across LetterStack.
            </p>
          </div>
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <Label className="text-sm font-medium">Display name</Label>
              <Input
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="Your name"
                className="h-8 text-sm"
                maxLength={120}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label className="text-sm font-medium">Email address</Label>
              <Input value={saved.email} disabled className="h-8 text-sm" />
              <p className="text-xs text-muted-foreground">
                Email is your login identity and can't be changed here.
              </p>
            </div>
          </div>
        </div>

        <Separator />

        <div className="flex flex-col gap-4">
          <div>
            <h3 className="text-sm font-semibold">Danger zone</h3>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Irreversible actions for your account.
            </p>
          </div>
          {deleteError && (
            <Alert variant="destructive">
              <AlertDescription>{deleteError}</AlertDescription>
            </Alert>
          )}
          <div className="flex items-center justify-between rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3">
            <div>
              <p className="text-sm font-medium">Delete account</p>
              <p className="text-xs text-muted-foreground">
                Permanently remove your account and all data you solely own.
              </p>
            </div>
            <DeleteConfirmDialog
              trigger={
                <Button variant="destructive" size="xs" disabled={deleting}>
                  Delete
                </Button>
              }
              title="Delete your account?"
              description="This permanently deletes your account. Workspaces only you belong to are deleted with everything in them — campaigns, templates, recipients, all of it. This can't be undone."
              confirmLabel={deleting ? "Deleting…" : "Delete account"}
              onConfirm={handleDeleteAccount}
            />
          </div>
        </div>
      </div>

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
