// Custom sending domains for the active organization (up to SENDING_DOMAIN_LIMIT).
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
  SENDING_DOMAIN_LIMIT,
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
    limit: SENDING_DOMAIN_LIMIT,
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
      return NextResponse.json(
        {
          ok: false,
          error: `You can connect up to ${SENDING_DOMAIN_LIMIT} domains. Disconnect one first.`,
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
      limit: SENDING_DOMAIN_LIMIT,
      domains: [],
    });
  }
}
