import type { TicketCategory, TicketStatus } from "./schema";

export const STATUS_LABELS: Record<TicketStatus, string> = {
  submitted: "Submitted",
  in_progress: "In progress",
  resolved: "Resolved",
};

export const CATEGORY_LABELS: Record<TicketCategory, string> = {
  lighting: "Lighting",
  plumbing: "Plumbing",
  furniture: "Furniture",
  hvac: "Air conditioning (HVAC)",
  other: "Other",
};
