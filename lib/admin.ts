// Founder-only authorization: signed in AND email in ADMIN_EMAILS
// (comma-separated env var, set in .env.local and Vercel).

export function isAdmin(email: string | null | undefined) {
  if (!email) return false;
  const allowed = (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((entry) => entry.trim().toLowerCase())
    .filter(Boolean);
  return allowed.includes(email.toLowerCase());
}
