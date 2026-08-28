# LetterStack — Root Context

> Root constitution. Keep this file lean. Detail for a module belongs in that
> module's own CLAUDE.md once the module has real code (see "Context file
> policy" at the bottom), or in `context/` for cross-cutting plans. This file
> describes a live, running product — check `context/` and the code itself
> before trusting a stale line here.

---

## What LetterStack Is

Email campaign platform for organizations that send recurring newsletters.
Block-based canvas editor → email-safe HTML → sent via Amazon SES from the
client's own domain. Positioning: real responsive HTML, no Gmail clipping,
no image-flattening, SES pricing, no lock-in.

**We are not building "a better Mailchimp."** We started by building the
right tool for a CIBA-shaped user: sends ~3,000 emails once a month, was
exporting flat Canva images because their existing editor was unusable. CIBA
is now a live beta user sending real campaigns through LetterStack.

**Out of scope entirely:** lead-gen scraping (never planned, not revisited),
billing/payments, per-client custom domains.

**In scope now:** public self-serve signup, open. Signing up or logging in
puts you straight into the product — there is no waitlist and no approval
step. The early-access gate that used to sit here was removed; its columns
survive unused in `users` (see `db/schema.ts`) because dropping them needed
a migration the removal didn't otherwise require.

**Plans:** four tiers — Free, Starter, Growth, Business — defined once in
`lib/plans/limits.ts`, which is the only place their numbers, prices, and
copy live. Enforcement (send allowance, contact ceiling, domains, workspaces)
and the public pricing page both read that table, so they cannot drift.
Starter's stored plan key is still `pro`, for the live rows and settled
payments that already carry it.

Every new workspace starts on Free. A paid tier comes from buying it
(`lib/payments/settle.ts`, priced in `lib/payments/catalog.ts`) or from a
deliberate admin grant in the `/admin` subscriptions panel. Nothing hands out
a free period at signup. **Business is deliberately not self-serve** — it has
no catalog entry and routes to the contact form, because above Growth one
sender importing a bought list can push the whole SES account past its
bounce/complaint thresholds and take everyone else's sending down with it.

---

## North Star Milestone

**Public beta: open signup live, a first cohort of real orgs signing
themselves up and sending real campaigns.**

The original north star — one real CIBA campaign sent through LetterStack —
is done. Every task is now sequenced backwards from getting additional real
orgs onto the platform and sending. If a task doesn't serve that, it doesn't
get built yet.

---

## Phase Tracker (update as milestones complete)

### Phase 0 — Setup ✅
- [x] Repo scaffolded (Next.js, TypeScript, Tailwind, shadcn/ui)
- [x] Neon Postgres provisioned, Drizzle configured, migrations ongoing
- [x] SES sending live (CIBA sends real campaigns through it)

### Phase 1 — Editor core + send path ✅
- [x] `EmailDocument` schema + compiler (`lib/email/`)
- [x] Canvas editor: block list, selection, inspector panel, global settings,
      live preview
- [x] Backend: campaigns, recipients, email_events, suppressed_emails tables
- [x] Auth: full NextAuth (credentials + Google OAuth), organizations,
      organization_members, invites — well beyond the original "hardcoded
      login" placeholder
- [x] Trigger endpoint → QStash fan-out → batched workers, idempotent sends
- [x] SES configuration set + SNS → webhook endpoint, suppression wired in

### Phase 2 — First real send ✅
- [x] Import wizard (SheetJS + PapaParse)
- [x] Campaign status view
- [x] Pre-send validation
- [x] **CIBA sending real campaigns through LetterStack** ← milestone achieved

### Phase 3 — Harden + polish (ongoing)
- [x] Analytics (SES events → `email_events` → dashboard)
- [x] Image uploads (UploadThing, not Vercel Blob — see Tech Stack)
- [x] Agentic AI editor panel (Lexical + AI SDK + Gemini, block-scoped tools,
      per-model quota metering) — went further than the original "inline
      TipTap editing" plan
- [ ] dnd-kit drag-and-drop block reordering (still arrow-button only)
- [ ] Fix whatever the next real sends expose

### Phase 4 — Public beta / open signup (current focus) ⬜
- [x] Early-access waitlist built, then removed — signup now grants access
      outright. The gate, its holding page, its admin approve/reject panel
      and its two transactional emails are all gone; `users.access_status`
      and friends remain as unused columns.
- [x] Free Pro period at signup removed — new workspaces start on Free, and
      the trial-grant ledger that policed one-free-period-per-person went
      with it. Pro is paid or admin-granted only.
- [ ] Marketing push publishing the beta story — content lives outside this
      repo, not planned here

---

## Repo Structure — Modular Monolith (one repo, hard module boundaries)

```
letterstack/
  app/              → pages + API routes (editor UI, trigger, workers, webhook, dashboard)
  components/editor/→ editor UI, split by concern (see Editor Rules)
  lib/email/        → document.ts, compiler.ts — the shared core
  lib/send/         → batching, SES/Resend transport, idempotency
  lib/import/       → file parsing, header mapping, validation, dedupe
  lib/analytics/    → SES event parsing, suppression management
  db/               → Drizzle schema, migrations
```

**Boundary rules (treat as lint):**
- `lib/*` modules never import from `app/` or `components/`
- Nothing imports editor UI code except editor pages
- `lib/email/` is the only module both editor and send path share

