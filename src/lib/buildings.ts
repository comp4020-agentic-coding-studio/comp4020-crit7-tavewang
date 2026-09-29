// A short list of real, verifiable ANU Acton campus buildings, offered as
// search suggestions on the report form (see the <datalist> in report.astro).
// The field itself stays free text — anyone can type a building not on this
// list — so this is a convenience, not a constraint, and it never changes
// how `location` is stored or how existing tickets are read back.
export const ANU_BUILDINGS = [
  "Hanna Neumann Building",
  "Copland Building",
  "Marie Reay Teaching Centre",
  "Chifley Library",
  "Menzies Library",
  "Union Court",
  "Coombs Building",
  "JG Crawford Building",
  "Hedley Bull Building",
  "Manning Clark Centre",
  "Frank Fenner Building",
  "University House",
  "John Curtin School of Medical Research",
] as const;
