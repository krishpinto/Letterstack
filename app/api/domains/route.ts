// Custom sending domains for the active organization, capped by its plan
// (sendingDomainLimitFor — Free 1, Starter 2, Growth 5, Business 10).
//
// POST   { domain }  — register it in SES and attach it to the org (records returned)
// GET                — all connected domains + live SES verification state + records
// DELETE ?domain=x   — detach the domain from the org and delete its SES
//                      identity, so nobody can inherit it verified (see
//                      lib/send/domain-ownership.ts)

import { type NextRequest, NextResponse } from "next/server";
import { getOrganizationForUser } from "@/db/organizations";
import {
  addSendingDomain,
  listSendingDomains,
  removeSendingDomain,
  sendingDomainLimitFor,
  setSendingDomainVerified,
} from "@/db/sending-domains";
import { disconnectSendingDomain } from "@/lib/organizations/sending-domains";
import { currentOrganizationId, currentUserId } from "@/lib/auth-helpers";
import {
  configureDomainIdentity,
  createDomainIdentity,
  getDomainIdentityStatus,
  isValidDomain,
  releaseDomainIdentity,
  type DomainIdentityStatus,
} from "@/lib/send/domain-identity";
import { decideAddIdentity, isPlatformDomain } from "@/lib/send/domain-ownership";
import { baseSendingDomain } from "@/lib/send/sender-identity";

export const runtime = "nodejs";

async function requireOrganization() {
  const userId = await currentUserId();
  if (!userId) {
    return {
      error: NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 }),
    };
  }
  const organizationId = await currentOrganizationId();
  if (!organizationId) {
    return {
      error: NextResponse.json(
        { ok: false, error: "Organization required" },
        { status: 428 },
      ),
    };
  }
  const organization = await getOrganizationForUser(userId, organizationId);
  if (!organization) {
    return {
      error: NextResponse.json(
        { ok: false, error: "Organization not found" },
        { status: 404 },
      ),
    };
  }
  return { organization };
}

function domainEntry(status: DomainIdentityStatus) {
  return {
    domain: status.domain,
    dkimStatus: status.dkimStatus,
    mailFromStatus: status.mailFromStatus,
    readyToSend: status.readyToSend,
    records: status.records,
  };
}

async function domainsPayload(organizationId: string) {
  const rows = await listSendingDomains(organizationId);
  // The org's own tier, not the module-level fallback. These two used to
  // disagree: the payload reported PLAN_LIMITS.pro.domains to everyone while
  // addSendingDomain enforced the actual plan, so a Free workspace was told
  // it could connect 2 and refused at 1, and a Business workspace paying for
  // 10 was told 2.
  const limit = await sendingDomainLimitFor(organizationId);

  const domains = await Promise.all(
    rows.map(async (row) => {
      const status = await getDomainIdentityStatus(row.domain);
      // Keep the stored verdict in sync so the send path can trust it
      // without calling SES on every campaign create.
      if (status.readyToSend !== Boolean(row.verifiedAt)) {
        await setSendingDomainVerified(
          organizationId,
          row.domain,
          status.readyToSend,
        );
      }
      return domainEntry(status);
    }),
  );

  return {
    ok: true,
    sharedFromEmail: process.env.MAIL_FROM ?? "",
    limit,
    domains,
  };
}

export async function GET() {
  const { organization, error } = await requireOrganization();
  if (error) return error;

  try {
    return NextResponse.json(await domainsPayload(organization.id));
  } catch (err) {
    console.error("GET /api/domains failed", err);
    return NextResponse.json(
      { ok: false, error: "Could not read domain status from SES." },
      { status: 502 },
    );
  }
}

