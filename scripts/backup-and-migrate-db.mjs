import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

import { neon } from "@neondatabase/serverless";
import dotenv from "dotenv";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
dotenv.config({ path: path.join(root, ".env.local") });

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  console.error("DATABASE_URL is missing from .env.local");
  process.exit(1);
}

const sql = neon(databaseUrl);
const args = new Set(process.argv.slice(2));
const backupOnly = args.has("--backup-only");
const migrateOnly = args.has("--migrate-only");

function backupName() {
  return `letterstack-db-backup-${new Date()
    .toISOString()
    .replace(/[:.]/g, "-")}.json`;
}

function dbLabel(url) {
  try {
    const parsed = new URL(url);
    return {
      host: parsed.host,
      database: parsed.pathname.replace(/^\//, ""),
    };
  } catch {
    return { host: "unknown", database: "unknown" };
  }
}

function quoteIdent(value) {
  return `"${String(value).replaceAll('"', '""')}"`;
}

async function createBackup() {
  const backupDir = path.join(root, "db", "backups");
  await fs.mkdir(backupDir, { recursive: true });

  const tables = await sql.query(
    `
      select table_schema, table_name
      from information_schema.tables
      where table_schema = 'public'
        and table_type = 'BASE TABLE'
      order by table_name
    `,
  );

  const backup = {
    createdAt: new Date().toISOString(),
    database: dbLabel(databaseUrl),
    tables: [],
  };

  for (const table of tables) {
    const columns = await sql.query(
      `
        select column_name, data_type, is_nullable
        from information_schema.columns
        where table_schema = $1
          and table_name = $2
        order by ordinal_position
      `,
      [table.table_schema, table.table_name],
    );
    const rows = await sql.query(
      `select * from ${quoteIdent(table.table_schema)}.${quoteIdent(table.table_name)}`,
    );

    backup.tables.push({
      schema: table.table_schema,
      name: table.table_name,
      columns,
      rowCount: rows.length,
      rows,
    });
  }

  const backupPath = path.join(backupDir, backupName());
  await fs.writeFile(backupPath, JSON.stringify(backup, null, 2));
  console.log(`Backup written: ${backupPath}`);
  console.log(
    `Backed up ${backup.tables.length} tables / ${backup.tables.reduce(
      (total, table) => total + table.rowCount,
      0,
    )} rows.`,
  );
  return backupPath;
}

function startsDollarQuote(sqlText, index) {
  const match = /^\$[A-Za-z_][A-Za-z0-9_]*\$|^\$\$/.exec(sqlText.slice(index));
  return match?.[0] ?? null;
}

function splitSqlStatements(sqlText) {
  const statements = [];
  let start = 0;
  let i = 0;
  let single = false;
  let double = false;
  let lineComment = false;
  let blockComment = false;
  let dollarTag = null;

  while (i < sqlText.length) {
    const ch = sqlText[i];
    const next = sqlText[i + 1];

    if (lineComment) {
      if (ch === "\n") lineComment = false;
      i++;
      continue;
    }

    if (blockComment) {
      if (ch === "*" && next === "/") {
        blockComment = false;
        i += 2;
        continue;
      }
      i++;
      continue;
    }

    if (dollarTag) {
      if (sqlText.startsWith(dollarTag, i)) {
        i += dollarTag.length;
        dollarTag = null;
        continue;
      }
      i++;
      continue;
    }

    if (single) {
      if (ch === "'" && next === "'") {
        i += 2;
        continue;
      }
      if (ch === "'") single = false;
      i++;
      continue;
    }

    if (double) {
      if (ch === '"' && next === '"') {
        i += 2;
        continue;
      }
      if (ch === '"') double = false;
      i++;
      continue;
    }

    if (ch === "-" && next === "-") {
      lineComment = true;
      i += 2;
      continue;
    }

    if (ch === "/" && next === "*") {
      blockComment = true;
      i += 2;
      continue;
    }

    if (ch === "'") {
      single = true;
      i++;
      continue;
    }

    if (ch === '"') {
      double = true;
      i++;
      continue;
    }

    const tag = startsDollarQuote(sqlText, i);
    if (tag) {
      dollarTag = tag;
      i += tag.length;
      continue;
    }

    if (ch === ";") {
      const statement = sqlText.slice(start, i).trim();
      if (statement) statements.push(statement);
      start = i + 1;
    }

    i++;
  }

  const tail = sqlText.slice(start).trim();
  if (tail) statements.push(tail);
  return statements;
}

async function applyMigrations() {
  const migrationsDir = path.join(root, "db", "migrations");
  const migrationNames = (await fs.readdir(migrationsDir))
    .filter((name) => /^\d+.*\.sql$/i.test(name))
    .sort((left, right) => left.localeCompare(right));

  for (const migrationName of migrationNames) {
    const migrationPath = path.join(migrationsDir, migrationName);
    const migrationSql = await fs.readFile(migrationPath, "utf8");
    const statements = splitSqlStatements(migrationSql);

    console.log(`Applying migration: ${migrationPath}`);
    console.log(`Statements: ${statements.length}`);

    for (let index = 0; index < statements.length; index++) {
      await sql.query(statements[index]);
      console.log(`Applied ${index + 1}/${statements.length}`);
    }
  }

  const verification = await sql.query(
    `
      select
        count(*) filter (where organization_id is null)::int as missing_organization,
        count(*)::int as total
      from recipients
    `,
  );

  console.log(
    `Verified audience: ${verification[0].total} contacts, ` +
      `${verification[0].missing_organization} missing organization.`,
  );
}

if (!migrateOnly) {
  await createBackup();
}

if (!backupOnly) {
  await applyMigrations();
}
