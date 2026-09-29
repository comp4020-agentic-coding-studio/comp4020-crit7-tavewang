// Canberra's zone, named explicitly rather than left to the server's local
// time — the machine that renders a page and the person reading it are not
// guaranteed to share a timezone otherwise.
const ZONE = "Australia/Sydney";

// dateStyle/timeStyle can't be combined with timeZoneName (the Intl spec
// rejects mixing style shortcuts with individual component options), so the
// "long date, short time, explicit zone" look is built from components
// instead.
const FULL = new Intl.DateTimeFormat("en-AU", {
  year: "numeric",
  month: "long",
  day: "numeric",
  hour: "numeric",
  minute: "2-digit",
  timeZone: ZONE,
  timeZoneName: "short",
});

// Ticket lists show many timestamps at once, so a short relative form
// ("3 days ago") reads faster than a full date; detail pages show the full,
// unambiguous one instead (see formatFullDateTime).
const RELATIVE = new Intl.RelativeTimeFormat("en-AU", { numeric: "auto" });

const UNITS: Array<[Intl.RelativeTimeFormatUnit, number]> = [
  ["year", 1000 * 60 * 60 * 24 * 365],
  ["month", 1000 * 60 * 60 * 24 * 30],
  ["week", 1000 * 60 * 60 * 24 * 7],
  ["day", 1000 * 60 * 60 * 24],
  ["hour", 1000 * 60 * 60],
  ["minute", 1000 * 60],
];

export function formatFullDateTime(iso: string): string {
  return FULL.format(new Date(iso));
}

export function formatRelativeTime(iso: string): string {
  const diffMs = new Date(iso).getTime() - Date.now();
  for (const [unit, ms] of UNITS) {
    if (Math.abs(diffMs) >= ms) {
      return RELATIVE.format(Math.round(diffMs / ms), unit);
    }
  }
  return diffMs >= 0 ? "in less than a minute" : "just now";
}

export function formatTicketNumber(id: number): string {
  return `#${String(id).padStart(4, "0")}`;
}
