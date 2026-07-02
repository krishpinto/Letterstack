// Custom sending domain for the active organization.
//
// POST   { domain } — register it in SES and attach it to the org (records returned)
// GET               — current domain + live SES verification state + DNS records
// DELETE            — detach the domain from the org (SES identity is kept;
//                     removing identities is an ops action via scripts/connect-domain.ts)

import { type NextRequest, NextResponse } from "next/server";
import {
  getOrganizationForUser,
  setOrganizationSendingDomain,
  setOrganizationSendingDomainVerified,
} from "@/db/organizations";
import { currentOrganizationId, currentUserId } from "@/lib/auth-helpers";
import {
  getDomainIdentityStatus,
  isValidDomain,
  registerDomainIdentity,
  type DomainIdentityStatus,
} from "@/lib/send/domain-identity";
import { baseSendingDomain, SENDING_LOCALPART } from "@/lib/send/sender-identity";

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

function domainPayload(status: DomainIdentityStatus) {
  return {
    ok: true,
    domain: status.domain,
    dkimStatus: status.dkimStatus,
    mailFromStatus: status.mailFromStatus,
    readyToSend: status.readyToSend,
    records: status.records,
    fromEmail: status.readyToSend
      ? `${SENDING_LOCALPART}@${status.domain}`
      : process.env.MAIL_FROM ?? "",
  };
}

export async function GET() {
  const { organization, error } = await requireOrganization();
  if (error) return error;

  if (!organization.sendingDomain) {
    return NextResponse.json({
      ok: true,
      domain: null,
      fromEmail: process.env.MAIL_FROM ?? "",
    });
  }

  try {
    const status = await getDomainIdentityStatus(organization.sendingDomain);
    // Keep the stored verdict in sync so the send path can trust it without
    // calling SES on every campaign create.
    const wasVerified = Boolean(organization.sendingDomainVerifiedAt);
    if (status.readyToSend !== wasVerified) {
      await setOrganizationSendingDomainVerified(organization.id, status.readyToSend);
    }
    return NextResponse.json(domainPayload(status));
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
    const status = await registerDomainIdentity(domain);
    await setOrganizationSendingDomain(organization.id, domain);
    if (status.readyToSend) {
      await setOrganizationSendingDomainVerified(organization.id, true);
    }
    return NextResponse.json(domainPayload(status));
  } catch (err) {
    console.error("POST /api/domains failed", err);
    return NextResponse.json(
      { ok: false, error: "Could not register the domain with SES. Please try again." },
      { status: 502 },
    );
  }
}

export async function DELETE() {
  const { organization, error } = await requireOrganization();
  if (error) return error;

  await setOrganizationSendingDomain(organization.id, null);
  return NextResponse.json({
    ok: true,
    domain: null,
    fromEmail: process.env.MAIL_FROM ?? "",
  });
}
