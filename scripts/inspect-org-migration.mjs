import process from "node:process";

import { neon } from "@neondatabase/serverless";
import dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  console.error("DATABASE_URL is missing from .env.local");
  process.exit(1);
}

const sql = neon(databaseUrl);

const queries = {
  users: `select count(*)::int as count from users`,
  organizations: `select count(*)::int as count from organizations`,
  organizationMembers: `select count(*)::int as count from organization_members`,
  audienceContacts: `select count(*)::int as count from recipients`,
  audienceContactsMissingOrg: `
    select count(*)::int as count
    from recipients
    where organization_id is null
  `,
  audienceOrganizations: `
    select count(distinct organization_id)::int as count
    from recipients
  `,
  audienceDuplicateOrgEmails: `
    select count(*)::int as count
    from (
      select organization_id, email
      from recipients
      group by organization_id, email
      having count(*) > 1
    ) duplicates
  `,
  campaigns: `select count(*)::int as count from campaigns`,
  campaignsMissingOrg: `
    select count(*)::int as count
    from campaigns
    where organization_id is null
  `,
  campaignsMissingUser: `
    select count(*)::int as count
    from campaigns
    where user_id is null
  `,
  campaignUsersWithoutMember: `
    select count(distinct c.user_id)::int as count
    from campaigns c
    left join organization_members om on om.user_id = c.user_id
    where c.organization_id is null
      and c.user_id is not null
      and om.id is null
  `,
  campaignUsersWithoutUserRow: `
    select count(distinct c.user_id)::int as count
    from campaigns c
    left join users u on u.id = c.user_id
    where c.organization_id is null
      and c.user_id is not null
      and u.id is null
  `,
};

for (const [name, query] of Object.entries(queries)) {
  const [row] = await sql.query(query);
  console.log(`${name}: ${row.count}`);
}
