import { google } from "googleapis";
import crypto from "node:crypto";
import {
  decryptMailboxRefreshToken,
  markMailboxError,
  updateMailboxAccessToken,
  type ConnectedMailbox,
} from "@/db/connected-mailboxes";
import { appBaseUrl } from "./qstash";

/**
 * OAuth plumbing for the Gmail connect flow and for keeping a connected
 * mailbox's access token valid at send time.
 *
 * A dedicated OAuth client (GOOGLE_GMAIL_CLIENT_ID/SECRET), separate from
 * the one lib/auth.ts uses for plain sign-in — see the Gmail Sending plan
 * for why: this feature's consent screen and Google-verification status
 * should never entangle with login.
 */

export const GMAIL_SEND_SCOPE = "https://www.googleapis.com/auth/gmail.send";
const USERINFO_EMAIL_SCOPE = "https://www.googleapis.com/auth/userinfo.email";

function redirectUri(): string {
  return `${appBaseUrl()}/api/senders/gmail/callback`;
}

function oauthClient() {
  const clientId = process.env.GOOGLE_GMAIL_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_GMAIL_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new Error(
      "GOOGLE_GMAIL_CLIENT_ID / GOOGLE_GMAIL_CLIENT_SECRET must be set to connect a Gmail account.",
    );
  }
  return new google.auth.OAuth2(clientId, clientSecret, redirectUri());
}

// state binds the consent redirect back to who started it, HMAC-signed so
// it can't be forged or replayed against a different session — same
// construction as the unsubscribe tokens in lib/email/unsubscribe.ts,
// reused here rather than inventing a second signing scheme.
function stateSecret(): string {
  const s = process.env.AUTH_SECRET;
  if (!s) throw new Error("AUTH_SECRET must be set to start a Gmail connect flow");
  return s;
}

function b64url(buf: Buffer): string {
  return buf.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function b64urlDecode(s: string): Buffer {
  return Buffer.from(s.replace(/-/g, "+").replace(/_/g, "/"), "base64");
}

export function signGmailState(userId: string, organizationId: string): string {
  const payload = b64url(Buffer.from(JSON.stringify({ u: userId, o: organizationId })));
  const sig = b64url(crypto.createHmac("sha256", stateSecret()).update(payload).digest());
  return `${payload}.${sig}`;
}

export function verifyGmailState(
  state: string,
): { userId: string; organizationId: string } | null {
  const [payload, sig] = (state || "").split(".");
  if (!payload || !sig) return null;

  const expected = Buffer.from(
    b64url(crypto.createHmac("sha256", stateSecret()).update(payload).digest()),
  );
  const given = Buffer.from(sig);
  if (expected.length !== given.length || !crypto.timingSafeEqual(expected, given)) {
    return null;
  }

  try {
    const obj = JSON.parse(b64urlDecode(payload).toString("utf8"));
    if (typeof obj?.u === "string" && typeof obj?.o === "string") {
      return { userId: obj.u, organizationId: obj.o };
    }
  } catch {
    // fall through
  }
  return null;
}

/** The URL to send the browser to for Google's consent screen. */
export function buildGmailConsentUrl(userId: string, organizationId: string): string {
  return oauthClient().generateAuthUrl({
    // offline + consent: without both, Google only issues a refresh token
    // on the very first-ever grant for this account/client pair — a
    // reconnect after a dead token would silently get no refresh token at
    // all otherwise.
    access_type: "offline",
    prompt: "consent",
    scope: [GMAIL_SEND_SCOPE, USERINFO_EMAIL_SCOPE],
    state: signGmailState(userId, organizationId),
  });
}

export type GmailTokenGrant = {
  email: string;
  displayName: string | null;
  refreshToken: string;
  accessToken: string;
  accessTokenExpiresAt: Date;
  scope: string;
};

/** Exchange the callback's ?code= for tokens, and fetch which address granted them. */
export async function exchangeGmailCode(code: string): Promise<GmailTokenGrant> {
  const client = oauthClient();
  const { tokens } = await client.getToken(code);

  if (!tokens.refresh_token) {
    throw new Error(
      "Google didn't return a refresh token. This can happen on a repeat " +
        "consent without prompt=consent — try disconnecting and reconnecting.",
    );
  }
  if (!tokens.access_token) {
    throw new Error("Google didn't return an access token.");
  }

  client.setCredentials(tokens);
  const oauth2 = google.oauth2({ auth: client, version: "v2" });
  const { data: userinfo } = await oauth2.userinfo.get();
  if (!userinfo.email) {
    throw new Error("Could not determine the connected Gmail address.");
  }

  return {
    email: userinfo.email.toLowerCase(),
    displayName: userinfo.name ?? null,
    refreshToken: tokens.refresh_token,
    accessToken: tokens.access_token,
    accessTokenExpiresAt: new Date(tokens.expiry_date ?? Date.now() + 55 * 60_000),
    scope: tokens.scope ?? GMAIL_SEND_SCOPE,
  };
}

/** Thrown when a mailbox's refresh token is dead — revoked, or Testing-mode's 7-day expiry. */
export class MailboxReauthRequiredError extends Error {
  constructor(public mailboxId: string) {
    super("This Gmail account needs to be reconnected.");
    this.name = "MailboxReauthRequiredError";
  }
}

const ACCESS_TOKEN_REFRESH_MARGIN_MS = 5 * 60_000;

/**
 * A valid access token for this mailbox — reuses the cached one if it's not
 * near expiry, otherwise refreshes via the stored refresh token. On
 * invalid_grant (the refresh token itself is dead), marks the mailbox
 * `error` and throws MailboxReauthRequiredError so the caller can stop
 * cleanly rather than treat it as an ordinary send failure.
 */
export async function getValidAccessToken(mailbox: ConnectedMailbox): Promise<string> {
  const stillFresh =
    mailbox.accessToken &&
    mailbox.accessTokenExpiresAt &&
    mailbox.accessTokenExpiresAt.getTime() - Date.now() > ACCESS_TOKEN_REFRESH_MARGIN_MS;
  if (stillFresh) return mailbox.accessToken!;

  const client = oauthClient();
  client.setCredentials({ refresh_token: decryptMailboxRefreshToken(mailbox) });

  try {
    const { credentials } = await client.refreshAccessToken();
    if (!credentials.access_token) {
      throw new Error("Google returned no access token on refresh.");
    }
    const expiresAt = new Date(credentials.expiry_date ?? Date.now() + 55 * 60_000);
    await updateMailboxAccessToken(mailbox.id, credentials.access_token, expiresAt);
    return credentials.access_token;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (message.includes("invalid_grant")) {
      await markMailboxError(
        mailbox.id,
        "Gmail access was revoked or expired. Reconnect this account to keep sending.",
      );
      throw new MailboxReauthRequiredError(mailbox.id);
    }
    throw err;
  }
}

/**
 * Revoke with Google, not just locally — a deleted row with a live grant
 * still shows up (and still works) in the user's own Google Account
 * "third-party access" page, and a DB restore could resurrect a working
 * credential believed dead.
 */
export async function revokeMailboxToken(mailbox: ConnectedMailbox): Promise<void> {
  const client = oauthClient();
  try {
    await client.revokeToken(decryptMailboxRefreshToken(mailbox));
  } catch {
    // Already revoked/expired on Google's side — nothing more to do locally
    // than proceed with removing our own record of it.
  }
}
