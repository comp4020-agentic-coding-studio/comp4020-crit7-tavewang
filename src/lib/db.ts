import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import Database from "better-sqlite3";
import { and, desc, eq, like, ne, or } from "drizzle-orm";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import {
  type NewTicket,
  type Ticket,
  type TicketCategory,
  type TicketEvent,
  type TicketStatus,
  ticketEvents,
  tickets,
} from "./schema";

// One SQLite file is the app's whole persistent state. In production
// fly.toml points DATABASE_PATH at the machine's volume (/data), which is
// how state survives a reload and a redeploy; locally it defaults to an
// untracked file in .data/.
const path = process.env.DATABASE_PATH ?? "./.data/app.db";
mkdirSync(dirname(path), { recursive: true });

const client = new Database(path);
client.pragma("journal_mode = WAL");
// SQLite doesn't enforce foreign keys unless a connection turns it on — set
// per-connection because it's not persisted in the database file itself.
client.pragma("foreign_keys = ON");

export const db = drizzle(client);

// Migrations run at boot, on whatever machine holds the volume — the
// recommended shape for SQLite on Fly, where there's no separate machine to
// run them from. The flow: edit src/lib/schema.ts, `pnpm db:generate`,
// commit the migration it writes to drizzle/.
migrate(db, { migrationsFolder: "./drizzle" });

export type { Ticket, TicketEvent, TicketStatus, TicketCategory };

export interface TicketFilters {
  status?: TicketStatus;
  category?: TicketCategory;
  search?: string;
}

export function listTickets(filters: TicketFilters = {}): Ticket[] {
  const conditions = [];
  if (filters.status) conditions.push(eq(tickets.status, filters.status));
  if (filters.category) conditions.push(eq(tickets.category, filters.category));
  if (filters.search) {
    const term = `%${filters.search}%`;
    conditions.push(or(like(tickets.title, term), like(tickets.location, term)));
  }

  return db
    .select()
    .from(tickets)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(tickets.createdAt), desc(tickets.id))
    .all();
}

export function getTicket(id: number): Ticket | undefined {
  return db.select().from(tickets).where(eq(tickets.id, id)).get();
}

export function getTicketEvents(ticketId: number): TicketEvent[] {
  return db
    .select()
    .from(ticketEvents)
    .where(eq(ticketEvents.ticketId, ticketId))
    .orderBy(ticketEvents.id)
    .all();
}

// A same-place, same-kind, still-open ticket is worth surfacing to someone
// about to file a duplicate — deliberately just an exact match on location
// and category, not fuzzy matching or a search service: a rule the report
// page's helper text can state outright, rather than one that needs
// explaining after the fact.
export function listOpenTicketsByLocationAndCategory(
  location: string,
  category: TicketCategory,
): Ticket[] {
  return db
    .select()
    .from(tickets)
    .where(
      and(
        eq(tickets.location, location),
        eq(tickets.category, category),
        ne(tickets.status, "resolved"),
      ),
    )
    .orderBy(desc(tickets.createdAt))
    .limit(5)
    .all();
}

export function countTicketsByStatus(): Record<TicketStatus, number> {
  const rows = db
    .select({ status: tickets.status })
    .from(tickets)
    .all();
  const counts: Record<TicketStatus, number> = {
    submitted: 0,
    in_progress: 0,
    resolved: 0,
  };
  for (const row of rows) counts[row.status]++;
  return counts;
}

export type NewTicketInput = Omit<NewTicket, "id" | "status" | "createdAt" | "updatedAt">;

// Creating a ticket and writing its first history event ("submitted") is one
// unit: a ticket should never exist without at least one event describing
// how it got there.
export function createTicket(input: NewTicketInput): Ticket {
  return db.transaction((tx) => {
    const ticket = tx.insert(tickets).values(input).returning().get();
    tx.insert(ticketEvents)
      .values({ ticketId: ticket.id, status: ticket.status as TicketStatus, note: null })
      .run();
    return ticket;
  });
}

// Changing a ticket's status and recording the change in its history are one
// unit: the two must never disagree, so both happen in the same transaction.
export function updateTicketStatus(
  id: number,
  status: TicketStatus,
  note: string | null,
): { ticket: Ticket; event: TicketEvent } | undefined {
  return db.transaction((tx) => {
    const ticket = tx
      .update(tickets)
      .set({ status, updatedAt: new Date().toISOString() })
      .where(eq(tickets.id, id))
      .returning()
      .get();
    if (!ticket) return undefined;
    const event = tx.insert(ticketEvents).values({ ticketId: id, status, note }).returning().get();
    return { ticket, event };
  });
}
