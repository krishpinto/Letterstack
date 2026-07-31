# User Flow

This file captures the intended product flow.

## First-Time User

```text
signup/login
-> onboarding
-> create first organization
-> dashboard
```

**Early-access gate** (`context/early-access-plan.md`): `users.access_status`
is checked centrally in `proxy.ts` (Next.js's middleware, renamed from
`middleware.ts` as of Next.js 16). `/early-access` is the front door during
the invite-only beta — reachable with no session, doubling as the "apply"
landing page for anonymous visitors and the pending/rejected status page
for signed-in non-approved accounts —

```text
anonymous "/" -> /early-access ("Apply for early access" + signup/login CTAs)
signup/login
-> pending?  -> /early-access (status page, no dashboard/editor/onboarding/"/" access)
-> approved? -> onboarding (if no org yet) -> dashboard, "/", everything opens
```

`/` sends every non-approved visitor — anonymous included — to
`/early-access`; there is no marketing site to browse during the beta.
`/dashboard`, `/editor`, `/onboarding`, `/admin` are unaffected by that
specific redirect: an anonymous request to one of those still goes to
`/login` as a plain deep link would, not to `/early-access`. Existing
accounts (including CIBA's) were backfilled to `approved` in migration
`0006_early_access.sql`, so nothing changed for anyone already using
LetterStack. New signups default to `pending` until an admin approves them
from `/admin` (`components/admin/users-panel.tsx`,
`app/api/admin/users/route.ts`). Teammates invited into an already-approved
org are auto-approved on invite accept (`db/invites.ts`,
`acceptOrganizationInvite`) — only fresh, unaffiliated signups actually wait.

Onboarding creates an organization with:

- organization name
- organization type: `personal` or `business`

The endpoint is `POST /api/organizations`.

## Returning User

```text
login
-> /dashboard
```

`app/dashboard/layout.tsx` checks the session and loads the active organization
from the `letterstack_active_organization_id` cookie. If that cookie is missing
or invalid, it falls back to the user's first/default organization. Users without
any organization are redirected to `/onboarding`.

## Organization Switching

The organization dropdown in `components/app-sidebar.tsx` receives all user
organizations from `app/dashboard/layout.tsx` and keeps a local optimistic
copy for fast create/switch UI. After successful create/switch, it dispatches the
letterstack:organization-changed browser event so client-fetched dashboard
pages refetch their organization-scoped data immediately.

- `GET /api/organizations` returns the active organization plus the full org list.
- `POST /api/organizations` creates a new organization/member row, sets the new
  organization as active, and returns the updated list.
- `PATCH /api/organizations` verifies membership and stores the selected org in
  the HttpOnly `letterstack_active_organization_id` cookie.

Dashboard API helpers use `currentOrganizationId()`, which reads the active-org
cookie and falls back safely to the first/default org.

## Organization Audience

```text
/dashboard/audience
-> add a contact or import CSV/Excel
-> contacts are stored for the current organization
-> organization suppression rules are shown in the same audience
```

Important endpoints:

- `GET /api/audience`
- `POST /api/audience`
- `DELETE /api/audience?id=...`
- `POST /api/audience/import`
- `GET|POST /api/audience/suppression`

## Campaign Flow

```text
/dashboard/campaigns
-> create campaign
-> design/edit content
-> copy the organization Audience, add individual recipients, or import a file
-> campaign_recipients stores the campaign snapshot
-> send test
-> send campaign
-> monitor progress
-> analytics
```

The organization Audience is reusable. Each campaign still owns an independent
recipient snapshot in `campaign_recipients`, so changing the organization
Audience does not silently change an already prepared or sent campaign.

Campaign detail/update/delete helpers validate access through
`organization_members` rather than only the first/default organization, so users
can open campaigns from any organization they belong to.

## Important Routes

- `/`: light hero page. Gated — see the early-access section above; only
  `approved` sessions reach it.
- `/login`, `/signup`, `/onboarding`: auth and setup.
- `/dashboard`: organization-scoped dashboard.
- `/dashboard/audience`: organization Audience list and CSV/Excel import.
- `/dashboard/campaigns`: campaign list/create.
- `/dashboard/campaigns/[id]`: draft send checklist or campaign monitor.
- `/editor`: editor used for campaign design. Canonical editor route; former
  `/editor-new` was consolidated here without deleting editor component code.
- `/dashboard/analytics`: campaign analytics from SES events.
- `/dashboard/domains`: sender identity/domain UI.

`/dashboard/contacts` remains as a compatibility alias for the Audience page.