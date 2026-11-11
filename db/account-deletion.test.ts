import { getTableName, is } from "drizzle-orm";
import { getTableConfig, PgTable } from "drizzle-orm/pg-core";
import { describe, expect, it } from "vitest";

import {
  DELETED_WITH_ACCOUNT,
  NULLED_ON_ACCOUNT_DELETION,
  planAccountDeletion,
  REASSIGNED_TO_OWNER,
} from "./account-deletion";
import * as schema from "./schema";

/** Every FK in schema.ts that points at users.id, as "table.column" -> onDelete. */
function foreignKeysToUsers(): Map<string, string | undefined> {
  const out = new Map<string, string | undefined>();
  for (const value of Object.values(schema)) {
    if (!is(value, PgTable)) continue;
    const config = getTableConfig(value);
    for (const fk of config.foreignKeys) {
      const ref = fk.reference();
      if (getTableName(ref.foreignTable) !== "users") continue;
      const columns = ref.columns.map((c) => c.name).join(",");
      out.set(`${config.name}.${columns}`, fk.onDelete);
    }
  }
  return out;
}

describe("what deleting an account does to rows that reference the user", () => {
  const fks = foreignKeysToUsers();
  const reassigned = REASSIGNED_TO_OWNER.map(
    ({ table, column }) => `${getTableName(table)}.${column.name}`,
  );

  it("has a decision for every foreign key to users", () => {
    const decided = new Set<string>([
      ...reassigned,
      ...NULLED_ON_ACCOUNT_DELETION,
      ...DELETED_WITH_ACCOUNT,
    ]);
    const undecided = [...fks.keys()].filter((key) => !decided.has(key));
    // A new table with a user_id must be put in one of the three lists in
    // db/account-deletion.ts, with the matching onDelete in schema.ts.
    expect(undecided).toEqual([]);
  });

  it("lists nothing that is not actually a foreign key to users", () => {
    const stale = [
      ...reassigned,
      ...NULLED_ON_ACCOUNT_DELETION,
      ...DELETED_WITH_ACCOUNT,
    ].filter((key) => !fks.has(key));
    expect(stale).toEqual([]);
  });

  it("restricts deletion for rows handed to the owner", () => {
    for (const key of reassigned) expect([key, fks.get(key)]).toEqual([key, "restrict"]);
  });

  it("nulls rows that must outlive the user", () => {
    for (const key of NULLED_ON_ACCOUNT_DELETION) {
      expect([key, fks.get(key)]).toEqual([key, "set null"]);
    }
  });

  it("cascades only personal rows", () => {
    for (const key of DELETED_WITH_ACCOUNT) {
      expect([key, fks.get(key)]).toEqual([key, "cascade"]);
    }
  });

  it("only reassigns org-scoped tables, since the successor is found by organization_id", () => {
    for (const { table } of REASSIGNED_TO_OWNER) {
      const columns = getTableConfig(table).columns.map((c) => c.name);
      expect(columns).toContain("organization_id");
    }
  });
});

describe("planAccountDeletion", () => {
  it("blocks on a shared workspace the user owns", () => {
    const plan = planAccountDeletion([
      { organizationId: "a", name: "Acme", role: "owner", memberCount: 3 },
    ]);
    expect(plan.blockingOrganizationNames).toEqual(["Acme"]);
  });

  it("deletes workspaces the user owns alone and leaves the rest", () => {
    const plan = planAccountDeletion([
      { organizationId: "solo", name: "Mine", role: "owner", memberCount: 1 },
      { organizationId: "team", name: "Theirs", role: "member", memberCount: 4 },
    ]);
    expect(plan).toEqual({
      blockingOrganizationNames: [],
      soloOwnedOrganizationIds: ["solo"],
    });
  });

  it("never deletes a workspace the user is only a member of", () => {
    const plan = planAccountDeletion([
      { organizationId: "team", name: "Theirs", role: "member", memberCount: 1 },
    ]);
    expect(plan.soloOwnedOrganizationIds).toEqual([]);
  });
});
