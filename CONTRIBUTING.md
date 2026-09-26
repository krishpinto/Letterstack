# Contributing

Thanks for taking a look. Issues and pull requests are both welcome.

## Reporting a bug

Open an issue with what you did, what you expected, and what happened. If it
involves a send, include the campaign's sender type (shared domain, own domain
or Gmail) and roughly how many recipients — delivery bugs are usually specific
to one path.

Please don't include real subscriber addresses in an issue.

## Development setup

See [Getting started](README.md#getting-started) in the README. You need
Postgres and a QStash token to run the app; SES credentials only matter if you
want to send.

## Before opening a pull request

```bash
npm run typecheck
npm run lint
```

Both run in CI on every pull request. Lint fails on errors; warnings are fine.

## Conventions

- **The compiler is the only path to HTML.** `compileEmailDocument()` produces
  every byte of preview and send markup. Adding a second HTML path will be
  rejected.
- **Email-safe output only.** Tables and inline styles. No flexbox, grid,
  absolute positioning or CSS variables in compiled output — see
  [docs/architecture.md](docs/architecture.md).
- **Module boundaries.** `lib/*` does not import from `app/` or `components/`.
- **Idempotency is not optional.** Any code that sends must skip recipients
  already marked sent for that campaign. QStash retries, and a retry must be
  safe.
- **Don't edit `components/ui/*`.** Extend via `className` instead.

## Adding a block type

1. Add the type to `lib/email/document.ts` and the `EmailBlock` union
2. Add a `createBlock` case
3. Add a `renderBlock` case in `lib/email/compiler.ts`
4. Add a `blockToText` case in the same file
5. Render it on the canvas in the block preview component
6. Add its inspector fields

## Commit messages

Write what changed and why, in the imperative. The existing history is the style
guide — a subject line that reads as an instruction, and a body explaining the
reasoning when it isn't obvious.
