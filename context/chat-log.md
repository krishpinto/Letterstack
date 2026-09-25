# Chat Log

Last updated: 2026-06-28

Purpose: compact, human-readable breadcrumbs for this active Codex thread so
work can continue cleanly if conversation context is compacted.

## Current working agreement

- Fix LetterStack incrementally, one requested issue at a time.
- Keep `context/` updated when architecture, database shape, mail behavior,
  auth, major user flows, or UI shell behavior changes.
- Re-index the codebase-memory graph after meaningful context/code changes.

## Recent decisions

- `@opencoredev/email-sdk` was installed for review, but is not needed right
  now. The current SES + QStash campaign system remains the preferred path
  because QStash controls send pacing and SES is the actual provider.
- The dashboard sidebar organization dropdown should show all organizations,
  create organizations through a DB-backed modal, and switch the active org.

## Current task status

- `components/app-sidebar.tsx` lists all organizations passed from the dashboard
  layout and calls `PATCH /api/organizations` to switch.
- `POST /api/organizations` creates a new organization/member row, sets the new
  org as active, and the modal closes automatically on success.
- Active organization selection is stored in the HttpOnly
  `letterstack_active_organization_id` cookie.
- `currentOrganizationId()` reads the active cookie, so dashboard API routes that
  use it scope data to the selected organization.
- Campaign detail helpers now validate access through `organization_members`, so
  campaigns in non-default organizations do not 404 just because they are not in
  the first organization.
## Sidebar performance note

- The organization dropdown now keeps `activeOrganization` and
  `localOrganizations` in optimistic local React state.
- Creating or switching organizations updates the sidebar immediately; the
  cookie-backed `router.refresh()` runs afterward in a React transition so the
  rest of the dashboard can catch up without making the dropdown feel stuck.
## Organization switch data refresh

- `lib/dashboard-events.ts` defines a `letterstack:organization-changed` browser event.
- The sidebar dispatches it after `POST`/`PATCH /api/organizations` succeeds and the active-org cookie has been set.
- Dashboard client pages that fetch their own data subscribe to it:
  - `app/dashboard/campaigns/page.tsx` refetches `/api/campaigns`.
  - `app/dashboard/contacts/page.tsx` refetches audience and suppression data.
  - `app/dashboard/analytics/page.tsx` refetches `/api/analytics`.
- This fixes the case where the sidebar state changed instantly but `/dashboard/campaigns` kept showing the old org's campaign list.
## Editor route consolidation

- `/editor` is now the canonical editor route.
- Former `/editor-new` shell was preserved as `components/editor/editor-shell.tsx`.
- `components/editor-new/` and `app/editor-new/` were removed after moving code.
- Old `LetterStackEditor` code was kept at `components/editor/letterstack-editor.tsx` for reference, then deleted once nothing imported it — git history is the reference copy.
- Campaign flow planning is tracked in `context/campaign-flow-plan.md`.

## Campaign Detail Page Remake & Layout Polish

- **Unified Campaign Detail View**: Replaced branched rendering inside `/dashboard/campaigns/[id]/page.tsx` with a single, unified `<CampaignDetail />` component that handles all statuses (draft, sending, sent).
- **Stepped Send Checklist**: Remade the checklist layout to match the requested progress design. Added an 18-segmented vertical-pill progress bar in CardHeader (green when completed, dark gray when pending).
- **Dynamic Step States**:
  - Done: Solid green circle (`bg-emerald-500`) with a dark bold checkmark.
  - Active: Solid white circle (`bg-white`) with a bold black number.
  - Pending: Dark gray circle (`bg-zinc-800`) with muted border and number.
  - Accordion highlighting: Implemented custom background shading (`bg-muted/40`) for active step accordion panels.
- **Header Alignment & Polish**:
  - Replaced the main header with a compact, single-row design.
  - Aligned page content with the top header breadcrumb and sidebar trigger by changing layout padding in `components/dashboard-shell.tsx` from `p-4 md:p-6` to `p-4 md:px-4 md:py-6` (removing horizontal padding offsets).
- **Empty-Save Validation**: Removed trimmer validation constraints from `SaveCancel` components. Erasing From/Subject inputs and hitting Save updates the DB to empty, which successfully recalculates the step indicators to **incomplete** dynamically. Updated `PUT /api/account/sending` to allow empty subdomain slugs.
- **Dedicated Analytics Page**: Moved the metrics grid, delivery progress bars, and recipient outcome filters to a dedicated `/dashboard/campaigns/analytics/[id]/page.tsx` route, linked from a "View Analytics" action button.
- **Preview Improvements**:
  - Placed a mock email client header above the HTML preview.
  - Set viewport-adaptive heights (`h-[calc(100vh-280px)] min-h-[480px]`) to confine vertical scrolls within the HTML portion.
  - Added `sandbox="allow-same-origin"` to strictly block link redirects and script execution.
