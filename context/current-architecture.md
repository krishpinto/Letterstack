# Current Architecture

LetterStack is a Next.js App Router app for building and sending recurring
email campaigns.

Last reconciled with the working tree: **2026-06-28**.

## Major Layers

- `app/`: pages, layouts, and API route handlers.
- `components/`: dashboard shell, app sidebar, editor UI, marketing UI, shadcn UI.
- `db/`: Drizzle schema and data access helpers.
- `lib/email/`: canonical email document schema, compiler, templates, unsubscribe tokens.
- `lib/send/`: SES sending, QStash publishing, campaign send orchestration.
- `context/`: curated searchable project notes.

## Core Principles

- `EmailDocument` is the canonical editor state.
- `compileEmailDocument()` is the only HTML generation path for sends.
- `campaigns.html_snapshot` and `campaigns.text_snapshot` are the frozen send record.
- Dashboard data must be scoped through the user's organization.
- `recipients` is the reusable organization Audience library.
- `campaign_recipients` is the frozen audience for one campaign.
- `context/mail-system.md` is the canonical current-code map for mailing.

## Important Runtime Flows

- Auth uses NextAuth credentials in `lib/auth.ts`.
- `app/dashboard/layout.tsx` is a server gate:
  - no session redirects to `/login`
  - no organization redirects to `/onboarding`
  - valid user/org renders `components/dashboard-shell.tsx`
- `components/app-sidebar.tsx` receives organization/user data from the server layout.
- `/dashboard/audience` uses the existing CSV/Excel import wizard and production
  `/api/audience/*` routes.
- Draft campaigns can copy organization contacts through
  `/api/campaigns/[id]/recipients/from-audience`.

## Compatibility Areas

`/dashboard/contacts`, `/api/lab/recipients`, `/api/lab/suppression`, and
`/api/recipients/import` remain compatibility aliases, but they now use the same
organization-scoped Audience implementation.