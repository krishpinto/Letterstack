# Database

LetterStack uses one Neon Postgres project. Its default branch is
production. The app talks to it through Drizzle ORM over Neon's HTTP driver
(`db/client.ts`), which has no interactive transactions: a multi-statement
change that must be atomic goes through `db.batch([...])`, which Neon runs as
one transaction.

## What `db/schema.ts` is

`db/schema.ts` describes the production database exactly: every table,
column, type, default, index and constraint, constraint names included. It
was last checked against a Neon branch of production on 2026-11-11.

It is not the source of schema changes. The database is changed by
hand-written SQL, and `schema.ts` is updated in the same pull request to
match. Two things keep them together:

- `db/schema-drift.test.ts` fails when a migration (applied or pending)
  creates a named index or constraint that `schema.ts` does not declare.
- The drift check below, which compares against the real database.

Many tables were created by SQL with inline `REFERENCES` / `UNIQUE`, so
Postgres named those constraints (`payments_user_id_fkey`,
`api_keys_key_hash_key`). `schema.ts` spells those names out with
`foreignKey({ name })` and `.unique(name)`. Keep doing that: if the name in
`schema.ts` differs from the database, drizzle-kit sees a constraint to drop
and another to create.

## Rules

- Never run `drizzle-kit push` or `drizzle-kit migrate` against production.
  `drizzle.config.ts` refuses both (see `db/drizzle-kit-guard.ts`):
  `migrate` always, `push` unless `ALLOW_DB_PUSH=1` is set and
  `DATABASE_URL` is not `PRODUCTION_DATABASE_HOST`. The guard only runs
  when drizzle-kit loads `drizzle.config.ts`; do not call drizzle-kit with
  `--url` / `--dialect` flags instead of the config.
- Even on a branch, read the plan `push` prints before you confirm it.
  drizzle-kit 0.31 reports some multi-column unique constraints and indexes
  as changed when they are not (its introspection reads operator classes
  and column order differently), and offers to drop and recreate them.
- Never run the one-off scripts in `scripts/` against production without
  reading them first. Several were written for a single past migration.

## Changing the schema

1. Edit `db/schema.ts`.
2. Optional: draft the SQL. On a clean checkout of `main`, run
   `npm run db:generate` once. That writes a baseline snapshot to
   `db/drizzle/` (git-ignored). Make your edit, run it again, and the new
   file in `db/drizzle/` is the difference. It is a draft: read it, and
   never apply it as it is.
3. Write the migration by hand in `db/migrations/pending/`, named
   `<area>-<n>-<what-it-does>.sql`. Every file:
   - starts with a header: purpose, whether it is safe on live data, the
     expected locks and time, how to roll it back, and where it goes in the
     apply order;
   - is idempotent (`IF NOT EXISTS`, `IF EXISTS`, `ON CONFLICT`, or a `DO`
     block that checks the catalog first), so running it twice is harmless;
   - names every index and constraint explicitly, with the same name as
     `schema.ts`;
   - sets `lock_timeout` before any `ALTER TABLE`, so a busy table makes
     the migration fail fast instead of queueing every query behind it.
   `CREATE INDEX CONCURRENTLY` cannot run inside a transaction block. Put
   those statements in a file of their own and say so in its header.
4. Test it on a Neon branch of production, never on production itself:
   create a branch in the Neon console, apply the file with
   `psql "$BRANCH_URL" -f <file>`, run it a second time to prove it is
   idempotent, run the checks in the file's header, and point a local
   `next dev` at the branch to try the affected pages. Delete the branch
   when done.
5. In the pull request, start the body with a "Database migration required
   before deploy" section that lists the files in apply order.
6. Apply to production before the code that needs it is deployed (unless
   the file's header says otherwise). Use `psql`, not a web SQL editor:
   editors can wrap a whole script in one transaction, which breaks
   `CONCURRENTLY`.
7. Once a pending file has been applied to production, move it out of
   `pending/` with `git mv` to the next number, for example
   `db/migrations/0011_<what-it-does>.sql`, and add the date it was applied
   to its header. `db/migrations/NNNN_*.sql` is the record of what
   production has had applied; `pending/` is what it has not.

## A fresh database

A Neon branch of production already has the schema and is the right thing
for local development. For a brand-new empty database (self-hosting, or a
throwaway test database), create the schema from `schema.ts`:

```bash
ALLOW_DB_PUSH=1 PRODUCTION_DATABASE_HOST=<your production host> npm run db:push
```

## Checking for drift

To compare `schema.ts` with the real database, introspect a Neon branch of
production (read-only) into a folder outside the repository:

```bash
npx drizzle-kit pull --config <a config with out: "/tmp/pulled" and the branch URL>
```

Then compare tables, columns, foreign keys (name and `ON DELETE`), unique
constraints and indexes in `/tmp/pulled/meta/0000_snapshot.json` with
`schema.ts`. Compare by name and columns, not the generated SQL text:
pulled snapshots list operator classes and can order the columns of a
unique constraint differently.

Known differences that are not drift:

- `waitlist_signups` is an unused, empty table created outside this
  repository. It is declared so diffs do not drop it.
- `signup_forms.success_message` defaults to the old double-opt-in text in
  the database. The app always writes the column.
