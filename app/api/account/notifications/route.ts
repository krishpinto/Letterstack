// This member's notification settings for the active workspace.
//
// GET — resolved settings (defaults applied where nothing is stored)
// PUT — merge a partial patch over what is stored
//
// Per-user, so there is no role check: everyone decides what lands in their
// own inbox, including a member who cannot change anything else about the
// workspace.

import { NextResponse } from "next/server";

import {
  getNotificationPreferences,
  setNotificationPreferences,
} from "@/db/notification-preferences";
import { currentOrganizationId, currentUserId } from "@/lib/auth-helpers";
import { mergePreferences } from "@/lib/notifications/preferences";

export const runtime = "nodejs";

async function requireScope() {
  const userId = await currentUserId();
  if (!userId) {
    return { error: NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 }) };
  }
  const organizationId = await currentOrganizationId();
  if (!organizationId) {
    return { error: NextResponse.json({ ok: false, error: "No workspace" }, { status: 400 }) };
  }
  return { userId, organizationId };
}

export async function GET() {
  const scope = await requireScope();
  if ("error" in scope) return scope.error;

  return NextResponse.json({
    ok: true,
    preferences: await getNotificationPreferences(scope.organizationId, scope.userId),
  });
}

export async function PUT(request: Request) {
  const scope = await requireScope();
  if ("error" in scope) return scope.error;

  const body = await request.json().catch(() => null);

  // Merged against what is stored rather than trusted wholesale, so a client
  // that only knows about some of the toggles cannot silently switch off one
  // it has never heard of.
  const current = await getNotificationPreferences(scope.organizationId, scope.userId);
  const next = mergePreferences(current, body?.preferences ?? body);

  const preferences = await setNotificationPreferences(
    scope.organizationId,
    scope.userId,
    next,
  );

  return NextResponse.json({ ok: true, preferences });
}
