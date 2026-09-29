import type { APIRoute } from "astro";
import { listOpenTicketsByLocationAndCategory } from "../../lib/db";
import { STATUS_LABELS } from "../../lib/labels";
import { TICKET_CATEGORIES, type TicketCategory, type TicketStatus } from "../../lib/schema";

// A read-only lookup for the report form's "similar open tickets" prompt
// (see the fetch() in report.astro). GET-only and unauthenticated, same as
// every other page here — this reads the same tickets the list page shows,
// just filtered server-side instead of client-side.
export const GET: APIRoute = async ({ url }) => {
  const location = url.searchParams.get("location")?.trim() ?? "";
  const category = url.searchParams.get("category")?.trim() ?? "";

  if (!location || !TICKET_CATEGORIES.includes(category as TicketCategory)) {
    return Response.json({ tickets: [] });
  }

  const tickets = listOpenTicketsByLocationAndCategory(location, category as TicketCategory);
  return Response.json({
    tickets: tickets.map((ticket) => ({
      id: ticket.id,
      title: ticket.title,
      status: ticket.status,
      statusLabel: STATUS_LABELS[ticket.status as TicketStatus],
    })),
  });
};
