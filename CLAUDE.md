# Your harness

This file is yours, and it arrives empty on purpose. The rules you hold the
agent to are part of what gets marked, so they should be rules you decided on.

Nothing about the starter is recorded here. What the repo ships is explained
where it lives --- `fly.toml`, the `Dockerfile`, the CI workflow and
`spec/README.md` each say what they fix --- and the
[course website](https://comp.anu.edu.au/courses/comp4020-agentic-coding-studio/)
publishes this deliverable's brief and spec. Read them before you plan or build;
what the agent needs to carry from any of it is your call.

## How to work in here

- Keep the dev server running (`pnpm dev`) so you see changes as you make them.
- Before you push, run `pnpm check`.
- When a check fails, read its output before changing anything. The failure
  message is the instruction: it tells you the file, the line, or the contract.
  Treat a red check as authoritative --- the site is wrong until the check is
  green, not until you decide it should be.
- Commit when the checks pass. Never commit a red state.

## The rendered page is the truth

Source can read fine while the page is broken --- visual overflow, or a text
node collapsing to nothing because a newline between two inline elements
disappears in the render. Neither shows up in the DOM inspection and neither
fails a test.

Before claiming a visual change works, build it, serve it, and screenshot it at
both marking viewports (see the
[assessment page](https://comp.anu.edu.au/courses/comp4020-agentic-coding-studio/topics/assessment/#marking-environment)
for the exact sizes).

## Tone

Write replies with a light, humorous touch rather than a flat status report ---
a wry aside or a playful line is welcome, especially when reporting on the
course's own kangaroo bit. Keep it to tone, not substance: jokes don't replace
the actual facts (what changed, what passed, what's live), they just season how
those facts are delivered.

## This file is yours

This CLAUDE.md is a starting point, not a fixed rulebook. As you learn what
this deliverable needs --- a convention to hold the agent to, a sensor that
keeps catching you out, a fact about the platform the agent keeps getting
wrong --- write it down here and wire it into `check`. Growing this file is the
work of harness engineering, and the gap between this boilerplate and your own
version is part of what your work says about the developer you're becoming.
