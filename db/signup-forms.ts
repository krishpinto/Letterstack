import crypto from "node:crypto";
import { and, desc, eq, sql } from "drizzle-orm";
import { db } from "./client";
import { signupForms } from "./schema";

export type SignupForm = typeof signupForms.$inferSelect;

/** Editable widget fields — everything except identity/ownership/counters. */
export type FormLayout = "card" | "minimal" | "inline";
export type FormTheme = "light" | "dark";
export type FormCornerStyle = "sharp" | "rounded" | "pill";

export type SignupFormSettings = {
  name: string;
  headline: string;
  description: string;
  buttonLabel: string;
  successMessage: string;
  accentColor: string;
  collectName: boolean;
  layout: FormLayout;
  theme: FormTheme;
  cornerStyle: FormCornerStyle;
};

/** Unguessable, URL-safe public id used in /s/<key> and /embed/<key>. */
function generatePublicKey(): string {
  return crypto.randomBytes(9).toString("base64url");
}

export async function createSignupForm(
  organizationId: string,
  userId: string,
  input: Partial<SignupFormSettings> & { name: string },
) {
  const [row] = await db
    .insert(signupForms)
    .values({
      organizationId,
      userId,
      publicKey: generatePublicKey(),
      name: input.name,
      ...cleanSettings(input),
    })
    .returning();
  return row;
}

export async function listSignupForms(organizationId: string) {
  return db
    .select()
    .from(signupForms)
    .where(eq(signupForms.organizationId, organizationId))
    .orderBy(desc(signupForms.createdAt));
}

export async function getSignupForm(organizationId: string, id: string) {
  const [row] = await db
    .select()
    .from(signupForms)
    .where(
      and(eq(signupForms.id, id), eq(signupForms.organizationId, organizationId)),
    )
    .limit(1);
  return row ?? null;
}

/** Look up a form by its public key — the entry point for the public routes. */
export async function getSignupFormByPublicKey(publicKey: string) {
  const [row] = await db
    .select()
    .from(signupForms)
    .where(eq(signupForms.publicKey, publicKey))
    .limit(1);
  return row ?? null;
}

export async function updateSignupForm(
  organizationId: string,
  id: string,
  input: Partial<SignupFormSettings>,
) {
  const [row] = await db
    .update(signupForms)
    .set({ ...cleanSettings(input), updatedAt: new Date() })
    .where(
      and(eq(signupForms.id, id), eq(signupForms.organizationId, organizationId)),
    )
    .returning();
  return row ?? null;
}

export async function deleteSignupForm(organizationId: string, id: string) {
  const rows = await db
    .delete(signupForms)
    .where(
      and(eq(signupForms.id, id), eq(signupForms.organizationId, organizationId)),
    )
    .returning({ id: signupForms.id });
  return rows.length > 0;
}

/**
 * Bump the confirmed-subscriber tally by one. Called from the public confirm
 * path (no org scope — the caller has already validated a signed token), so it
 * keys on the form id alone.
 */
export async function incrementSubscriberCount(id: string) {
  await db
    .update(signupForms)
    .set({ subscriberCount: sql`${signupForms.subscriberCount} + 1` })
    .where(eq(signupForms.id, id));
}

/** Keep only the settings fields, dropping undefined so a PATCH can be partial. */
function cleanSettings(input: Partial<SignupFormSettings>) {
  const out: Partial<SignupFormSettings> = {};
  if (input.name !== undefined) out.name = input.name;
  if (input.headline !== undefined) out.headline = input.headline;
  if (input.description !== undefined) out.description = input.description;
  if (input.buttonLabel !== undefined) out.buttonLabel = input.buttonLabel;
  if (input.successMessage !== undefined)
    out.successMessage = input.successMessage;
  if (input.accentColor !== undefined) out.accentColor = input.accentColor;
  if (input.collectName !== undefined) out.collectName = input.collectName;
  if (input.layout !== undefined) out.layout = input.layout;
  if (input.theme !== undefined) out.theme = input.theme;
  if (input.cornerStyle !== undefined) out.cornerStyle = input.cornerStyle;
  return out;
}
