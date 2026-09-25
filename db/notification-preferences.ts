import { and, eq, sql } from "drizzle-orm";

import { db } from "./client";
import { notificationPreferences, organizationMembers, users } from "./schema";
import {
  NOTIFICATION_DEFAULTS,
  type NotificationKind,
  type NotificationPreferences,
} from "@/lib/notifications/preferences";

/**
 * Notification preferences, read and written per (workspace, member).
 *
 * The central design choice: a missing row means NOTIFICATION_DEFAULTS, not
 * "everything off". That is what lets this table ship without a backfill —
 * every existing member and every future invite already behaves correctly
 * with no row at all, and a row appears the first time someone changes
 * something. The cost is that every read has to apply the defaults, which is
 * what the coalesce in recipientsFor and the ?? here are doing.
 */

/** This member's resolved settings for this workspace. */
export async function getNotificationPreferences(
  organizationId: string,
  userId: string,
): Promise<NotificationPreferences> {
  const [row] = await db
    .select({
      campaignFinished: notificationPreferences.campaignFinished,
      deliverabilityAlerts: notificationPreferences.deliverabilityAlerts,
    })
    .from(notificationPreferences)
    .where(
      and(
        eq(notificationPreferences.organizationId, organizationId),
        eq(notificationPreferences.userId, userId),
      ),
    )
    .limit(1);

  if (!row) return { ...NOTIFICATION_DEFAULTS };
  return {
    campaignFinished: row.campaignFinished,
    deliverabilityAlerts: row.deliverabilityAlerts,
  };
}

/**
 * Write the whole resolved set, not a patch. The caller merges against what
 * is stored (mergePreferences), so a client that only knows about one toggle
 * cannot reset another it has never heard of — and the upsert stays a single
 * statement rather than a read, a merge and a write that can interleave.
 */
export async function setNotificationPreferences(
  organizationId: string,
  userId: string,
  prefs: NotificationPreferences,
): Promise<NotificationPreferences> {
  const [row] = await db
    .insert(notificationPreferences)
    .values({
      organizationId,
      userId,
      campaignFinished: prefs.campaignFinished,
      deliverabilityAlerts: prefs.deliverabilityAlerts,
    })
    .onConflictDoUpdate({
      target: [notificationPreferences.organizationId, notificationPreferences.userId],
      set: {
        campaignFinished: prefs.campaignFinished,
        deliverabilityAlerts: prefs.deliverabilityAlerts,
        updatedAt: new Date(),
      },
    })
    .returning({
      campaignFinished: notificationPreferences.campaignFinished,
      deliverabilityAlerts: notificationPreferences.deliverabilityAlerts,
    });

  return row ?? { ...NOTIFICATION_DEFAULTS };
}

/** The column backing each kind, so recipientsFor can stay one query. */
const KIND_COLUMN = {
  campaignFinished: notificationPreferences.campaignFinished,
  deliverabilityAlerts: notificationPreferences.deliverabilityAlerts,
} as const satisfies Record<NotificationKind, unknown>;

export type NotificationRecipient = { email: string; name: string | null };

/**
 * Everyone in the workspace who wants this kind of notification.
 *
 * LEFT JOIN plus coalesce, not an inner join: a member with no preferences row
 * has to be included at their default, and an inner join would silently mean
 * "notifications only reach people who have visited the settings page once".
 *
 * The default is interpolated from NOTIFICATION_DEFAULTS rather than
 * hardcoded true, so flipping a default in one place changes both what the
 * panel shows and who actually gets mail.
 */
export async function recipientsFor(
  organizationId: string,
  kind: NotificationKind,
): Promise<NotificationRecipient[]> {
  const column = KIND_COLUMN[kind];
  const fallback = NOTIFICATION_DEFAULTS[kind];

  return db
    .select({ email: users.email, name: users.name })
    .from(organizationMembers)
    .innerJoin(users, eq(users.id, organizationMembers.userId))
    .leftJoin(
      notificationPreferences,
      and(
        eq(notificationPreferences.organizationId, organizationMembers.organizationId),
        eq(notificationPreferences.userId, organizationMembers.userId),
      ),
    )
    .where(
      and(
        eq(organizationMembers.organizationId, organizationId),
        sql`coalesce(${column}, ${fallback}) = true`,
      ),
    );
}
