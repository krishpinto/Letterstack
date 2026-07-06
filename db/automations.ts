import { and, desc, eq } from "drizzle-orm";
import { db } from "./client";
import { automations } from "./schema";
import type { AutomationFlow } from "@/lib/automations/flow";

export async function createAutomation(
  organizationId: string,
  userId: string,
  name: string,
  flow: AutomationFlow,
) {
  const [row] = await db
    .insert(automations)
    .values({ organizationId, userId, name, flow })
    .returning();

  return row;
}

export async function listAutomationsForOrganization(organizationId: string) {
  return db
    .select()
    .from(automations)
    .where(eq(automations.organizationId, organizationId))
    .orderBy(desc(automations.createdAt));
}

export async function getAutomation(id: string, organizationId: string) {
  const [row] = await db
    .select()
    .from(automations)
    .where(
      and(eq(automations.id, id), eq(automations.organizationId, organizationId)),
    )
    .limit(1);

  return row ?? null;
}

export async function getAutomationById(id: string) {
  const [row] = await db
    .select()
    .from(automations)
    .where(eq(automations.id, id))
    .limit(1);

  return row ?? null;
}

export async function updateAutomation(
  id: string,
  organizationId: string,
  patch: { name?: string; status?: "enabled" | "disabled"; flow?: AutomationFlow },
) {
  const [row] = await db
    .update(automations)
    .set({ ...patch, updatedAt: new Date() })
    .where(
      and(eq(automations.id, id), eq(automations.organizationId, organizationId)),
    )
    .returning();

  return row ?? null;
}

export async function deleteAutomation(id: string, organizationId: string) {
  const rows = await db
    .delete(automations)
    .where(
      and(eq(automations.id, id), eq(automations.organizationId, organizationId)),
    )
    .returning({ id: automations.id });

  return rows.length > 0;
}

export async function listEnabledAutomationsForOrganization(organizationId: string) {
  return db
    .select()
    .from(automations)
    .where(
      and(
        eq(automations.organizationId, organizationId),
        eq(automations.status, "enabled"),
      ),
    );
}
