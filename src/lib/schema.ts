import { sql } from "drizzle-orm";
import { index, int, sqliteTable, text } from "drizzle-orm/sqlite-core";

// The schema is the ground truth for the database. To change it: edit here,
// run `pnpm db:generate` to turn the diff into a migration under drizzle/,
// and commit both — the migration applies automatically when the server
// boots (see src/lib/db.ts), locally and deployed. Never edit the database
// by hand: state on the deployed volume outlives every deploy, and the
// migration trail is what keeps old state and new code compatible.

export const TICKET_STATUSES = ["submitted", "in_progress", "resolved"] as const;
export type TicketStatus = (typeof TICKET_STATUSES)[number];

export const TICKET_CATEGORIES = ["lighting", "plumbing", "furniture", "hvac", "other"] as const;
export type TicketCategory = (typeof TICKET_CATEGORIES)[number];

export const tickets = sqliteTable(
  "tickets",
  {
    id: int().primaryKey({ autoIncrement: true }),
    title: text().notNull(),
    location: text().notNull(),
    room: text(),
    category: text({ enum: TICKET_CATEGORIES }).notNull(),
    description: text().notNull(),
    status: text({ enum: TICKET_STATUSES }).notNull().default("submitted"),
    createdAt: text("created_at")
      .notNull()
      .default(sql`(datetime('now'))`),
    updatedAt: text("updated_at")
      .notNull()
      .default(sql`(datetime('now'))`),
  },
  (table) => [
    index("tickets_status_idx").on(table.status),
    index("tickets_category_idx").on(table.category),
    index("tickets_created_at_idx").on(table.createdAt),
  ],
);

export type Ticket = typeof tickets.$inferSelect;
export type NewTicket = typeof tickets.$inferInsert;

// One row per step in a ticket's life, including the row its own creation
// writes, so the full history (who changed what, and any note) is just a
// query away — never reconstructed from the ticket's current state alone.
export const ticketEvents = sqliteTable(
  "ticket_events",
  {
    id: int().primaryKey({ autoIncrement: true }),
    ticketId: int("ticket_id")
      .notNull()
      .references(() => tickets.id, { onDelete: "cascade" }),
    status: text({ enum: TICKET_STATUSES }).notNull(),
    note: text(),
    createdAt: text("created_at")
      .notNull()
      .default(sql`(datetime('now'))`),
  },
  (table) => [index("ticket_events_ticket_id_idx").on(table.ticketId)],
);

export type TicketEvent = typeof ticketEvents.$inferSelect;
export type NewTicketEvent = typeof ticketEvents.$inferInsert;
