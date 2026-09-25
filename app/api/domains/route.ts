// Custom sending domains for the active organization, capped by its plan
// (sendingDomainLimitFor — Free 1, Starter 2, Growth 5, Business 10).
//
// POST   { domain }  — register it in SES and attach it to the org (records returned)
// GET                — all connected domains + live SES verification state + records
// DELETE ?domain=x   — detach the domain from the org (SES identity is kept;
//                      removing identities is an ops action via scripts/connect-domain.ts)

import { type NextRequest, NextResponse } from "next/server";
import { getOrganizationForUser } from "@/db/organizations";
import {
  addSendingDomain,
  listSendingDomains,
  removeSendingDomain,
  sendingDomainLimitFor,
  setSendingDomainVerified,
} from "@/db/sending-domains";
import { currentOrganizationId, currentUserId } from "@/lib/auth-helpers";
import {
  getDomainIdentityStatus,
  isValidDomain,
  registerDomainIdentity,
  type DomainIdentityStatus,
} from "@/lib/send/domain-identity";
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

  const base = baseSendingDomain();
  if (domain === base || domain.endsWith(`.${base}`)) {
    return NextResponse.json(
      { ok: false, error: "That domain belongs to LetterStack — connect a domain you own." },
      { status: 400 },
    );
  }

  try {
    const row = await addSendingDomain(organization.id, domain);
    if (!row) {
      const limit = await sendingDomainLimitFor(organization.id);
      return NextResponse.json(
        {
          ok: false,
          error: `Your plan includes ${limit} sending domain${limit === 1 ? "" : "s"}. Disconnect one, or upgrade for more.`,
        },
        { status: 400 },
      );
    }

    const status = await registerDomainIdentity(domain);
    if (status.readyToSend !== Boolean(row.verifiedAt)) {
      await setSendingDomainVerified(organization.id, domain, status.readyToSend);
    }
    return NextResponse.json(await domainsPayload(organization.id));
  } catch (err) {
    if (err instanceof Error && /unique|duplicate/i.test(err.message)) {
      return NextResponse.json(
        { ok: false, error: "That domain is already connected to another workspace." },
        { status: 409 },
      );
    }
    console.error("POST /api/domains failed", err);
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

  await removeSendingDomain(organization.id, domain);
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
