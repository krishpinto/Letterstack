# Dashboard V2

New Plane-style dashboard shell, originally prototyped at `/dashboard-v2`.

> **Integrated 2026-07-06**: the shell now runs the real `/dashboard` routes
> (auth + org data wired in `app/dashboard/layout.tsx`, nav re-pointed to
> `/dashboard/*`, org switcher and recent-campaigns list use the live APIs,
> settings lives at `/dashboard/settings`). Paths below refer to the original
> prototype. The `components/dashboard-v2/*` overview cards are not wired yet.

Last updated: **2026-07-06**

---

## Routes

| URL | Description |
|---|---|
| `/dashboard-v2` | Overview stub (placeholder stat cards) |
| `/dashboard-v2/campaigns` | Campaigns (stub) |
| `/dashboard-v2/audience` | Audience (stub) |
| `/dashboard-v2/templates` | Templates (stub) |
| `/dashboard-v2/analytics` | Analytics (stub) |
| `/dashboard-v2/domains` | Domains (stub) |
| `/dashboard-v2/settings` | Settings — full two-panel UI, special shell mode |

---

## Layout Architecture

```
┌──────────────────────────────────────────────────────┐
│  TopNavbar  (full width, h-12)                       │
│  org dropdown | search ⌘K | bell | help | avatar     │
├──────────────────────────────────────────────────────┤
│ px-2 pb-2                                            │
│ ┌─────┐ ┌──────────────────────────────────────────┐ │
│ │Rail │ │ NavSidebar │ Content col  │ RightSidebar │ │
│ │w-11 │ │ w-52       │ flex-1       │ w-56         │ │
│ │     │ │            │ ContentHeader│ (toggleable) │ │
│ │icons│ │ (toggleable│ h-10         │              │ │
│ │     │ │ via ⊞ btn) │──────────────│              │ │
│ │     │ │            │ {children}   │              │ │
│ │     │ │            │ overflow-auto│              │ │
│ └─────┘ └──────────────────────────────────────────┘ │
│ rounded-xl border bg-muted/30                        │
└──────────────────────────────────────────────────────┘
```

### Settings route exception

On `/dashboard-v2/settings`, the shell hides:
- Left nav sidebar
- Content sub-header
- Right filter sidebar

Icon rail and top navbar remain. The settings page fills the full content column with its own internal two-panel layout (settings nav + panel).

---

## Component Map

All shell components live in `components/protected-shell/`.

### `shell.tsx`
- Root layout wrapper (`ProtectedShell`)
- Client component — owns `navOpen` and `rightOpen` state
- Reads `usePathname()` to detect `isSettings`
- Props: `orgName`, `userName`, `userEmail`, `headerActions`
- No auth — placeholder props only for now

### `top-navbar.tsx`
- Full-width top bar, `h-12`
- Left: org name + avatar dropdown (switch/create workspace)
- Center: search `Input` with ⌘K kbd hint
- Right: "Get started" outline button, bell, help, user avatar dropdown

### `icon-rail.tsx`
- Narrow `w-11` column, floats in the left gutter **outside** the main bordered container
- Has its own `rounded-xl border bg-sidebar` styling (user has customised this)
- Logo mark `LS` at top linking to `/dashboard-v2`
- Primary nav icons with `TooltipProvider` (right-side tooltips):
  - Campaigns (`SendIcon`)
  - Audience (`UsersIcon`)
  - Templates (`LayoutTemplateIcon`)
  - Analytics (`BarChart3Icon`)
  - Domains (`GlobeIcon`)
- `<Separator />` then bottom nav:
  - Settings (`SettingsIcon`) → `/dashboard-v2/settings`
- Active state: `bg-sidebar-accent text-sidebar-accent-foreground`

### `nav-sidebar.tsx`
- Secondary left sidebar, `w-52`, `bg-background`
- Panel header `h-10` with title + `+` / `⋯` buttons
- "New campaign" dashed-border quick-add button
- Primary nav links (Overview, Campaigns, Audience, Templates, Analytics, Domains)
- Collapsible "Workspace" section
- Collapsible "Recent" section with placeholder campaign list
- Toggled by the `⊞ PanelLeft` button in `ContentHeader`

### `content-header.tsx`
- Sub-header inside the content column, `h-10`, `bg-muted`
- Left: `PanelLeft` toggle button + separator + page breadcrumb (emoji + title)
- Right: search icon, Filters button, page-level `actions` slot, separator, `PanelRight` toggle
- Page titles derived from `usePathname()` via `PAGE_METADATA` map
- Hidden entirely on the settings route

### `right-sidebar.tsx`
- Filter panel, `w-56`, `bg-card`
- Header `h-10` with filter count badge + close `X` button
- Filter sections: Status, Date, Labels, Sender
- Each section uses `FilterChip` buttons with active state
- Footer: "Clear all filters" button
- Toggled by the `⊟ PanelRight` button in `ContentHeader`

---

## Settings Page (`app/dashboard-v2/settings/page.tsx`)

Self-contained two-panel layout — no shell sidebars:

```
┌──────────────────────────────────────────────┐
│ Settings nav (w-52) │ Panel content (flex-1) │
│ bg-background       │                        │
│ h-10 header         │ h-10 section header    │
│─────────────────────│────────────────────────│
│ Account             │ (active panel body)    │
│ Organization        │                        │
│ Sending             │                        │
│ Domains             │                        │
│ Notifications       │                        │
│ Appearance          │                        │
│ Security            │                        │
│ API & Integrations  │                        │
│ Billing & Plans 🏷  │                        │
└──────────────────────────────────────────────┘
```

Implemented panels: **Account**, **Organization**, **Notifications**
Placeholder panels: Sending, Domains, Appearance, Security, API, Billing

State managed locally via `useState(activeSection)`.

---

## Color Tokens Used

| Element | Token |
|---|---|
| Outer body bg | *(user-defined, do not touch)* |
| Icon rail | `bg-sidebar` + `border-sidebar-border` |
| Main container | `bg-muted/30` + `border-border` |
| Left nav sidebar | `bg-background` |
| Content column | `bg-muted/20` |
| Content header | `bg-muted` |
| Right sidebar | `bg-card` |
| Settings nav | `bg-background` |

---

## Key Design Decisions

- Icon rail sits **outside** the rounded main container in the `px-2 pb-2` gutter — visually floats independently.
- Both sidebars are independently toggleable; state lives in `ProtectedShell`.
- Settings route completely bypasses the secondary sidebars and content header by checking `isSettings` in `shell.tsx` — no layout component edits needed.
- No auth in `app/dashboard-v2/layout.tsx` — stub props only. Wire up using same pattern as `app/dashboard/layout.tsx` when ready.
- All shell components use `size="xs"` / `size="icon-xs"` button variants.
- `hideToggles` prop was considered but removed — routing-based detection in shell is cleaner.

---

## TODO (backend wiring)

- Replace `app/dashboard-v2/layout.tsx` stub props with real session + org data (same pattern as `app/dashboard/layout.tsx`)
- Replace placeholder campaign list in `nav-sidebar.tsx` with `GET /api/campaigns`
- Wire stat cards in `app/dashboard-v2/page.tsx` to real API endpoints
- Settings panels: connect Account to `PUT /api/account`, Organization to `PATCH /api/organizations`, Notifications TBD
- Add real sub-routes: `/campaigns`, `/audience`, `/templates`, `/analytics`, `/domains`
