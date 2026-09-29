# Crit 7 reflection

## What was the breakthrough that moved the work forward?

**[Fill this in yourself — this is your call, not mine to make up.]**

Two candidates from the session's record, if either matches how it actually
felt to you:

- Deciding early that a ticket's status change and its history row had to be
  one atomic transaction, not two separate writes — that single decision
  (`updateTicketStatus` in `src/lib/db.ts`) is what makes "no image upload,
  no accounts, no chat, but the history can never be wrong" actually true,
  instead of just a stated intention.
- Running the axe-core accessibility check and getting a real, specific
  failure (the demo banner sitting outside any landmark) rather than a vague
  sense that something might be off — a concrete failing check is a
  different kind of signal than "this looks fine to me."

If neither of these was actually the turning point for you, say what was.

## What did this work change about who I want to be as a software developer?

**[Fill this in yourself — this is genuinely yours to answer.]**

Some verifiable facts from this crit, if they're useful raw material for your
own answer:

- The brief's hardest constraint wasn't a feature, it was a guarantee
  ("survives a refresh and a restart") — and the way to know it was met
  wasn't reading the code, it was killing the server process and starting it
  again against the same file.
- Two of the bugs this session caught (the CSRF/Origin 403s, the axe "region"
  violation) only existed because something was actually run and checked,
  not because the code looked wrong on inspection.

150–300 words total is plenty for this file.
