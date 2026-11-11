import { NextResponse, type NextRequest } from "next/server";
import { exchangeGmailCode, verifyGmailState } from "@/lib/send/gmail-auth";
import { GMAIL_NONCE_COOKIE, safeEqual } from "@/lib/send/gmail-state";
import { sendGmailMessage } from "@/lib/send/gmail";
import { upsertConnectedMailbox } from "@/db/connected-mailboxes";
import { getMemberRole } from "@/db/organizations";
import { currentUserId } from "@/lib/auth-helpers";
import { appBaseUrl } from "@/lib/send/qstash";

export const runtime = "nodejs";

const DOMAINS_PAGE = "/dashboard/domains";

function redirectWithStatus(status: "connected" | "error", message?: string) {
  const url = new URL(DOMAINS_PAGE, appBaseUrl());
  url.searchParams.set("gmail", status);
  if (message) url.searchParams.set("gmail_error", message);
  const response = NextResponse.redirect(url);
  // One attempt per nonce, whatever the outcome.
  response.cookies.delete({ name: GMAIL_NONCE_COOKIE, path: "/api/senders/gmail/callback" });
  return response;
}

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const googleError = url.searchParams.get("error");

  if (googleError) {
    // The person declined consent, or Google refused for its own reason —
    // not a bug, just not a connection.
    return redirectWithStatus("error", "Google sign-in was cancelled.");
  }
  if (!code || !state) {
    return redirectWithStatus("error", "Missing authorization code.");
  }

  // All of these run before the code is exchanged, so a request that fails
  // them never touches Google or a mailbox. See lib/send/gmail-state.ts.
  const claim = verifyGmailState(state);
  if (!claim) {
    return redirectWithStatus("error", "This link has expired — try connecting again.");
  }

  // Only the browser that started the flow at /connect has this cookie.
  const cookieNonce = request.cookies.get(GMAIL_NONCE_COOKIE)?.value ?? "";
  if (!cookieNonce || !safeEqual(cookieNonce, claim.nonce)) {
    return redirectWithStatus(
      "error",
      "This connection was started in a different browser — try connecting again.",
    );
  }

  // The person finishing the flow must be the one who started it, and must
  // still belong to the workspace the mailbox will be attached to.
  const userId = await currentUserId();
  if (!userId || userId !== claim.userId) {
    return redirectWithStatus(
      "error",
      "You're signed in as a different account than the one that started this connection.",
    );
  }
  if (!(await getMemberRole(claim.userId, claim.organizationId))) {
    return redirectWithStatus("error", "You're no longer a member of that workspace.");
  }

  try {
    const grant = await exchangeGmailCode(code);

    // Prove the grant actually works, not just that Google issued tokens —
    // a real Gmail API call either succeeds or throws, which is a more
    // meaningful check than the SMTP alternative's connection-only verify().
    // Sent to the connected address itself, so the person sees proof it
    // works without spending it on a real recipient.
    await sendGmailMessage(grant.accessToken, {
      to: grant.email,
      subject: "LetterStack is connected to your Gmail",
      fromName: "LetterStack",
      fromEmail: grant.email,
      html: "<p>This confirms LetterStack can send campaigns through this Gmail account. You're all set.</p>",
      text: "This confirms LetterStack can send campaigns through this Gmail account. You're all set.",
    });

    await upsertConnectedMailbox({
      organizationId: claim.organizationId,
      userId: claim.userId,
      email: grant.email,
      displayName: grant.displayName,
      refreshToken: grant.refreshToken,
      accessToken: grant.accessToken,
      accessTokenExpiresAt: grant.accessTokenExpiresAt,
      scope: grant.scope,
    });

    return redirectWithStatus("connected");
  } catch (err) {
    const message = err instanceof Error ? err.message : "Could not connect this Gmail account.";
    return redirectWithStatus("error", message);
  }
}
