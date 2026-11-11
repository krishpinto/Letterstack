"use client";

import { createContext, useContext } from "react";

/**
 * The signed-in user's role in the active workspace, provided by
 * ProtectedShell from the server layout, so client pages inside the shell
 * can hide actions the API would refuse.
 *
 * This is presentation only. The API routes enforce the same rule
 * (owners and admins manage domains and invites; members get a 403).
 */
const WorkspaceRoleContext = createContext<string | undefined>(undefined);

export const WorkspaceRoleProvider = WorkspaceRoleContext.Provider;

/** Owners and admins manage the workspace: domains, invites, sender defaults. */
export function canManageWorkspace(role: string | undefined) {
  return role === "owner" || role === "admin";
}

export function useCanManageWorkspace() {
  return canManageWorkspace(useContext(WorkspaceRoleContext));
}