**Do not split into multiple repos.** Editor and send path share the
EmailDocument schema and compiler; separate repos = shared-package versioning
overhead for a team of one. Clean module boundaries keep a future extraction
cheap if ever genuinely needed.

---

## Architecture Non-Negotiables

1. **Canvas is the only editing surface.** Never build a second parallel
   editor (rich-text "Write tab" or similar) producing email content —
   dual-state sync between two editors is a known catastrophic bug source.
   (TipTap *inside* canvas blocks for inline editing is allowed in Phase 3:
   one instance per text block, reads/writes EmailDocument, owns nothing.)
2. **One canonical state.** `EmailDocument` in React state is the single
   source of truth. Editor writes in, compiler reads out.
3. **Compiler is the only HTML path.** `compileEmailDocument()` produces all
   preview and send HTML. No other HTML generation, ever.
4. **Global settings stay global** — colors, fonts, max width, button styles
   live in `document.settings`, edited only in the global settings sheet.
5. **Images are external URLs.** Never base64, never screenshots.
6. **Freeze a snapshot at send time.** `html_snapshot` on the campaign is
   what gets sent and what stays on record. Never send from live state.
7. **Email-safe HTML only.** Tables + inline styles. No flexbox, grid,
   absolute positioning, or CSS variables in compiled output.

---

## Editor Rules

- **No monolith components.** Each editor concern is its own file from day
  one: canvas, block preview, inspector, settings sheet, preview frame.
  Any component approaching ~300 lines gets split before it grows further.
- Block reordering ships with arrow buttons first; dnd-kit is Phase 3.
- Block editing happens via the inspector panel first; inline editing is
  Phase 3.

---

## Send Rules

- **Pattern:** trigger endpoint freezes snapshot → QStash fan-out → batched workers
- **Batch math:** 50 emails/batch, 4s stagger, derived from SES 14/sec rate
  limit. 3,000 emails = 60 batches ≈ 4 min. Resend fallback: same pattern,
  12s stagger (lower rate limit — same formula, different input).
- **Idempotency is mandatory:** every worker sends only to recipients in its
  batch NOT already marked `sent` for this campaign. QStash retries must be
  safe. No send code ships without this check.
- **Suppression is global:** one `suppressed_emails` table checked by every
  campaign's send path AND every list import. Hard bounces and complaints go
  in automatically via webhook.
- **Webhooks are not optional:** SES suspends at >10% bounce / >0.5%
  complaint. The events webhook is reputation survival, not a feature.

---

## Analytics Rules

- Delivery/bounce/complaint/open/click all arrive through ONE pipeline:
  SES configuration set → SNS → webhook endpoint → `email_events` table.
- Use SES built-in open/click tracking for v1 (custom tracking domain so
  links show our domain, not Amazon's). Self-built pixel only if a real
  limitation appears.
- Dashboard = aggregation queries over `email_events`. No separate analytics
  service, no middleware layer.
- Delivered/bounced are hard numbers; opens are estimates (privacy clients
  block/pre-fetch pixels). The dashboard should not present them as equally
  reliable.

---

## Import Rules

- Wizard flow: upload (CSV/XLSX) → auto-map headers with manual fix-up →
  validate syntax → dedupe within list AND against suppression →
  summary ("412 imported, 3 duplicates, 2 invalid") → commit.
- Parsers: SheetJS for Excel, PapaParse for CSV. Client files WILL be messy —
  fuzzy header matching (email / e-mail / EMAIL ID / Mail), skip blank rows.
- For CIBA's first send only: seeding the recipients table manually is
  acceptable. The wizard is Phase 2.

---

## Tech Stack

| Layer | Tech |
|---|---|
| Framework | Next.js 15 App Router + React 19 + TypeScript 5 |
| Styling | Tailwind CSS 4 + shadcn/ui |
| Icons | HugeIcons |
| Database | Neon Postgres + Drizzle ORM |
| Queue | Upstash QStash |
| Email | Amazon SES via AWS SDK v3 (SESv2), ap-south-1 (fallback: Resend) |
| Files/parsing | SheetJS (xlsx), PapaParse (csv) |
| Image CDN | UploadThing |
| Auth | NextAuth: credentials (bcrypt) + Google OAuth |
| Hosting | Vercel |

---

## Frontend Design System

- **Headings:** Syne. **Body/UI:** DM Sans. Load via next/font only.
- **Palette:** dark base, coral/purple/sage accents. All tokens in
  tailwind.config + globals.css — never hardcode hex.
- **Component order:** shadcn/ui → Radix primitive → custom (last resort,
  with a comment explaining why).
- No inline `style={{}}`, no px font sizes, never edit `components/ui/*`
  (extend via className only).

---

## Adding a Block Type (recipe)

1. Type in `lib/email/document.ts`, add to `EmailBlock` union
2. `createBlock` case in document.ts
3. `renderBlock` case in `lib/email/compiler.ts`
4. `blockToText` case in compiler.ts
5. Canvas rendering in the block preview component
6. Inspector fields in the inspector component

---

## Context File Policy

- This root file stays lean. When a module's detail starts crowding it,
  move that section into `lib/<module>/CLAUDE.md` and leave one line here
  pointing to it.
- Planned scoped files (create only when the module has real code):
  `lib/email/CLAUDE.md`, `lib/send/CLAUDE.md`, `lib/import/CLAUDE.md`
- Update the Phase Tracker checkboxes as work completes. A stale plan in a
  context file is worse than no plan.
