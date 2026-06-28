# Agent Instructions

This repo uses `codebase-memory-mcp` for graph-backed code discovery. Prefer MCP
graph tools before broad grep/file search when finding code definitions,
routes, helpers, or relationships.

## Context Pack

The `context/` folder contains curated markdown notes for fast recall. Treat it
as the human-readable companion to the code graph.

When changing architecture, database shape, major user flows, send/analytics
behavior, auth, or theming:

1. Update the relevant `context/*.md` file in the same change.
2. Keep notes short, factual, and searchable.
3. Include exact route/table/function names when useful.
4. Re-index with `codebase-memory-mcp` after meaningful context changes.

Current high-value context files:

- `context/current-architecture.md`
- `context/data-model.md`
- `context/user-flow.md`
- `context/send-analytics.md`
- `context/ui-theming.md`
- `context/production-migration.md`
