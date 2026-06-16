import { pgTable, uuid, text, timestamp } from "drizzle-orm/pg-core";

/**
 * The shape of our database, described in TypeScript. This file is the
 * BLUEPRINT — it holds no data. `drizzle-kit push` reads it and builds the
 * matching tables inside Neon.
 *
 * First table: `recipients` — the people who receive a newsletter.
 * One row = one person.
 */
export const recipients = pgTable("recipients", {
  // A unique id for each person, generated automatically by the database.
  id: uuid("id").defaultRandom().primaryKey(),

  // Their email address. notNull() = every row MUST have one.
  email: text("email").notNull(),

  // Their name — optional (no .notNull()), so it can be left blank.
  name: text("name"),

  // When the row was added. Filled in automatically with the current time.
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
