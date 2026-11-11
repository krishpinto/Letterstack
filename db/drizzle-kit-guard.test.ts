import { describe, expect, it } from "vitest";

import { drizzleKitRefusal, normalizeDatabaseHost } from "./drizzle-kit-guard";

const PROD = "ep-prod-123.ap-southeast-1.aws.neon.tech";
const BRANCH = "ep-branch-456.ap-southeast-1.aws.neon.tech";
const url = (host: string) => `postgresql://u:p@${host}/neondb?sslmode=require`;
const argv = (...args: string[]) => ["node", "drizzle-kit", ...args];

describe("drizzleKitRefusal", () => {
  it("leaves commands that don't write to a database alone", () => {
    for (const command of ["generate", "studio", "pull", "check", "up"]) {
      expect(drizzleKitRefusal(argv(command), {})).toBeNull();
    }
  });

  it("refuses push without ALLOW_DB_PUSH", () => {
    const env = { PRODUCTION_DATABASE_HOST: PROD, DATABASE_URL: url(BRANCH) };
    expect(drizzleKitRefusal(argv("push"), env)).toMatch(/disabled/);
  });

  it("refuses push when the production host is unknown", () => {
    const env = { ALLOW_DB_PUSH: "1", DATABASE_URL: url(BRANCH) };
    expect(drizzleKitRefusal(argv("push"), env)).toMatch(/PRODUCTION_DATABASE_HOST/);
  });

  it("refuses push to production, pooled or not, however it is spelled", () => {
    for (const target of [PROD, PROD.replace("ep-prod-123", "ep-prod-123-pooler")]) {
      const env = {
        ALLOW_DB_PUSH: "1",
        PRODUCTION_DATABASE_HOST: PROD.toUpperCase(),
        DATABASE_URL: url(target),
      };
      expect(drizzleKitRefusal(argv("push"), env)).toMatch(/points at production/);
    }
  });

  it("accepts a full connection string as PRODUCTION_DATABASE_HOST", () => {
    const env = {
      ALLOW_DB_PUSH: "1",
      PRODUCTION_DATABASE_HOST: url(PROD),
      DATABASE_URL: url(PROD),
    };
    expect(drizzleKitRefusal(argv("push"), env)).toMatch(/points at production/);
  });

  it("allows push to a branch when explicitly enabled", () => {
    const env = {
      ALLOW_DB_PUSH: "1",
      PRODUCTION_DATABASE_HOST: PROD,
      DATABASE_URL: url(BRANCH),
    };
    expect(drizzleKitRefusal(argv("push"), env)).toBeNull();
  });

  it("finds push after a flag value", () => {
    // `--config drizzle.config.ts` puts a non-flag argument before the command.
    expect(drizzleKitRefusal(argv("--config", "drizzle.config.ts", "push"), {})).toMatch(
      /disabled/,
    );
  });

  it("always refuses migrate", () => {
    const env = {
      ALLOW_DB_PUSH: "1",
      PRODUCTION_DATABASE_HOST: PROD,
      DATABASE_URL: url(BRANCH),
    };
    expect(drizzleKitRefusal(argv("migrate"), env)).toMatch(/migrate is disabled/);
  });
});

describe("normalizeDatabaseHost", () => {
  it("treats the pooled host as the same endpoint", () => {
    expect(normalizeDatabaseHost("EP-X-1-POOLER.region.aws.neon.tech")).toBe(
      "ep-x-1.region.aws.neon.tech",
    );
  });
});
