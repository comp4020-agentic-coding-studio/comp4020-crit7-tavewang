#!/usr/bin/env node
// Adds a handful of clearly-labelled demo tickets so a fresh database has
// something to look at. Safe to run more than once: it only ever adds rows
// (each is tagged "[Demo]" in its title) and never truncates or resets
// existing data, so running it against a database that already has real
// submissions on it won't touch them.
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import { ticketEvents, tickets, type TicketCategory, type TicketStatus } from "../src/lib/schema.ts";

const path = process.env.DATABASE_PATH ?? "./.data/app.db";
mkdirSync(dirname(path), { recursive: true });

const client = new Database(path);
client.pragma("journal_mode = WAL");
client.pragma("foreign_keys = ON");

const db = drizzle(client);
migrate(db, { migrationsFolder: "./drizzle" });

interface SeedTicket {
  title: string;
  location: string;
  room?: string;
  category: TicketCategory;
  description: string;
  history: Array<{ status: TicketStatus; note: string | null }>;
}

const SEED_TICKETS: SeedTicket[] = [
  {
    title: "[Demo] Flickering corridor light",
    location: "Hanna Neumann Building",
    room: "1.05",
    category: "lighting",
    description:
      "The overhead light outside the level 1 kitchenette flickers constantly, especially in the evening.",
    history: [{ status: "submitted", note: null }],
  },
  {
    title: "[Demo] Leaking tap in bathroom",
    location: "Copland Building",
    room: "G12",
    category: "plumbing",
    description: "The cold tap in the ground floor bathroom doesn't fully shut off and drips continuously.",
    history: [
      { status: "submitted", note: null },
      { status: "in_progress", note: "Plumber notified, parts on order." },
    ],
  },
  {
    title: "[Demo] Broken chair in tutorial room",
    location: "Marie Reay Teaching Centre",
    room: "3.02",
    category: "furniture",
    description: "One of the tutorial chairs has a cracked leg and wobbles badly.",
    history: [
      { status: "submitted", note: null },
      { status: "in_progress", note: "Facilities team identified the chair, replacement ordered." },
      { status: "resolved", note: "Chair replaced." },
    ],
  },
  {
    title: "[Demo] Air conditioning not cooling",
    location: "CSIT Building",
    room: "N101",
    category: "hvac",
    description: "The lecture theatre air conditioning runs but doesn't seem to cool the room at all.",
    history: [{ status: "submitted", note: null }],
  },
  {
    title: "[Demo] Broken bike rack",
    location: "Union Court",
    category: "other",
    description: "One of the bike rack posts near the food court is bent and unusable.",
    history: [
      { status: "submitted", note: null },
      { status: "in_progress", note: "Logged with grounds maintenance." },
    ],
  },
];

const existingTitles = new Set(
  db.select({ title: tickets.title }).from(tickets).all().map((row) => row.title),
);

let inserted = 0;
for (const seed of SEED_TICKETS) {
  if (existingTitles.has(seed.title)) continue;

  db.transaction((tx) => {
    const finalStatus = seed.history.at(-1)!.status;
    const ticket = tx
      .insert(tickets)
      .values({
        title: seed.title,
        location: seed.location,
        room: seed.room ?? null,
        category: seed.category,
        description: seed.description,
        status: finalStatus,
      })
      .returning()
      .get();

    for (const event of seed.history) {
      tx.insert(ticketEvents).values({ ticketId: ticket.id, status: event.status, note: event.note }).run();
    }
  });
  inserted++;
}

console.log(
  inserted > 0
    ? `Seeded ${inserted} demo ticket(s).`
    : "No new demo tickets to add — they're already in the database.",
);
