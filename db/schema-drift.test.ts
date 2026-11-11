import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { is } from "drizzle-orm";
import { getTableConfig, PgTable } from "drizzle-orm/pg-core";
import { describe, expect, it } from "vitest";

import * as schema from "./schema";

// Schema changes are hand-written SQL (docs/database.md), so nothing forces
// db/schema.ts to learn about an index or constraint a migration creates.
// That gap is how schema.ts drifted before: indexes from 0001-0010 were
// missing, and drizzle-kit then offered to drop them. This test reads every
// migration, applied and pending, and fails when one of them leaves behind a
// named index or constraint that schema.ts does not declare.

const MIGRATIONS = path.join(__dirname, "migrations");

/** Applied migrations in order, then pending ones in order. */
function migrationFiles(): string[] {
  const inDir = (dir: string) =>
    fs.existsSync(dir)
      ? fs
          .readdirSync(dir)
          .filter((f) => f.endsWith(".sql"))
          .sort()
          .map((f) => path.join(dir, f))
      : [];
  return [...inDir(MIGRATIONS), ...inDir(path.join(MIGRATIONS, "pending"))];
}

/** SQL without comments, so commented-out rollback steps don't count. */
function stripComments(sql: string): string {
  return sql.replace(/\/\*[\s\S]*?\*\//g, "").replace(/--.*$/gm, "");
}

const CREATE_INDEX =
  /create\s+(?:unique\s+)?index\s+(?:concurrently\s+)?(?:if\s+not\s+exists\s+)?(\w+)/gi;
const ADD_CONSTRAINT = /constraint\s+(\w+)\s+(?:unique|foreign\s+key|primary\s+key|check)\b/gi;
const RENAME_CONSTRAINT = /rename\s+constraint\s+(\w+)\s+to\s+(\w+)/gi;
const DROP =
  /drop\s+(?:index|constraint)\s+(?:concurrently\s+)?(?:if\s+exists\s+)?(\w+)/gi;

/**
 * Names the migrations leave in the database, replaying creates, renames and
 * drops in file order. Constraints added dynamically inside DO blocks
 * (format(...)) are invisible here; account-deletion.test.ts covers those.
 */
function namesLeftByMigrations(sqlFiles: readonly string[]): Set<string> {
  const names = new Set<string>();
  for (const file of sqlFiles) {
    const sql = stripComments(fs.readFileSync(file, "utf8"));
    const events: { at: number; apply: () => void }[] = [];
    for (const m of sql.matchAll(CREATE_INDEX)) {
      events.push({ at: m.index, apply: () => names.add(m[1].toLowerCase()) });
    }
    for (const m of sql.matchAll(ADD_CONSTRAINT)) {
      events.push({ at: m.index, apply: () => names.add(m[1].toLowerCase()) });
    }
    for (const m of sql.matchAll(RENAME_CONSTRAINT)) {
      events.push({
        at: m.index,
        apply: () => {
          names.delete(m[1].toLowerCase());
          names.add(m[2].toLowerCase());
        },
      });
    }
    for (const m of sql.matchAll(DROP)) {
      events.push({ at: m.index, apply: () => names.delete(m[1].toLowerCase()) });
    }
    events.sort((a, b) => a.at - b.at).forEach((e) => e.apply());
  }
  return names;
}

/** Every index and constraint name db/schema.ts declares. */
function namesInSchema(): Set<string> {
  const names = new Set<string>();
  for (const value of Object.values(schema)) {
    if (!is(value, PgTable)) continue;
    const config = getTableConfig(value);
    for (const i of config.indexes) if (i.config.name) names.add(i.config.name);
    for (const u of config.uniqueConstraints) {
      const name = u.getName();
      if (name) names.add(name);
    }
    // Column-level .unique(name).
    for (const c of config.columns) if (c.isUnique && c.uniqueName) names.add(c.uniqueName);
    for (const f of config.foreignKeys) names.add(f.getName());
    for (const c of config.checks) names.add(c.name);
  }
  return names;
}

describe("db/schema.ts declares what the migrations create", () => {
  it("has every index and constraint a migration leaves behind", () => {
    const declared = namesInSchema();
    const missing = [...namesLeftByMigrations(migrationFiles())].filter(
      (name) => !declared.has(name),
    );
    // Add each one to db/schema.ts under the same name.
    expect(missing).toEqual([]);
  });
});

describe("namesLeftByMigrations", () => {
  const write = (sql: string) => {
    const file = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "drift-")), "x.sql");
    fs.writeFileSync(file, sql);
    return file;
  };

  it("finds indexes and named constraints", () => {
    const file = write(`
      CREATE UNIQUE INDEX CONCURRENTLY IF NOT EXISTS a_unq ON t (x);
      create index b_idx on t (y);
      alter table t add constraint c_fk
        foreign key (z) references u(id);
      create table v (id uuid, constraint d_unq unique (id));
    `);
    expect([...namesLeftByMigrations([file])].sort()).toEqual([
      "a_unq",
      "b_idx",
      "c_fk",
      "d_unq",
    ]);
  });

  it("applies renames and drops, and ignores comments", () => {
    const file = write(`
      create index gone_idx on t (x);
      drop index if exists gone_idx;
      alter table t add constraint old_name unique (y);
      alter table t rename constraint old_name to new_name;
      -- create index commented_idx on t (z);
      select 1 from pg_constraint where conname = 'not_a_definition';
    `);
    expect([...namesLeftByMigrations([file])]).toEqual(["new_name"]);
  });
});