- **Dynamic Database Editor**: Created a client-rendered route at `/editor/[id]` that fetches the template JSON from `/api/campaigns/[id]` on mount and saves progress back to the database via `PATCH` on manual/autosaves. Extends `EditorShell` with customizable loading, saving, and exit handlers.

## Audience Folders (Categories) Implementation

- **Additive DB Schema**: Appended `categories` and `recipient_categories` tables to `db/schema.ts`, avoiding any changes to existing `recipients` rows for full backwards-compatibility. Sync'ed DDL tables structure directly to the production Neon instance.
- **CRUD Categories API**: Created `app/api/audience/categories/route.ts` implementing `GET` (fetch folders and mappings), `POST` (create categories and associate recipient mappings), `PATCH` (rename categories), and `DELETE` (cascade-delete folders).
- **Restructured Audience Table Layout**: Remade the table layout on `app/dashboard/contacts/page.tsx` to match the borderless campaigns table, placing filter controls (search input and status filter dropdown menu showing counts) in a single row, wrapping the table in a scrollable `overflow-auto max-h-[450px]` container, and rendering a page size of `8` with showing ranges and standard pagination controls. Placed selection alert bar at the very bottom (below pagination).
- **Category Folder Grid**: Implemented compact category folder cards at the top of the audience page showing the top 3 categories (sorted by creation date descending) with colored icons and contact counts. Swapped padding size (`p-3` instead of `p-4`) and folder icons (`size-9` container, `size-4.5` icon) to keep layout clean and tight. Added a dashed quick-add "+ New folder" card (height `h-[62px]`).
- **Folders Right Sidebar (Sheet)**: Integrates a slide-out sidebar to view all folders, edit folder names inline, and delete folders. Added `p-6` padding to the `SheetContent` sidebar container for clean spacing.
- **Bulk Folder Association & Filtering**:
  - Selecting contacts exposes an "Add to folders" button that opens a dialog.
  - Implemented a shadcn Multiple Combobox (using Popover + Command) that displays selected categories as individual `<Badge>` tags inside the button trigger, supports a search input to filter folders instantly, and pre-populates with existing folders the selected contacts belong to.
  - Updated the API to delete old mappings and save only the new mappings when categories are deselected.
  - Clicking on folder cards dynamically filters the audience table to only display matching recipients, with clean active filter badges.
  - Added a "Folders" column to the audience table showing folder name tags for each contact.

## Templates Page Redesign & HTML Importer

- **Layout Restructuring**: Refactored `app/dashboard/templates/page.tsx` categories list into a desktop-sidebar button list with count badges and a mobile-scrollable badge row.
- **Card Interactive Polish**: Added hover-activated glassmorphic overlays onto prebuilt template thumbnail grids with scale transforms and clear CTA buttons.
- **Drag-and-Drop HTML Upload**: Added a drag-and-drop zone inside the "Import HTML" dialog to easily parse `.html` or `.txt` templates, automatically transitioning to a code editing/review panel upon upload.
- **Draft Card Removal**: Removed the browser local storage draft card entirely from the templates page. The Saved tab now displays exclusively custom templates fetched from the database, preventing design confusion.

## Custom Email Templates & Editor JSON Actions

- **Templates Table Schema**: Appended `email_templates` table in `db/schema.ts` referencing `organizations.id` and containing metadata columns as well as a `document` JSONB column. Executed the corresponding DDL on the live database.
- **Templates CRUD API**: Created `/api/templates` and `/api/templates/[id]` routes for getting, creating, patching, and deleting organization-level email templates.
- **Templates Gallery Integration**: Updated the "Saved" tab on `/dashboard/templates` to query the database, display silhouette thumbnail grids, and allow editing or deleting custom templates.
- **Mode-based Bottom Dock**: Added a `mode` prop to the editor shell. In `template-creator` mode (general `/editor` route), the bottom dock replaces the standard save button with "Save as template". This prompts for a template name and saves to the database.
- **Copy/Paste JSON actions**: Added a 3-dots actions menu to the editor's bottom dock. This features "Copy JSON" (exports the template state to the clipboard) and "Paste JSON" (opens a dialog to import any valid layout JSON directly onto the canvas).
- **Template Editor Route**: Implemented `/editor/template/[id]` to fetch a saved template's document, load it in the editor in `template-editor` mode, and update it on save.