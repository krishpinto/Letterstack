// Founder-only authorization: signed in, email in ADMIN_EMAILS
// (comma-separated env var, set in .env.local and Vercel), AND that email
// proven to belong to the person signed in.
//
// The last part matters because the allowlist is keyed by email: without it,
// anyone could register an admin's address with a password before the admin
// ever signed up and walk straight into /admin.

export type AdminCandidate = {
  email?: string | null;
  hasVerifiedEmail?: boolean;
} | null | undefined;

export function isAdmin(user: AdminCandidate) {
  if (!user?.email || !user.hasVerifiedEmail) return false;
  const allowed = (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((entry) => entry.trim().toLowerCase())
    .filter(Boolean);
  return allowed.includes(user.email.toLowerCase());
}
