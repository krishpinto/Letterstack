# Campaign Flow Plan

Last updated: 2026-06-28

Purpose: planned product flow and `/dashboard/campaigns` UI direction before
implementation. Keep this short and revise as campaign UX decisions land.

## Editor route context

- Canonical editor route is now `/editor`.
- Historical `/editor-new` implementation was preserved and moved into
  `components/editor/editor-shell.tsx` as `EditorShell`.
- Old editor implementation (`components/editor/letterstack-editor.tsx`) has
  been deleted; it was never the active route and nothing imported it.
- `app/editor/page.tsx` renders `EditorBackLink` plus `EditorShell`.
- Only one editor component folder should remain: `components/editor/`.

## Current campaign model

- `/dashboard/campaigns` lists campaigns scoped to the active organization.
- `POST /api/campaigns` creates a draft campaign with compiled HTML/text
  snapshots from an `EmailDocument`.
- `/dashboard/campaigns/[id]` is the campaign send/checklist/monitor page.
- Campaign audience is stored in `campaign_recipients`, not inferred live from
  the organization Audience during send.
- `/editor` uses `STORAGE_KEY` from `lib/email/document.ts`; campaign/template
  entry points preload editor state into localStorage before navigation.

## Desired campaign flow

```text
/dashboard/campaigns
-> create draft campaign
-> choose blank/template/start point
-> open campaign detail or editor
-> edit design in /editor
-> return to campaign detail
-> manage campaign audience
-> send test
-> send campaign through QStash/SES
-> monitor progress and analytics
```

## `/dashboard/campaigns` UI direction

1. Campaign list remains organization-scoped and reacts to active organization
   changes via `letterstack:organization-changed`.
2. Create flow should feel like a campaign launcher, not a raw table action:
   - campaign name
   - template/blank selection
   - clear next action: open editor or continue to campaign checklist
3. Campaign rows should expose the campaign lifecycle:
   - Draft: edit design, manage audience, send test
   - Sending: progress/monitor
   - Sent: analytics/report
4. Bulk actions should stay secondary and not dominate first-time flow.
5. Empty state should guide to creating the first campaign and explain that
   audience can be copied from the organization Audience later.

## Implemented `/dashboard/campaigns` list refinements

- The canonical editor context remains `/editor`; campaign empty states still link to `/editor`.
- `/dashboard/campaigns` now keeps one primary `Campaigns` page heading and removes the repeated `Campaign list` card heading.
- The campaign list uses a bordered shadcn `Table` wrapper without the old outer card heading.
- Search remains visible. Status filtering moved into a shadcn `DropdownMenu` filter button with counts.
- Pagination is client-side over the filtered campaigns list, with selection scoped to the visible page.
- Bulk selected actions moved below the table/pagination area.
- Each campaign row has a three-dot shadcn `DropdownMenu` with open and destructive delete actions.
- The redundant `Send to` column was removed. Campaign status stays in its own column with short meanings: Draft = not sent yet, Sending = queued/in progress, Sent = completed.


## Implemented `/dashboard/campaigns/[id]` detail refinements

- Draft campaigns keep the send checklist and now use a larger preview column/iframe.
- Sending/sent campaigns keep the exact monitor stats: Recipients, Delivered, Opened (est unique), Clicked (est unique), Failed, and Bounced.
- Sending/sent campaigns now also show the same campaign setup steps via `app/dashboard/campaigns/[id]/campaign-steps.tsx`.
- The monitor preview is restored and larger, using the campaign `htmlSnapshot` passed from the detail route.

## Open decisions for the next pass

- Whether creating a campaign should navigate directly to `/editor` or first to
  `/dashboard/campaigns/[id]`.
- Whether templates should remain under `/dashboard/templates` or be embedded in
  the campaign create modal.

## Resolved Decisions

- **Direct Editor Saving**: `/editor/[id]` dynamic route implements direct campaign document database load/save (autosave & manual save via `PATCH /api/campaigns/[id]`) and redirects back to campaign details on exit.
- **Audience Categories**: Organization contacts can be grouped into custom category folders. Selected contacts can be added to multiple folders in bulk, and the audience table can be dynamically filtered by clicking on folder cards. Added `categories` and `recipient_categories` schema changes.






