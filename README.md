# ANU Fix

A campus facility repair tracker: spot a broken light, a leaking tap, or a
wobbly chair, report it, and watch it move from `submitted` to `in_progress`
to `resolved`. This is a **course prototype** — reports made here do not reach
any real ANU maintenance team, and the app carries no ANU branding.

Core flow: **submit a ticket → see it on the list → open its detail page →
watch its status and history change over time.** Every ticket keeps a
chronological event log, starting with the "submitted" event its own creation
writes, so the detail page is a timeline, not just a current snapshot.

## What good looks like here

The brief was to make the tracked state real: everything a visitor does must
survive a page refresh and a server restart, so there is no `localStorage` and
no in-memory array anywhere in the request path — every read and write goes
through SQLite via Drizzle (`src/lib/db.ts`), and the schema (`src/lib/schema.ts`)
is the only place `tickets` and `ticket_events` are defined. A status change
and the history row that explains it are written in one DB transaction
(`updateTicketStatus` in `src/lib/db.ts`), so the two can never drift apart —
not even if the process dies mid-write.

I chose **no accounts, no image upload, no email, no maps, no chat** for v1,
matching the brief's minimal scope: the goal was one true end-to-end flow
(report → track → update), not a broad but shallow feature set. The "demo
admin" panel on each ticket's detail page updates status and adds a note, but
says plainly that it is not real access control — anyone can open it, and
there is no maintenance team behind it. That's a judgement call the brief
asked for explicitly, not an oversight.

Enforced automatically (see `spec/` and `pnpm check`): every route returns
real HTML behind a landmark structure that passes an automated accessibility
scan (axe-core, run against jsdom in `spec/invariants.test.ts`); ticket
creation, filtering, search, status updates, and 404 handling all have
contract tests (`spec/tickets.test.ts`) that hit the built server over HTTP,
not mocks. Visual polish and the exact wording of empty/error states were
judgement calls, checked by eye at both marking viewports rather than by an
automated test.

## Running it locally

```sh
pnpm install
pnpm db:generate   # only needed after editing src/lib/schema.ts
pnpm dev           # applies pending migrations automatically, then serves on :4321
```

The database file lives at `./.data/app.db` by default (override with the
`DATABASE_PATH` env var). It is created and migrated automatically the first
time the server starts — nothing needs to be run by hand before `pnpm dev`.

To load a small set of clearly-labelled demo tickets (each titled with a
`[Demo]` prefix), run:

```sh
pnpm db:seed
```

This only ever adds rows — it checks existing titles first, so running it
again, or running it against a database that already has real submissions on
it, is a no-op rather than a reset.

Before pushing, run `pnpm check` (typecheck + build + the full test suite).

## Deployment

Deploys to Fly.io with a persistent volume mounted so `DATABASE_PATH` points
at durable storage rather than the container's ephemeral filesystem — see
`fly.toml`. This prototype has not yet been deployed at the time of writing;
`PROCESS.md` says why.
