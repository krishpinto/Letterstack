import { NextResponse } from "next/server";
import { and, desc, eq, inArray } from "drizzle-orm";
import { db } from "@/db/client";
import { categories, recipientCategories, recipients } from "@/db/schema";
import { buildCategoryMappings } from "@/lib/audience/category-mappings";
import { currentOrganizationId } from "@/lib/auth-helpers";

export const runtime = "nodejs";

type CategoryBody = {
  action?: unknown;
  name?: unknown;
  id?: unknown;
  recipientIds?: unknown;
  categoryIds?: unknown;
};

function unauthorized() {
  return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
}

function badRequest(message: string) {
  return NextResponse.json({ ok: false, error: message }, { status: 400 });
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Unknown error";
}

function stringArray(value: unknown) {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : null;
}

export async function GET() {
  const organizationId = await currentOrganizationId();
  if (!organizationId) return unauthorized();

  try {
    const list = await db
      .select()
      .from(categories)
      .where(eq(categories.organizationId, organizationId))
      .orderBy(desc(categories.createdAt));

    let mappings: (typeof recipientCategories.$inferSelect)[] = [];
    if (list.length > 0) {
      const categoryIds = list.map((c) => c.id);
      mappings = await db
        .select()
        .from(recipientCategories)
        .where(inArray(recipientCategories.categoryId, categoryIds));
    }

    return NextResponse.json({ ok: true, categories: list, mappings });
  } catch (error: unknown) {
    return NextResponse.json({ ok: false, error: errorMessage(error) }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const organizationId = await currentOrganizationId();
  if (!organizationId) return unauthorized();

  try {
    const body = (await request.json().catch(() => null)) as CategoryBody | null;
    const action = body?.action;

    if (action === "create") {
      const name = String(body?.name ?? "").trim();
      if (!name) return badRequest("Name is required");

      const [category] = await db
        .insert(categories)
        .values({
          organizationId,
          name,
        })
        .returning();

      return NextResponse.json({ ok: true, category });
    }

    if (action === "map") {
      const recipientIds = stringArray(body?.recipientIds);
      const categoryIds = stringArray(body?.categoryIds);

      if (!recipientIds || !categoryIds) {
        return badRequest("recipientIds and categoryIds arrays are required");
      }

      const orgCategories = await db
        .select({ id: categories.id })
        .from(categories)
        .where(eq(categories.organizationId, organizationId));

      const orgCategoryIds = orgCategories.map((c) => c.id);

      // Recipient ids come from the request too, so they are scoped to this
      // workspace before anything is deleted or inserted.
      const ownedRecipients =
        recipientIds.length > 0
          ? await db
              .select({ id: recipients.id })
              .from(recipients)
              .where(
                and(
                  eq(recipients.organizationId, organizationId),
                  inArray(recipients.id, recipientIds),
                ),
              )
          : [];
      const ownedRecipientIds = ownedRecipients.map((r) => r.id);

      if (orgCategoryIds.length > 0 && ownedRecipientIds.length > 0) {
        await db
          .delete(recipientCategories)
          .where(
            and(
              inArray(recipientCategories.recipientId, ownedRecipientIds),
              inArray(recipientCategories.categoryId, orgCategoryIds),
            ),
          );
      }

      const values = buildCategoryMappings({
        recipientIds,
        categoryIds,
        ownedRecipientIds,
        ownedCategoryIds: orgCategoryIds,
      });

      if (values.length > 0) {
        await db.insert(recipientCategories).values(values).onConflictDoNothing();
      }

      return NextResponse.json({ ok: true });
    }

    return badRequest("Invalid action");
  } catch (error: unknown) {
    return NextResponse.json({ ok: false, error: errorMessage(error) }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  const organizationId = await currentOrganizationId();
  if (!organizationId) return unauthorized();

  try {
    const body = (await request.json().catch(() => null)) as CategoryBody | null;
    const id = typeof body?.id === "string" ? body.id : "";
    const name = String(body?.name ?? "").trim();

    if (!id || !name) return badRequest("id and name are required");

    await db
      .update(categories)
      .set({ name })
      .where(
        and(
          eq(categories.id, id),
          eq(categories.organizationId, organizationId),
        ),
      );

    return NextResponse.json({ ok: true });
  } catch (error: unknown) {
    return NextResponse.json({ ok: false, error: errorMessage(error) }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  const organizationId = await currentOrganizationId();
  if (!organizationId) return unauthorized();

  const id = new URL(request.url).searchParams.get("id") ?? "";
  if (!id) return badRequest("id is required");

  try {
    await db
      .delete(categories)
      .where(
        and(
          eq(categories.id, id),
          eq(categories.organizationId, organizationId),
        ),
      );

    return NextResponse.json({ ok: true });
  } catch (error: unknown) {
    return NextResponse.json({ ok: false, error: errorMessage(error) }, { status: 500 });
  }
}
