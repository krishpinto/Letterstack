# Early Access / Waitlist Plan

Status: **built**. This reflects what actually shipped, which diverges from
the original design in two ways worth calling out up front:

1. The gate is centralized in **`proxy.ts`** (Next.js's middleware, renamed
   from `middleware.ts` as of Next.js 16), not copy-pasted into
   `app/dashboard/layout.tsx` plus a new onboarding layout. `proxy.ts` was
   already the single chokepoint for `/dashboard`, `/editor`, and
   `/onboarding` — adding the `access_status` check there once, alongside
   the existing session check, was simpler than three separate call sites.
2. The "you're on the list" email is sent **lazily from the `/early-access`
   page**, not from signup or from `lib/auth.ts`'s Google sign-in path.
   `lib/auth.ts` is imported by `proxy.ts`, which runs on the Edge runtime —
   the AWS SDK used to send mail (`@aws-sdk/client-sesv2`) doesn't belong in
   that bundle. `/early-access` is a normal Node.js server component, and
   every pending user's first request there naturally fires the email
   exactly once, guarded by `users.waitlist_applied_email_sent_at`.

## Why

LetterStack is about to be marketed publicly for the first time. CIBA is
already a real, live user sending real campaigns. The goal is to let a
small, curated set of additional orgs in — not to fully open self-serve
signup. Signup stays open (so anyone can create an account), but reaching
the dashboard requires approval.

This replaces the old CLAUDE.md rule that self-serve onboarding was fully
out of scope "until a second paying client exists" — the second client is
meant to arrive through this waitlist.

## Data model

`users` gained four columns (migration `db/migrations/0006_early_access.sql`):
- `access_status` — `'pending' | 'approved' | 'rejected'`, default
  `'pending'`. Every row that existed before this migration was backfilled
  to `'approved'` in the same migration, so CIBA and every other existing
  account kept working without a manual admin click.
- `access_decided_at`, `access_decided_by_user_id` — audit trail for the
  admin decision.
- `waitlist_applied_email_sent_at` — guards the applied-email against being
  sent twice (see above).

Per-user rather than per-org: the existing dashboard gate already keys off
the session user, and a user can belong to multiple orgs.

## Where the gate lives

`proxy.ts` — after the existing `if (!req.auth)` redirect-to-login, and
before falling through to the matched route:
- `/admin*` is exempted from the `access_status` check entirely — its
  authorization is independent (`isAdmin()`, email allowlist, checked
  inside its own API routes in `lib/admin.ts`).
- `/early-access` itself: `approved` → redirect to `/dashboard` (handles a
  bookmarked link after approval); otherwise let it through.
- Everything else matched (`/dashboard`, `/editor`, `/onboarding`): not
  `approved` → redirect to `/early-access`.

`access_status` is read fresh from the DB on every request via
`getAccessStatus()` in `db/access.ts` — never cached in the JWT. Approval
happens while the user is signed out, so a token claim would only refresh on
next login anyway; reading fresh avoids a stale "still pending" bounce right
after an admin approves someone. This works in the Edge runtime because
`db/client.ts` uses `drizzle-orm/neon-http`, an HTTP driver — edge-safe, and
already exercised there indirectly via `lib/auth.ts`'s `upsertGoogleUser`.

`/` redirects every non-approved visitor — anonymous included — to
`/early-access`, not to `/login`. This was a deliberate reversal of the
original assumption in this plan (that `/` should stay public): during the
invite-only beta there is no marketing site to browse; `/early-access` *is*
the front door.

`/early-access` itself is therefore reachable with **no session** — it's
gated in `proxy.ts` on `access_status`, not on `req.auth` — and the page
component (`app/(auth)/early-access/page.tsx`) renders one of three states:
- No session → "Apply for early access": pitch copy + buttons to `/signup`
  and `/login`.
- Signed in, `pending`/`rejected` → the existing status copy + sign-out.
- `approved` → never rendered; `proxy.ts` redirects to `/dashboard` first.