export async function POST(request: NextRequest) {
  const { organization, error } = await requireOrganization();
  if (error) return error;

  const body = await request.json().catch(() => null);
  const domain = String(body?.domain ?? "")
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/\/.*$/, "");

  if (!isValidDomain(domain)) {
    return NextResponse.json(
      { ok: false, error: "Enter a valid domain, like example.com" },
      { status: 400 },
    );
  }

  if (isPlatformDomain(domain, baseSendingDomain())) {
    return NextResponse.json(
      { ok: false, error: "That domain belongs to LetterStack — connect a domain you own." },
      { status: 400 },
    );
  }

  let added: Awaited<ReturnType<typeof addSendingDomain>>;
  try {
    added = await addSendingDomain(organization.id, domain);
  } catch (err) {
    if (err instanceof Error && /unique|duplicate/i.test(err.message)) {
      return NextResponse.json(
        { ok: false, error: "That domain is already connected to another workspace." },
        { status: 409 },
      );
    }
    console.error("POST /api/domains failed", err);
    return NextResponse.json(
      { ok: false, error: "Could not connect the domain. Please try again." },
      { status: 500 },
    );
  }

  if (!added) {
    const limit = await sendingDomainLimitFor(organization.id);
    return NextResponse.json(
      {
        ok: false,
        error: `Your plan includes ${limit} sending domain${limit === 1 ? "" : "s"}. Disconnect one, or upgrade for more.`,
      },
      { status: 400 },
    );
  }

  const { row, created: rowCreated } = added;
  let identityCreated = false;
  try {
    const identity = await createDomainIdentity(domain);
    identityCreated = identity === "created";

    const decision = decideAddIdentity({
      identityExisted: identity === "exists",
      connectedBeforeRequest: !rowCreated,
    });
    if (decision === "refuse") {
      // The identity is orphaned or operator-managed, and may already be
      // verified. Undo our row and leave the identity untouched.
      await removeSendingDomain(organization.id, domain);
      return NextResponse.json(
        {
          ok: false,
          error:
            "This domain is already registered with our email provider. Contact support to release it.",
        },
        { status: 409 },
      );
    }

    const status = await configureDomainIdentity(domain);
    if (status.readyToSend !== Boolean(row.verifiedAt)) {
      await setSendingDomainVerified(organization.id, domain, status.readyToSend);
    }
    return NextResponse.json(await domainsPayload(organization.id));
  } catch (err) {
    console.error("POST /api/domains failed", err);
    // Roll back what this request created, so a retry starts clean. Keeping
    // the row would let the retry count as "connected before" and adopt
    // whatever identity is in SES by then; keeping an identity we created
    // without a row would orphan it.
    if (rowCreated) {
      await removeSendingDomain(organization.id, domain).catch((e) =>
        console.error("POST /api/domains rollback (row) failed", e),
      );
      if (identityCreated) {
        await releaseDomainIdentity(domain).catch((e) =>
          console.error(`POST /api/domains rollback (SES identity ${domain}) failed`, e),
        );
      }
    }
    return NextResponse.json(
      { ok: false, error: "Could not register the domain with SES. Please try again." },
      { status: 502 },
    );
  }
}

export async function DELETE(request: NextRequest) {
  const { organization, error } = await requireOrganization();
  if (error) return error;

  const domain = request.nextUrl.searchParams.get("domain")?.trim().toLowerCase();
  if (!domain) {
    return NextResponse.json(
      { ok: false, error: "domain query parameter required" },
      { status: 400 },
    );
  }

  try {
    const disconnected = await disconnectSendingDomain(organization.id, domain);
    if (!disconnected) {
      return NextResponse.json(
        { ok: false, error: "That domain isn't connected to this workspace." },
        { status: 404 },
      );
    }
  } catch (err) {
    console.error("DELETE /api/domains failed", err);
    return NextResponse.json(
      { ok: false, error: "Could not release the domain from SES. Please try again." },
      { status: 502 },
    );
  }

  try {
    return NextResponse.json(await domainsPayload(organization.id));
  } catch {
    return NextResponse.json({
      ok: true,
      sharedFromEmail: process.env.MAIL_FROM ?? "",
      limit: await sendingDomainLimitFor(organization.id),
      domains: [],
    });
  }
}
