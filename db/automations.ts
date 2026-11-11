import { and, desc, eq } from "drizzle-orm";
import { db } from "./client";
import { automations, automationStepRuns } from "./schema";
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

/**
 * Claim one step of one automation run (stepKey from lib/automations/steps).
 * Returns true if this call is the first to claim it, so the caller should
 * perform the step, and false if an earlier delivery already did. A single
 * INSERT ... ON CONFLICT DO NOTHING, so two concurrent deliveries of the same
 * message can't both win (neon-http has no transactions; this doesn't need
 * one).
 */
export async function claimAutomationStep(
  automationId: string,
  runId: string,
  stepKey: string,
): Promise<boolean> {
  const rows = await db
    .insert(automationStepRuns)
    .values({ automationId, runId, nodeId: stepKey })
    .onConflictDoNothing({
      target: [automationStepRuns.runId, automationStepRuns.nodeId],
    })
    .returning({ id: automationStepRuns.id });
  return rows.length > 0;
}

/**
 * Give a claim back when the step failed before taking effect (SES or QStash
 * rejected the call), so QStash's retry can try it again.
 */
export async function releaseAutomationStep(runId: string, stepKey: string) {
  await db
    .delete(automationStepRuns)
    .where(
      and(eq(automationStepRuns.runId, runId), eq(automationStepRuns.nodeId, stepKey)),
    );
}
