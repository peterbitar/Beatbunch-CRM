// ── Enums ─────────────────────────────────────────────────────

export type LeadStage =
  | "new"
  | "contacted"
  | "trial_booked"
  | "trial_done"
  | "enrolled"
  | "lost";

export type LeadSource =
  | "website"
  | "referral"
  | "walk_in"
  | "social_media"
  | "school_event"
  | "other";

export type ContactRole = "parent" | "adult" | "child";

// ── Base rows ─────────────────────────────────────────────────

export interface Contact {
  id: string;
  user_id: string;
  role: ContactRole;
  first_name: string;
  last_name: string;
  email: string | null;
  phone: string | null;
  date_of_birth: string | null;
  instrument_interest: string | null;
  created_at: string;
}

export interface ContactWithChildren extends Contact {
  // children linked via contact_relationships
  children: Contact[];
}

export interface Lead {
  id: string;
  user_id: string;
  stage: LeadStage;
  source: LeadSource;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

// ── Joined types ──────────────────────────────────────────────

/** A contact as returned inside a lead_contacts join */
export interface LeadContactRow {
  is_primary: boolean;
  contact: Contact;
}

/** Lead with its full contact roster */
export interface LeadWithContacts extends Lead {
  lead_contacts: LeadContactRow[];
}

// ── Convenience helpers ───────────────────────────────────────

/** The primary adult/parent for a lead — the "face" of the enquiry */
export function getPrimaryContact(lead: LeadWithContacts): Contact | null {
  const primary = lead.lead_contacts.find((lc) => lc.is_primary);
  if (primary) return primary.contact;
  // Fallback: first parent or adult
  const fallback = lead.lead_contacts.find(
    (lc) => lc.contact.role === "parent" || lc.contact.role === "adult"
  );
  return fallback?.contact ?? lead.lead_contacts[0]?.contact ?? null;
}

/** All child contacts on a lead */
export function getChildren(lead: LeadWithContacts): Contact[] {
  return lead.lead_contacts
    .map((lc) => lc.contact)
    .filter((c) => c.role === "child");
}

/** All contacts flat */
export function getAllContacts(lead: LeadWithContacts): Contact[] {
  return lead.lead_contacts.map((lc) => lc.contact);
}

// ── Label maps ────────────────────────────────────────────────

export const STAGE_LABELS: Record<LeadStage, string> = {
  new:          "New",
  contacted:    "Contacted",
  trial_booked: "Trial Booked",
  trial_done:   "Trial Done",
  enrolled:     "Enrolled",
  lost:         "Lost",
};

export const STAGE_COLORS: Record<LeadStage, string> = {
  new:          "bg-slate-100 text-slate-700",
  contacted:    "bg-blue-100 text-blue-700",
  trial_booked: "bg-amber-100 text-amber-700",
  trial_done:   "bg-purple-100 text-purple-700",
  enrolled:     "bg-green-100 text-green-700",
  lost:         "bg-red-100 text-red-700",
};

export const SOURCE_LABELS: Record<LeadSource, string> = {
  website:      "Website",
  referral:     "Referral",
  walk_in:      "Walk-in",
  social_media: "Social Media",
  school_event: "School Event",
  other:        "Other",
};
