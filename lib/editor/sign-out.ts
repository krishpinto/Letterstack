"use client";

import { signOut } from "next-auth/react";
import { clearEditorDraftsOnThisDevice } from "./local-draft";

/**
 * next-auth's signOut, after removing the editor's drafts from this browser.
 * A draft is scoped to its user, but on a shared computer it should not
 * outlive the session that wrote it. Use this wherever the app signs out.
 */
export function signOutAndClearDrafts(options?: Parameters<typeof signOut>[0]) {
  clearEditorDraftsOnThisDevice();
  return signOut(options);
}
