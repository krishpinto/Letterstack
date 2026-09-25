/**
 * What notification emails exist, and what someone gets if they have never
 * touched the settings.
 *
 * Deliberately free of any database import so the settings panel and the send
 * path can share it. The defaults live here rather than only in the column
 * DEFAULTs because a missing notification_preferences row means "the
 * defaults", not "everything off" — see db/notification-preferences.ts.
 *
 * Every kind in this list is wired to something that actually sends. Adding a
 * toggle here for a notification nothing emits is worse than having no
 * toggle: it reads as a promise that mail is being suppressed when in fact
 * none was ever going to arrive.
 */

export const NOTIFICATION_KINDS = ["campaignFinished", "deliverabilityAlerts"] as const;

export type NotificationKind = (typeof NOTIFICATION_KINDS)[number];

export type NotificationPreferences = Record<NotificationKind, boolean>;

export const NOTIFICATION_DEFAULTS: NotificationPreferences = {
  campaignFinished: true,
  // On by default, and the panel says plainly why turning it off is a bad
  // idea: SES suspends sending above 10% bounces or 0.5% complaints, and the
  // suspension is account-wide. Someone silencing this is not only risking
  // their own sending.
  deliverabilityAlerts: true,
};

export const NOTIFICATION_INFO: Record<
  NotificationKind,
  { label: string; description: string; important?: boolean }
> = {
  campaignFinished: {
    label: "Campaign finished sending",
    description:
      "One email when a campaign has gone out, with how many were delivered and how many failed.",
  },
  deliverabilityAlerts: {
    label: "Deliverability warnings",
    description:
      "When a campaign's bounce or complaint rate crosses the level that puts sending at risk. Amazon suspends senders above 10% bounces or 0.5% complaints.",
    important: true,
  },
};

/** Narrows an unknown string to a kind, for request bodies. */
export function isNotificationKind(value: unknown): value is NotificationKind {
  return (
    typeof value === "string" &&
    (NOTIFICATION_KINDS as readonly string[]).includes(value)
  );
}

/**
 * A full preference set from a partial request body. Unknown keys are ignored
 * and missing ones fall back to what is already stored, so a client that only
 * knows about one toggle cannot silently reset another.
 */
export function mergePreferences(
  current: NotificationPreferences,
  patch: unknown,
): NotificationPreferences {
  if (!patch || typeof patch !== "object") return current;
  const next = { ...current };
  for (const [key, value] of Object.entries(patch)) {
    if (isNotificationKind(key) && typeof value === "boolean") {
      next[key] = value;
    }
  }
  return next;
}
