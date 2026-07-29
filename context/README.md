# LetterStack Context Pack

This folder is a small searchable knowledge pack for Codex and
codebase-memory-mcp. It summarizes the parts of the system that are expensive
to rediscover from code every turn.

Last reconciled with the working tree: **2026-06-23**.

## Source Of Truth

Use this order when documents disagree:

1. Current code and database migrations.
2. Files in `context/`.
3. Historical handoff documents such as `HANDOFF.md`.

The historical engineering handoff is useful background, but it predates the
organization-first and campaign-owned audience model. Check this folder and the
current code before relying on its table count, ownership model, or route list.

Keep this folder updated when the product model changes. The files are meant to
be indexed with the rest of the repository so graph search can find terms like
`organization onboarding`, `campaign audience`, `bounce rate`, `QStash worker`,
or `dashboard theming` quickly.

## Files

- `current-architecture.md`: project shape and important module boundaries.
- `data-model.md`: database tables and relationships.
- `user-flow.md`: intended product flow and route map.
- `campaign-flow-plan.md`: planned campaign list/create/editor flow.
- `mail-system.md`: canonical current send/event/unsubscribe file map.
- `gmail-sending-plan.md`: proposed Gmail-mailbox sending + Senders module (not built).
- `agentic-editor-plan.md`: proposed AI agent panel in the editor (not built).
- `chat-log.md`: running thread breadcrumbs for compaction recovery.
- `send-analytics.md`: sending, suppression, SES events, bounce/complaint logic.
- `ui-theming.md`: theme/layout rules for hero, marketing, and dashboard.
- `production-migration.md`: production DB migration notes and deployment order.

## Maintenance Rule

If a change modifies database schema, auth/onboarding, campaign creation,
audience behavior, send behavior, analytics, or theming, update the matching
context file and re-index codebase-memory.

When mail-system files or folders move, update `mail-system.md` in the same
change. Keep exact route and function names so future agents can jump directly
to the implementation.

