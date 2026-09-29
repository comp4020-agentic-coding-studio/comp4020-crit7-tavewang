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
creation, filtering, search, status updates, reopening a resolved ticket, the
similar-tickets API, and 404 handling all have contract tests
(`spec/tickets.test.ts`) that hit the built server over HTTP, not mocks.
Visual polish and the exact wording of empty/error states were judgement
calls, checked by eye at both marking viewports rather than by an automated
test.

### Tracking and reporting improvements

- **Progress bar + timeline.** The detail page shows a three-stage
  Submitted → In progress → Resolved bar (`src/components/ProgressSteps.astro`)
  with a text state label on every step ("Done" / "Current" / "Not yet") —
  never colour alone. The History list under it is the same event log as
  before, now with full explicit-timezone timestamps
  (`src/lib/format.ts`, `Australia/Sydney`) and a ticket number (`#0007`
  style). Reopening a resolved ticket is allowed (the existing
  `updateTicketStatus` transaction already permits any status transition) and
  is called out with a "Reopened" tag on the timeline entry that follows a
  resolved one.
- **Searchable building list.** The report form's location field is a native
  `<input list>` + `<datalist>` (`src/lib/buildings.ts`) seeded with real,
  independently-verified ANU Acton buildings. It's a suggestion list, not a
  constraint — the field stays free text, so "Other location" is just typing
  something not on the list, and no schema or migration change was needed.
- **Similar-open-ticket prompts.** After picking a building and category on
  the report form, a small script calls a new read-only endpoint
  (`GET /api/similar-tickets.json`) that runs one explainable SQL rule — same
  location, same category, status not resolved, newest five — and lists any
  matches inline, without navigating away or losing what's already typed.
  Links open in a new tab as a second safeguard against losing form state.
- **Demo admin panel, collapsed by default.** The status-update form on each
  ticket is now a native `<details>`/`<summary>` ("Demo admin controls"),
  closed on first load so the ticket's own content and progress are what a
  visitor sees first; it force-opens if a status-update submission comes back
  with a validation error, and both the status select and the note field now
  preserve what was submitted rather than resetting.
- **Copy and list polish.** Removed the "no photo upload yet either" aside;
  added description helper text asking for exact location, what's broken, and
  when it was noticed; ticket-list timestamps are now relative
  ("3 days ago") while the detail page keeps the full explicit-timezone date;
  the list page distinguishes total ticket counts from a filtered result
  count ("Showing 1 of 8 total tickets"), and the empty-filtered-state message
  includes a direct "Clear filters" link back to the unfiltered list.

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

Live at **https://comp4020-crit7-tavewang.fly.dev/**. Deploys to Fly.io with a
persistent volume mounted so `DATABASE_PATH` points at durable storage rather
than the container's ephemeral filesystem — see `fly.toml`. Verified after
deploying: a ticket submitted directly against the live URL was still there
on a later, separate request.