Deep links to `/dashboard`, `/editor`, `/onboarding`, `/admin` are
unaffected by this — an anonymous request to one of those still goes to
`/login` (not `/early-access`), since a direct link to a specific product
surface is a reasonable case to just prompt a normal login. Only `/` itself
routes anonymous visitors through the apply page.

### Invite acceptance auto-approves

`db/invites.ts`, `acceptOrganizationInvite` — after the membership insert,
calls `approveViaInviteAccept()` (`db/access.ts`) unconditionally. Only an
already-approved org can send an invite, so a teammate accepting one is
joining a vetted workspace and shouldn't be stuck behind the same gate as a
stranger. No approved-email fires on this path — that email is reserved for
admin-driven approvals.

## `/early-access` page

`app/(auth)/early-access/page.tsx` — server component. `proxy.ts` already
guarantees a session exists and that `approved` users never reach it, so the
page reads `access_status` (`getEarlyAccessInfo()`) and renders:
- `pending` — "You're on the list", sets expectation that beta access opens
  gradually, no fake queue position.
- `rejected` — soft, non-final copy.

Also where the applied-email fires: on a `pending` render with
`waitlist_applied_email_sent_at` still null, `markWaitlistAppliedEmailSent()`
does a guarded UPDATE (`WHERE ... IS NULL`, so two concurrent loads can't
double-send), and only the request that actually flipped the flag sends the
email.

## Admin: users list + approve/reject

`app/api/admin/users/route.ts` (gated via `lib/admin.ts`'s `isAdmin()`,
extracted from `app/api/admin/infra/route.ts` so both routes share it):
- `GET` → `listUsersForAdmin()` — every user, joined to org name(s).
- `PATCH` → `{ userId, accessStatus }`. Fires `sendWaitlistApprovedEmail`
  only on a genuine transition into `'approved'` (checked via
  `getAccessStatus` before the update) — an idempotent re-PATCH to the same
  status doesn't resend it.

`components/admin/users-panel.tsx` — self-fetching client component, not
folded into `app/admin/page.tsx`'s existing `InfraPayload`/`load()` cycle,
so it refreshes independently without growing that already-large file's
state further. Status filter defaults to `pending`. Dropped into
`app/admin/page.tsx` above the existing "Platform" stats block.

## Emails

`lib/waitlist-emails.ts`, same plain inline-HTML style as
`lib/auth-emails.ts`, same `sendEmail()` transport:
- `sendWaitlistAppliedEmail(to, name)` — see above for when it fires.
- `sendWaitlistApprovedEmail(to, name)` — fired from the admin `PATCH`,
  links to `/login`.

Not built (unchanged from the original decision):
- No rejection email — silence, not a form-letter door-slam.
- No public waitlist counter or queue-position messaging — nothing in the
  system orders the queue, so either would be a fabricated number inside
  the product itself.

## Verification performed

- `npm run build` — clean, including the `proxy.ts` (Edge) bundle compiling
  successfully with the added `db/access.ts` import.
- Migration `0006_early_access.sql` applied to the real Neon database via
  `node scripts/backup-and-migrate-db.mjs` (backs up first — 16,878 rows
  across 19 tables backed up before this ran). Confirmed all 10 existing
  users, including CIBA's, backfilled to `approved`.
- End-to-end smoke test against the live DB with a throwaway account
  (created, exercised, then deleted): fresh signup → `access_status =
  'pending'` → `/dashboard`, `/onboarding`, `/editor` all redirect to
  `/early-access` → page renders "You're on the list" and sets
  `waitlist_applied_email_sent_at` exactly once → after flipping the
  account to `approved`, `/dashboard` correctly falls through to
  `/onboarding` (no org yet) and `/early-access` redirects away to
  `/dashboard`. `/api/admin/users` confirmed to 404 for both an
  unauthenticated caller and a signed-in non-admin.
