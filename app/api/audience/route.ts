import { NextResponse } from "next/server";
import {
  addRecipient,
  deleteRecipient,
  listRecipientsForOrganization,
  recipientExists,
  updateRecipient,
} from "@/db/recipients";
import { isSuppressedForOrganization } from "@/db/suppression";
import { enqueueAutomationsForEvent } from "@/lib/automations/run";
import { checkContactHeadroom } from "@/lib/plans/guards";
import { currentOrganizationId, currentUserId } from "@/lib/auth-helpers";

export const runtime = "nodejs";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function unauthorized() {
  return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
}

function realError(error: unknown) {
  if (error instanceof Error) {
    const cause = (error as { cause?: unknown }).cause;
    if (cause instanceof Error) return cause.message;
    return error.message;
  }
  return "Unknown error";
}

export async function GET() {
  const userId = await currentUserId();
  if (!userId) return unauthorized();

  const organizationId = await currentOrganizationId();
  if (!organizationId) {
    return NextResponse.json({ ok: false, error: "Organization required" }, { status: 428 });
  }

  try {
    const recipients = await listRecipientsForOrganization(organizationId);
    return NextResponse.json({ ok: true, recipients });
  } catch (error) {
    return NextResponse.json({ ok: false, error: realError(error) }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const userId = await currentUserId();
  if (!userId) return unauthorized();

  const organizationId = await currentOrganizationId();
  if (!organizationId) {
    return NextResponse.json({ ok: false, error: "Organization required" }, { status: 428 });
  }

  try {
    const body = await request.json().catch(() => null);
    const email = String(body?.email ?? "").trim().toLowerCase();
    const name = String(body?.name ?? "").trim() || null;

    if (!EMAIL_RE.test(email)) {
      return NextResponse.json({ ok: false, error: "Valid email required" }, { status: 400 });
    }

    if (await isSuppressedForOrganization(organizationId, email)) {
      return NextResponse.json(
        { ok: false, error: "That email is suppressed for this organization" },
        { status: 400 },
      );
    }

    // Checked before the insert, and only for a genuinely new contact — a
    // re-add of someone already on the list doesn't grow the audience, so it
    // shouldn't be refused for want of headroom.
    if (!(await recipientExists(organizationId, email))) {
      const headroom = await checkContactHeadroom(organizationId, 1);
      if (!headroom.ok) {
        return NextResponse.json(
          { ok: false, error: headroom.message, limit: headroom.limit, used: headroom.used },
          { status: 402 },
        );
      }
    }

    const recipient = await addRecipient(organizationId, userId, { email, name });
    if (!recipient) {
      return NextResponse.json(
        { ok: false, error: "That contact is already in this audience" },
        { status: 409 },
      );
    }

    // Fire "contact added" automations. Never blocks the add itself.
    await enqueueAutomationsForEvent(organizationId, "contact.added", [
      {
        id: recipient.id,
        email: recipient.email,
        name: recipient.name,
        userId: recipient.userId,
      },
    ]);

    return NextResponse.json({ ok: true, recipient });
  } catch (error) {
    return NextResponse.json({ ok: false, error: realError(error) }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  const userId = await currentUserId();
  if (!userId) return unauthorized();

  const organizationId = await currentOrganizationId();
  if (!organizationId) {
    return NextResponse.json({ ok: false, error: "Organization required" }, { status: 428 });
  }

  try {
    const body = await request.json().catch(() => null);
    const id = String(body?.id ?? "");
    if (!id) {
      return NextResponse.json({ ok: false, error: "id required" }, { status: 400 });
    }

    const patch: { email?: string; name?: string | null } = {};

    if (body?.email !== undefined) {
      const email = String(body.email).trim().toLowerCase();
      if (!EMAIL_RE.test(email)) {
        return NextResponse.json({ ok: false, error: "Valid email required" }, { status: 400 });
      }
      if (await isSuppressedForOrganization(organizationId, email)) {
        return NextResponse.json(
          { ok: false, error: "That email is suppressed for this organization" },
          { status: 400 },
        );
      }
      patch.email = email;
    }

    if (body?.name !== undefined) {
      patch.name = String(body.name).trim() || null;
    }

    const recipient = await updateRecipient(organizationId, id, patch);
    if (!recipient) {
      return NextResponse.json({ ok: false, error: "Contact not found" }, { status: 404 });
    }

    return NextResponse.json({ ok: true, recipient });
  } catch (error) {
    const message = realError(error);
    // The (organization, email) unique constraint: the new address already
    // belongs to another contact.
    if (message.includes("duplicate key")) {
      return NextResponse.json(
        { ok: false, error: "Another contact already uses that email" },
        { status: 409 },
      );
    }
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  const userId = await currentUserId();
  if (!userId) return unauthorized();

  const organizationId = await currentOrganizationId();
  if (!organizationId) {
    return NextResponse.json({ ok: false, error: "Organization required" }, { status: 428 });
  }

  const id = new URL(request.url).searchParams.get("id") ?? "";
  if (!id) {
    return NextResponse.json({ ok: false, error: "id required" }, { status: 400 });
  }

  try {
    const deleted = await deleteRecipient(organizationId, id);
    if (!deleted) {
      return NextResponse.json({ ok: false, error: "Contact not found" }, { status: 404 });
    }
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ ok: false, error: realError(error) }, { status: 500 });
  }
}