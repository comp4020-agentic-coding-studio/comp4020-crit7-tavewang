# Process overview

## What I built

ANU Fix, a campus facility repair tracker: report a broken light, tap, chair
or aircon; watch it move through `submitted` → `in_progress` → `resolved`;
read its full history. What it is and what "good" means for it is in
`README.md`; this is how I got there.

## How I got here

The brief was specific enough to skip a separate design phase: minimal
feature scope (list, report, detail+history, demo admin), a required stack
(Astro + Drizzle + SQLite), and a hard constraint — every core write must
survive a refresh and a restart, so no `localStorage`, no in-memory state.
I started from the schema, since everything else (the DB layer, the pages,
the tests) is downstream of it.

**Schema and DB layer.** `tickets` and `ticket_events` are the two tables:
one row per ticket, one row per event in its life (including the "submitted"
event its own creation writes, so history is a query, not a reconstruction).
`createTicket` and `updateTicketStatus` in `src/lib/db.ts` each wrap their
insert/update *and* the event row they imply in a single `db.transaction`,
so a ticket's status and its history can't drift apart even under a crash
mid-write — the constraint the brief cared most about
([`8a91bcd`](https://github.com/comp4020-agentic-coding-studio/comp4020-crit7-tavewang/commit/8a91bcd6d376a0887178ab9b51ac4816cab60437)).
Drizzle's newer array-form `extraConfig` (for indexes) replaced the
deprecated object form once `astro check` flagged it as a hint, with no
behaviour change.

**Pages and components.** Astro's self-posting frontmatter (a page handles
its own `POST`, validates, then either redisplays the form with field errors
or issues a 303 redirect) covers `/report` and `/tickets/[id]` without a
separate API route layer — there's no client state to synchronise and no
JSON contract that would justify one. `src/pages/tickets/[id].astro` sets
`Astro.response.status = 404` for an unknown or malformed id while still
rendering a full, styled "not found" page, rather than an empty response
([`22957fc`](https://github.com/comp4020-agentic-coding-studio/comp4020-crit7-tavewang/commit/22957fc13c097da9dc45eb10dfec63834e562b72)).

**Checks, and two real bugs they caught.** `spec/tickets.test.ts` hits the
built server over real HTTP for the whole contract: create → persists across
a refetch → first history event on creation → field-level validation errors
→ filter/search → demo-admin status update visible in history → 404 for a
missing or malformed id. Running it first caught two things worth recording:

- Astro's `security.checkOrigin` was rejecting every test `POST` with a 403.
  This wasn't an app bug — a real browser always sends a same-origin
  `Origin` header — so the fix was in the test harness (send one), not the
  app.
- The shared axe-core accessibility pass failed a "region" rule on three
  routes: the demo-mode banner sat as a sibling of `<nav>`, outside every
  landmark. That one *was* a real bug — wrapping both in a `<header>` fixed
  it, and it's the kind of thing that reads fine in the source and only
  shows up once something actually renders the page.

**Seeding.** `scripts/seed.ts` is a standalone script (Node 24's native TS
stripping, no build step) rather than a route or a startup hook, per the
brief's "must not reset data on every startup." It checks existing titles
before inserting, so it's a no-op on a second run — verified against a
scratch database and again against the real dev database.

**Manual verification.** `pnpm check` is HTTP-level and DOM-level, not visual,
so I drove the built app with Playwright at both marking viewports
(1920×1080, 390×844): home, report form (empty and with validation errors),
ticket detail after creation, after a reload, after a demo-admin status
update, search-filtered list, the 404 page, and the readme page. Then,
separately, I killed the dev server process outright (not just a reload) and
restarted it against the same database file to confirm a ticket created in
the browser was still there — the specific guarantee the brief asked for
that no in-process test can actually exercise.

## Deployment

Deployed to Fly.io (`comp4020-crit7-tavewang.fly.dev`) with
`flyctl deploy --remote-only --ha=false -a comp4020-crit7-tavewang`, using the
volume mount and `DATABASE_PATH` already set up in `fly.toml`. Two things
worth recording:

- The deploy log printed a one-off warning about the app not listening on
  `0.0.0.0:4321` yet — a cold-start timing artefact from the machine still
  booting when the check ran, not a real problem: the app answered `200`
  seconds later and stayed up.
- I verified persistence on the live instance the same way as locally, but
  for real this time: submitted a ticket straight to the deployed URL over
  HTTP, then fetched its detail page in a separate request, and the ticket
  was there. `scripts/seed.ts` isn't in the deploy image (it's a local dev
  convenience, not something that belongs in the production container per
  the brief's "must not reset data" constraint), so the live database starts
  genuinely empty and grows only from real submissions — which is the
  correct behaviour for a production instance, not a gap.

## What's unfinished

Nothing load-bearing. The one thing I'd still do with more time is a second
manual pass at both marking viewports against the live URL itself (I did
this against the local build during development, and confirmed the deployed
instance serves correct HTML and persists data over HTTP, but didn't re-run
the full Playwright visual pass against `*.fly.dev` specifically).
