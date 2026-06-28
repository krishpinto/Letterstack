# UI And Theming

LetterStack uses Next.js App Router, Tailwind CSS, shadcn/ui, and theme tokens.

## Theme Intent

- `/` hero route should stay light.
- Dashboard and app routes should stay dark.
- Marketing routes can use the configured marketing layout/theme.
- Dashboard should feel like a calm SaaS control room, not a landing page.

## Dashboard Layout

- `app/dashboard/layout.tsx` is the server gate.
- `components/dashboard-shell.tsx` owns sidebar/header composition.
- `components/app-sidebar.tsx` receives organization and user data as props.

## Sidebar

Sidebar should use shadcn sidebar tokens:

- `bg-sidebar`
- `text-sidebar-foreground`
- `border-sidebar-border`
- `bg-sidebar-primary`
- `text-sidebar-primary-foreground`

The requested sidebar background is represented in CSS by the sidebar token
using `lab(15 0.01 0)`.

## Component Rules

- Use shadcn primitives first.
- Do not edit `components/ui/*` unless regenerating/updating shadcn components.
- Prefer token classes like `bg-background`, `text-foreground`, `border-border`.
- Avoid hardcoded colors in app components unless a brand asset requires it.

## Audience UI

The draft campaign send page owns the recipient add/import controls.
Avoid sending users to a global audience page for the current campaign flow.
