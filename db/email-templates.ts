import { eq } from "drizzle-orm";
import { db } from "./client";
import { emailTemplates } from "./schema";

/**
 * Saving "May issue" twice yields "May issue" and "May issue (2)" — identical
 * names in the gallery are indistinguishable, so suffix until unique within
 * the organization. `excludeId` lets a rename keep its own current name.
 */
export async function uniqueTemplateName(
  organizationId: string,
  name: string,
  excludeId?: string,
) {
  const rows = await db
    .select({ id: emailTemplates.id, name: emailTemplates.name })
    .from(emailTemplates)
    .where(eq(emailTemplates.organizationId, organizationId));

  const taken = new Set(
    rows.filter((row) => row.id !== excludeId).map((row) => row.name),
  );
  if (!taken.has(name)) return name;

  let counter = 2;
  while (taken.has(`${name} (${counter})`)) counter++;
  return `${name} (${counter})`;
}
