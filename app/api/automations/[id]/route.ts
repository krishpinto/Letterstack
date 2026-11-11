import { NextResponse } from "next/server";
import {
  deleteAutomation,
  getAutomation,
  updateAutomation,
} from "@/db/automations";
import { listVerifiedSendingDomains } from "@/db/sending-domains";
import { isValidFlow, type AutomationFlow } from "@/lib/automations/flow";
import { disallowedSenders, withNormalizedSenders } from "@/lib/automations/senders";
import { enableProblem } from "@/lib/automations/validate";
import { currentOrganizationId } from "@/lib/auth-helpers";

export const runtime = "nodejs";

type PatchBody = {
  name?: unknown;
  status?: unknown;
  flow?: unknown;
};

export async function GET(
  _request: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id } = await ctx.params;
  const organizationId = await currentOrganizationId();
  if (!organizationId) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  try {
    const automation = await getAutomation(id, organizationId);
    if (!automation) {
      return NextResponse.json({ ok: false, error: "Automation not found" }, { status: 404 });
    }
    return NextResponse.json({ ok: true, automation });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

export async function PATCH(
  request: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id } = await ctx.params;
  const organizationId = await currentOrganizationId();
  if (!organizationId) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = (await request.json().catch(() => null)) as PatchBody | null;
    const patch: {
      name?: string;
      status?: "enabled" | "disabled";
      flow?: AutomationFlow;
    } = {};

    if (body?.name !== undefined) {
      const name = String(body.name).trim();
      if (!name) {
        return NextResponse.json({ ok: false, error: "Name required" }, { status: 400 });
      }
      patch.name = name;
    }
    if (body?.status !== undefined) {
      if (body.status !== "enabled" && body.status !== "disabled") {
        return NextResponse.json({ ok: false, error: "Invalid status" }, { status: 400 });
      }
      patch.status = body.status;
    }
    if (body?.flow !== undefined) {
      if (!isValidFlow(body.flow)) {
        return NextResponse.json({ ok: false, error: "Invalid flow" }, { status: 400 });
      }
      patch.flow = withNormalizedSenders(body.flow);
    }

    const existing = await getAutomation(id, organizationId);
    if (!existing) {
      return NextResponse.json({ ok: false, error: "Automation not found" }, { status: 404 });
    }

    // A live automation must have a trigger and at least one finished step.
    // Checked when it is switched on and when its flow is saved while live,
    // so emptying a running flow can't leave it "on" doing nothing. Drafts
    // may be saved half-finished.
    const willBeEnabled = (patch.status ?? existing.status) === "enabled";
    if (willBeEnabled && (patch.flow || patch.status === "enabled")) {
      const problem = enableProblem(patch.flow ?? (existing.flow as AutomationFlow));
      if (problem) {
        return NextResponse.json({ ok: false, error: problem }, { status: 400 });
      }
    }

    // Check senders whenever a flow is saved or switched on. Turning on an
    // older flow re-checks it too, since its domain may have been removed.
    if (patch.flow || patch.status === "enabled") {
      const flow = patch.flow ?? (existing.flow as AutomationFlow);
      const bad = disallowedSenders(flow, await listVerifiedSendingDomains(organizationId));
      if (bad.length > 0) {
        return NextResponse.json(
          {
            ok: false,
            error: `Automations can only send from the shared address or an address on one of this workspace's verified domains. Not allowed: ${bad.join(", ")}`,
          },
          { status: 400 },
        );
      }
    }

    const automation = await updateAutomation(id, organizationId, patch);
    if (!automation) {
      return NextResponse.json({ ok: false, error: "Automation not found" }, { status: 404 });
    }
    return NextResponse.json({ ok: true, automation });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

export async function DELETE(
  _request: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id } = await ctx.params;
  const organizationId = await currentOrganizationId();
  if (!organizationId) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  try {
    const deleted = await deleteAutomation(id, organizationId);
    if (!deleted) {
      return NextResponse.json({ ok: false, error: "Automation not found" }, { status: 404 });
    }
    return NextResponse.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
