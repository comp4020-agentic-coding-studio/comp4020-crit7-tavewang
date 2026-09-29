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

## Round two: tracking UX, demo data, and copy polish

A second pass added six things on top of the shipped v1: a bigger, more
realistic demo seed; a progress bar, ticket number, and a labelled "Reopened"
timeline entry on the detail page; a searchable-but-still-free-text building
field on the report form; a similar-open-tickets prompt driven by one
explainable SQL rule; a set of copy fixes on the list and form pages; and the
demo admin panel collapsed by default behind a native `<details>`. All of it
built on infrastructure (`src/lib/format.ts`, `src/lib/buildings.ts`,
`src/components/ProgressSteps.astro`, `src/pages/api/similar-tickets.json.ts`)
that existed before this pass but wasn't wired into any page yet — this round
was mostly that wiring, plus the seed rewrite.

**Two real bugs, both caught by running checks rather than by reading code.**

- `pnpm test`'s server-boot step failed outright with
  `TypeError: Invalid option : option`. Manually running the built server
  against a scratch database and reading stderr traced it to
  `new Intl.DateTimeFormat(...)` in `src/lib/format.ts`: the spec rejects
  combining `dateStyle`/`timeStyle` with `timeZoneName` in the same options
  object, and the full-date formatter was doing exactly that. This would have
  crashed every ticket-detail page and the homepage in production. Fixed by
  building the same "long date, short time, explicit zone" look from
  individual components (`year`, `month`, `day`, `hour`, `minute`,
  `timeZoneName`) instead of the style shortcuts — confirmed with a direct
  `node -e` reproduction before and after.
- Screenshotting the mobile viewport with `chrome --headless --screenshot
  --window-size=390,844` showed what looked like real overflow: clipped hero
  text, a stat box cut off, a status badge running off the edge. Before
  filing that as an app bug, I built a one-page test harness that reports
  `window.innerWidth`/`innerHeight` back visually, and it showed Chrome's
  headless screenshot mode was silently floor-ing the window to ~500px wide
  no matter what `--window-size` asked for — which happened to land just
  above this app's 480px mobile breakpoint, so the mobile CSS never even
  applied. The fix was to stop trusting the CLI flag and drive Chrome
  directly over the DevTools Protocol instead (a small Node script opens a
  raw WebSocket to a `--remote-debugging-port` Chrome, calls
  `Emulation.setDeviceMetricsOverride` with the real 390×844 metrics, then
  navigates and captures), which the same test harness confirmed was
  reporting the correct viewport. Re-shot the actual pages at a true 390×844
  and the app was fine all along — a testing-tool bug, not a product one, but
  one I wouldn't have caught without checking the tool's own output first.

**Test coverage added**, not just manual checks: reopening a resolved ticket
(status flips back, "Reopened" label and the reopen note both appear), and
three cases for the similar-tickets endpoint (a real match, a resolved ticket
correctly excluded, an unknown category returning an empty list rather than
erroring). `pnpm check` — typecheck, build, and the full test suite including
axe-core against every route, run against the new markup (`<details>`,
`<datalist>`, the progress list, the reopened tag) — passes clean at 46
tests, up from 42.

**Manual verification** was against an isolated database in a throwaway
`mkdtemp` directory, never the dev or production one, confirming: the seed
script's idempotency (second run adds nothing); ticket-number and progress-bar
rendering; the reopened tag appearing exactly on the event after a resolved
one; the datalist offering real ANU buildings while still accepting free
text; the similar-tickets box appearing/disappearing correctly and never
losing in-progress form input; the admin panel starting collapsed and
force-opening (with the submitted note preserved) on a validation error; the
list page's relative timestamps, "Showing N of M" count, and "Clear filters"
link on an empty filtered result.

Redeployed with the same `flyctl deploy --remote-only --ha=false` command
against the existing app and volume — no new machine, no new volume, no
database reset. Confirmed on the live URL afterwards: the ticket submitted
during v1 verification ("Deploy verification ticket", `/tickets/1`) is still
there and now renders with the new UI (`#0001`, the progress bar, "59 minutes
ago" as a relative time, AEST-suffixed full dates on the detail page, the
admin panel collapsed by default); the production database still has exactly
that one real ticket and no `[Demo]`-prefixed rows, confirming `scripts/seed.ts`
was never run against it.

## What's unfinished

Nothing load-bearing. The one thing I'd still do with more time is a second
manual pass at both marking viewports against the live URL itself with a
browser (this pass verified the deployed HTML directly over HTTP, the same
way v1's persistence was verified, but didn't repeat the visual/Playwright
pass against `*.fly.dev` specifically).
