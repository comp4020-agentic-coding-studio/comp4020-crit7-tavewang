import { describe, expect, inject, it } from "vitest";

// ANU Fix's own contract, on top of the shared invariants in invariants.test.ts:
// submit -> detail page -> persists across a refetch -> filter/search finds it
// -> demo-admin status update is reflected in both the ticket and its history
// -> invalid input and unknown tickets fail the way the brief asks for.
const baseUrl = inject("baseUrl");

// Astro's CSRF protection checks the Origin header on every non-GET request,
// so a same-origin POST from this test needs one that matches baseUrl — a
// real browser sends this automatically.
function post(path: string, fields: Record<string, string>) {
  return fetch(new URL(path, baseUrl), {
    method: "POST",
    headers: {
      "content-type": "application/x-www-form-urlencoded",
      origin: baseUrl,
    },
    body: new URLSearchParams(fields),
    redirect: "manual",
  });
}

function submitTicket(fields: Record<string, string>) {
  return post("/report", fields);
}

async function createTicket(overrides: Partial<Record<string, string>> = {}) {
  const res = await submitTicket({
    title: `Flickering light ${Math.random().toString(36).slice(2)}`,
    location: "Hanna Neumann Building",
    room: "1.05",
    category: "lighting",
    description: "The light in the corridor has been flickering for a week.",
    ...overrides,
  });
  const location = res.headers.get("location");
  if (res.status !== 303 || !location) {
    throw new Error(`expected ticket creation to redirect, got ${res.status}`);
  }
  return location;
}

describe("submitting a ticket", () => {
  it("creates a ticket and redirects to its detail page", async () => {
    const path = await createTicket({ title: "Broken tap in kitchenette" });
    expect(path).toMatch(/^\/tickets\/\d+$/);

    const detail = await fetch(new URL(path, baseUrl));
    expect(detail.status).toBe(200);
    const html = await detail.text();
    expect(html).toContain("Broken tap in kitchenette");
    expect(html).toContain("Hanna Neumann Building");
    expect(html).toContain("Submitted");
  });

  it("persists across a later request", async () => {
    const path = await createTicket({ title: "Persistence check ticket" });
    const first = await (await fetch(new URL(path, baseUrl))).text();
    const second = await (await fetch(new URL(path, baseUrl))).text();
    expect(first).toContain("Persistence check ticket");
    expect(second).toContain("Persistence check ticket");
  });

  it("records the first history event on creation", async () => {
    const path = await createTicket({ title: "History on creation check" });
    const html = await (await fetch(new URL(path, baseUrl))).text();
    expect(html).toMatch(/History[\s\S]*Submitted/);
  });

  it("rejects an empty title with a field error and creates nothing", async () => {
    const res = await submitTicket({
      title: "",
      location: "Copland Building",
      category: "plumbing",
      description: "Something is wrong.",
    });
    expect(res.status).toBe(200);
    const html = await res.text();
    expect(html).toContain("Title is required");
  });

  it("rejects an invalid category", async () => {
    const res = await submitTicket({
      title: "Odd category ticket",
      location: "Copland Building",
      category: "not-a-real-category",
      description: "Something is wrong.",
    });
    expect(res.status).toBe(200);
    const html = await res.text();
    expect(html).toContain("Choose a category");
  });
});

describe("ticket list", () => {
  it("filters by category and finds tickets by search", async () => {
    const marker = Math.random().toString(36).slice(2);
    await createTicket({
      title: `Leaky sink ${marker}`,
      location: "Copland Building",
      category: "plumbing",
    });
    await createTicket({
      title: `Broken chair ${marker}`,
      location: "Copland Building",
      category: "furniture",
    });

    const filtered = await (await fetch(new URL("/?category=plumbing", baseUrl))).text();
    expect(filtered).toContain(`Leaky sink ${marker}`);
    expect(filtered).not.toContain(`Broken chair ${marker}`);

    const searched = await (
      await fetch(new URL(`/?q=${encodeURIComponent(`Broken chair ${marker}`)}`, baseUrl))
    ).text();
    expect(searched).toContain(`Broken chair ${marker}`);
    expect(searched).not.toContain(`Leaky sink ${marker}`);
  });
});

describe("demo admin status updates", () => {
  it("updates status and note in one step, visible in the history", async () => {
    const path = await createTicket({ title: "Admin update check ticket" });

    const update = await post(path, { status: "in_progress", note: "Technician dispatched." });
    expect(update.status).toBe(303);

    const html = await (await fetch(new URL(path, baseUrl))).text();
    expect(html).toContain("In progress");
    expect(html).toContain("Technician dispatched.");
  });
});

describe("reopening a resolved ticket", () => {
  it("allows moving a resolved ticket back to in_progress and labels it Reopened", async () => {
    const path = await createTicket({ title: "Reopen check ticket" });

    const resolve = await post(path, { status: "resolved", note: "Fixed it." });
    expect(resolve.status).toBe(303);

    const reopen = await post(path, { status: "in_progress", note: "Broke again." });
    expect(reopen.status).toBe(303);

    const html = await (await fetch(new URL(path, baseUrl))).text();
    expect(html).toContain("Reopened");
    expect(html).toContain("Broke again.");
  });
});

describe("similar open tickets", () => {
  it("suggests an existing unresolved ticket at the same location and category", async () => {
    const marker = Math.random().toString(36).slice(2);
    const location = `Similar Test Building ${marker}`;
    await createTicket({ title: `First light issue ${marker}`, location, category: "lighting" });

    const res = await fetch(
      new URL(
        `/api/similar-tickets.json?location=${encodeURIComponent(location)}&category=lighting`,
        baseUrl,
      ),
    );
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.tickets).toHaveLength(1);
    expect(data.tickets[0].title).toBe(`First light issue ${marker}`);
    expect(data.tickets[0].statusLabel).toBe("Submitted");
  });

  it("excludes resolved tickets and unrelated categories", async () => {
    const marker = Math.random().toString(36).slice(2);
    const location = `Similar Test Building 2 ${marker}`;
    const resolvedPath = await createTicket({
      title: `Resolved plumbing ${marker}`,
      location,
      category: "plumbing",
    });
    await post(resolvedPath, { status: "resolved", note: "Fixed." });
    await createTicket({ title: `Different category ${marker}`, location, category: "furniture" });

    const res = await fetch(
      new URL(
        `/api/similar-tickets.json?location=${encodeURIComponent(location)}&category=plumbing`,
        baseUrl,
      ),
    );
    const data = await res.json();
    expect(data.tickets).toHaveLength(0);
  });

  it("returns an empty list for a missing or invalid category", async () => {
    const res = await fetch(
      new URL("/api/similar-tickets.json?location=Somewhere&category=not-real", baseUrl),
    );
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.tickets).toEqual([]);
  });
});

describe("nonexistent tickets", () => {
  it("responds 404 for an unknown ticket id", async () => {
    const res = await fetch(new URL("/tickets/999999", baseUrl));
    expect(res.status).toBe(404);
  });

  it("responds 404 for a malformed ticket id", async () => {
    const res = await fetch(new URL("/tickets/not-a-number", baseUrl));
    expect(res.status).toBe(404);
  });
});
