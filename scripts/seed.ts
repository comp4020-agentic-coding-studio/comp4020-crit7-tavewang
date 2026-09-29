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

// Matches the format SQLite's own `datetime('now')` default produces, so a
// seeded row looks no different from one written by the app itself.
function sqliteTimestamp(msAgo: number): string {
  return new Date(Date.now() - msAgo).toISOString().slice(0, 19).replace("T", " ");
}

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

interface SeedEvent {
  status: TicketStatus;
  note: string | null;
  agoMs: number;
}

interface SeedTicket {
  title: string;
  location: string;
  room?: string;
  category: TicketCategory;
  description: string;
  createdAgoMs: number;
  history: SeedEvent[];
}

const SEED_TICKETS: SeedTicket[] = [
  {
    title: "[Demo] Flickering corridor light",
    location: "Hanna Neumann Building",
    room: "1.05",
    category: "lighting",
    description:
      "The overhead light outside the level 1 kitchenette flickers constantly, especially in the evening.",
    createdAgoMs: 2 * DAY,
    history: [{ status: "submitted", note: null, agoMs: 2 * DAY }],
  },
  {
    title: "[Demo] Leaking tap in bathroom",
    location: "Copland Building",
    room: "G12",
    category: "plumbing",
    description: "The cold tap in the ground floor bathroom doesn't fully shut off and drips continuously.",
    createdAgoMs: 5 * DAY,
    history: [
      { status: "submitted", note: null, agoMs: 5 * DAY },
      { status: "in_progress", note: "Plumber notified, parts on order.", agoMs: 4 * DAY },
    ],
  },
  {
    title: "[Demo] Broken chair in tutorial room",
    location: "Marie Reay Teaching Centre",
    room: "3.02",
    category: "furniture",
    description: "One of the tutorial chairs has a cracked leg and wobbles badly.",
    createdAgoMs: 10 * DAY,
    history: [
      { status: "submitted", note: null, agoMs: 10 * DAY },
      { status: "in_progress", note: "Facilities team identified the chair, replacement ordered.", agoMs: 9 * DAY },
      { status: "resolved", note: "Chair replaced.", agoMs: 7 * DAY },
    ],
  },
  {
    title: "[Demo] Air conditioning not cooling",
    location: "Manning Clark Centre",
    room: "Theatre 1",
    category: "hvac",
    description: "The lecture theatre air conditioning runs but doesn't seem to cool the room at all.",
    createdAgoMs: 3 * DAY,
    history: [
      { status: "submitted", note: null, agoMs: 3 * DAY },
      { status: "in_progress", note: "Contractor booked to inspect the unit.", agoMs: 2 * DAY },
    ],
  },
  {
    title: "[Demo] Broken bike rack",
    location: "Union Court",
    category: "other",
    description: "One of the bike rack posts near the food court is bent and unusable.",
    createdAgoMs: 6 * DAY,
    history: [
      { status: "submitted", note: null, agoMs: 6 * DAY },
      { status: "in_progress", note: "Logged with grounds maintenance.", agoMs: 5 * DAY },
    ],
  },
  {
    title: "[Demo] Projector not turning on",
    location: "Coombs Building",
    room: "1.04",
    category: "other",
    description: "The ceiling projector in the seminar room doesn't respond to the remote or wall switch.",
    createdAgoMs: 1 * DAY,
    history: [
      { status: "submitted", note: null, agoMs: 1 * DAY },
      { status: "in_progress", note: "AV technician assigned.", agoMs: 12 * HOUR },
      { status: "resolved", note: "Reset the projector's control unit; working again.", agoMs: 2 * HOUR },
    ],
  },
  {
    title: "[Demo] Blocked drain outside library",
    location: "Chifley Library",
    category: "plumbing",
    description: "Stormwater pools outside the main entrance after rain because the drain grate is blocked.",
    createdAgoMs: 4 * DAY,
    history: [
      { status: "submitted", note: null, agoMs: 4 * DAY },
      { status: "in_progress", note: "Grounds team cleared the grate.", agoMs: 3 * DAY },
      { status: "resolved", note: "Drain flowing freely after clearing.", agoMs: 1 * DAY },
      { status: "in_progress", note: "Pooling again after last night's rain — grate blocked once more.", agoMs: 6 * HOUR },
    ],
  },
  {
    title: "[Demo] Squeaky door hinge",
    location: "University House",
    category: "other",
    description: "The main function room's side door hinge squeaks loudly every time it's opened or closed.",
    createdAgoMs: 1 * HOUR,
    history: [{ status: "submitted", note: null, agoMs: 1 * HOUR }],
  },
];

const existingTitles = new Set(
  db.select({ title: tickets.title }).from(tickets).all().map((row) => row.title),
);

let inserted = 0;
for (const seed of SEED_TICKETS) {
  if (existingTitles.has(seed.title)) continue;

  db.transaction((tx) => {
    const finalEvent = seed.history.at(-1)!;
    const ticket = tx
      .insert(tickets)
      .values({
        title: seed.title,
        location: seed.location,
        room: seed.room ?? null,
        category: seed.category,
        description: seed.description,
        status: finalEvent.status,
        createdAt: sqliteTimestamp(seed.createdAgoMs),
        updatedAt: sqliteTimestamp(finalEvent.agoMs),
      })
      .returning()
      .get();

    for (const event of seed.history) {
      tx.insert(ticketEvents)
        .values({
          ticketId: ticket.id,
          status: event.status,
          note: event.note,
          createdAt: sqliteTimestamp(event.agoMs),
        })
        .run();
    }
  });
  inserted++;
}

console.log(
  inserted > 0
    ? `Seeded ${inserted} demo ticket(s).`
    : "No new demo tickets to add — they're already in the database.",
);
