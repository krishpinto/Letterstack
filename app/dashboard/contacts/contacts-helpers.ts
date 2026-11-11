// Pure helpers for the contacts page: what a suppression reason means for
// the UI, how a bulk action's outcome is reported, and the CSV export.

export type ContactStatus = "subscribed" | "bounced" | "suppressed";

/**
 * suppressed_emails.reason values written today:
 *   "bounce" / "complaint" — the SES webhook (app/api/webhooks/ses)
 *   "unsubscribe"          — the unsubscribe link and the v1 API
 *   "manual"               — someone in the workspace pressed Suppress
 * Anything else is treated like a manual-but-locked suppression.
 */
export function statusForSuppression(reason: string | null | undefined): ContactStatus {
  if (!reason) return "subscribed";
  if (reason === "bounce" || reason === "complaint") return "bounced";
  return "suppressed";
}

/** Only a workspace's own manual suppression can be undone from the UI. */
export function canUnsuppress(reason: string | null | undefined): boolean {
  return reason === "manual";
}

/** Badge text: says why an address is suppressed, not just that it is. */
export function suppressionLabel(reason: string | null | undefined): string {
  switch (reason) {
    case null:
    case undefined:
    case "":
      return "Subscribed";
    case "bounce":
      return "Bounced";
    case "complaint":
      return "Complained";
    case "unsubscribe":
      return "Unsubscribed";
    default:
      return "Suppressed";
  }
}

/** Why a suppression cannot be removed from here. Null when it can. */
export function lockedSuppressionExplanation(
  reason: string | null | undefined,
): string | null {
  if (!reason || canUnsuppress(reason)) return null;
  if (reason === "bounce") {
    return "This address bounced. Sending to it again would hurt your sending reputation, so it stays suppressed.";
  }
  if (reason === "complaint") {
    return "This person marked an email as spam. Sending to them again would hurt your sending reputation, so it stays suppressed.";
  }
  if (reason === "unsubscribe") {
    return "This person unsubscribed. Only their own consent can undo that, so a workspace can't re-add them.";
  }
  return "This suppression was added automatically and can't be removed here.";
}

function plural(count: number, one: string, many = `${one}s`) {
  return `${count.toLocaleString("en-US")} ${count === 1 ? one : many}`;
}

/**
 * The toast for a bulk action that may have partly failed.
 * `done` succeeded; `failed` lists the reasons for the rest (one per item,
 * duplicates collapse). Never claims success for items that failed.
 */
export function summarizeBulk(options: {
  verb: string; // past tense: "Deleted", "Suppressed"
  noun: string; // singular: "contact"
  total: number;
  done: number;
  failed: string[];
}): { kind: "success" | "error"; message: string; description?: string } {
  const { verb, noun, total, done, failed } = options;
  if (failed.length === 0 && done === total) {
    return { kind: "success", message: `${verb} ${plural(done, noun)}` };
  }
  const reasons = [...new Set(failed.filter(Boolean))];
  const failedCount = Math.max(failed.length, total - done);
  return {
    kind: "error",
    message:
      done === 0
        ? `${verb} none of ${plural(total, noun)}`
        : `${verb} ${done.toLocaleString("en-US")} of ${plural(total, noun)}`,
    description:
      `${failedCount.toLocaleString("en-US")} failed` +
      (reasons.length > 0 ? `: ${reasons.slice(0, 3).join("; ")}` : "."),
  };
}

/** Split a list into request-sized pieces. */
export function chunk<T>(items: T[], size: number): T[][] {
  if (size <= 0) throw new Error("chunk size must be positive");
  const out: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    out.push(items.slice(index, index + size));
  }
  return out;
}

export type ExportRow = {
  name: string | null;
  email: string;
  status: string;
  folders: string[];
  createdAt: string;
};

// A cell that starts with one of these is run as a formula by Excel and
// Sheets. Names come from public signup forms, so they are untrusted.
const FORMULA_START = /^[=+\-@\t\r]/;

export function csvCell(value: string): string {
  const safe = FORMULA_START.test(value) ? `'${value}` : value;
  return `"${safe.replaceAll('"', '""')}"`;
}

export function buildContactsCsv(rows: ExportRow[]): string {
  const lines = [
    ["Name", "Email", "Status", "Folders", "Added"],
    ...rows.map((row) => [
      row.name ?? "",
      row.email,
      row.status,
      row.folders.join("; "),
      row.createdAt,
    ]),
  ];
  return lines.map((line) => line.map((value) => csvCell(String(value))).join(",")).join("\r\n");
}

/** "letterstack-audience-newsletter.csv" for a folder, else the plain name. */
export function exportFileName(folderName: string | null): string {
  const slug = (folderName ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
  return slug ? `letterstack-audience-${slug}.csv` : "letterstack-audience.csv";
}
