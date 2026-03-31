import { pgTable, serial, varchar, text, integer, real, timestamp, date, uniqueIndex } from "drizzle-orm/pg-core";

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: varchar("username", { length: 255 }).notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const userCountries = pgTable("user_countries", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  countryId: varchar("country_id", { length: 10 }).notNull(), // ISO alpha-3
  intervalDays: real("interval_days").notNull().default(1),
  lastReviewed: timestamp("last_reviewed"),
  dueDate: date("due_date"),
  reviewCount: integer("review_count").notNull().default(0),
  correctCount: integer("correct_count").notNull().default(0),
}, (table) => [
  uniqueIndex("user_country_idx").on(table.userId, table.countryId),
]);
