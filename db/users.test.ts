import { beforeAll, describe, expect, it } from "vitest";

// db/client.ts builds the Neon client at import time and needs a URL. This
// one is never contacted: the test only renders SQL, it never executes it.
process.env.DATABASE_URL ??= "postgres://test:test@db.invalid/test";

type Rendered = { sql: string; params: unknown[] };

let render: (userId: string, soloOwnedOrganizationIds: string[]) => Rendered[];

beforeAll(async () => {
  const { accountDeletionStatements } = await import("./users");
  render = (userId, soloOwnedOrganizationIds) =>
    accountDeletionStatements(userId, {
      blockingOrganizationNames: [],
      soloOwnedOrganizationIds,
    }).map((statement) => (statement as unknown as { toSQL(): Rendered }).toSQL());
});

describe("accountDeletionStatements", () => {
  it("deletes solo workspaces first and the user last", () => {
    const statements = render("u1", ["org-solo"]);
    expect(statements[0].sql).toMatch(/^delete from "organizations"/);
    expect(statements[0].params).toEqual(["org-solo"]);
    expect(statements.at(-1)!.sql).toMatch(/^delete from "users"/);
    expect(statements.at(-1)!.params).toEqual(["u1"]);
  });

  it("hands every org-scoped row to a successor in the row's own workspace", () => {
    const updates = render("u1", []).filter((s) => s.sql.startsWith("update"));
    expect(updates.map((s) => s.sql.match(/^update "(\w+)"/)![1])).toEqual([
      "recipients",
      "campaigns",
      "signup_forms",
      "automations",
      "api_keys",
    ]);
    for (const update of updates) {
      const table = update.sql.match(/^update "(\w+)"/)![1];
      // Correlated on the OUTER row's organization_id. Unqualified, it would
      // bind to om.organization_id and match every workspace.
      expect(update.sql).toContain(`om.organization_id = "${table}".organization_id`);
      // Never hands the row back to the user being deleted.
      expect(update.sql).toContain("om.user_id <> $1");
      expect(update.params).toEqual(["u1", "u1"]);
    }
  });
});
