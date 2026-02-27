import { createClient } from "@/lib/supabase/client";
import type {
  Lead,
  LeadWithContacts,
  LeadStage,
  LeadSource,
  Contact,
  ContactRole,
} from "@/lib/types";

// ── Leads ─────────────────────────────────────────────────────

export async function getLeads(): Promise<LeadWithContacts[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("leads")
    .select("*, lead_contacts(is_primary, contact:contacts(*))")
    .order("created_at", { ascending: false });

  if (error) throw new Error(error.message);
  return data as LeadWithContacts[];
}

export async function getLead(id: string): Promise<LeadWithContacts | null> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("leads")
    .select("*, lead_contacts(is_primary, contact:contacts(*))")
    .eq("id", id)
    .single();

  if (error) return null;
  return data as LeadWithContacts;
}

export async function updateLeadStage(
  id: string,
  stage: LeadStage
): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase
    .from("leads")
    .update({ stage })
    .eq("id", id);
  if (error) throw new Error(error.message);
}

export async function deleteLead(id: string): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase.from("leads").delete().eq("id", id);
  if (error) throw new Error(error.message);
}

// ── Contacts ──────────────────────────────────────────────────

export async function getContactWithChildren(
  contactId: string
): Promise<(Contact & { children: Contact[] }) | null> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("contacts")
    .select(
      "*, children:contact_relationships!parent_id(child:contacts!child_id(*))"
    )
    .eq("id", contactId)
    .single();

  if (error) return null;

  // Flatten Supabase's nested join shape
  const raw = data as Contact & {
    children: { child: Contact }[];
  };
  return {
    ...raw,
    children: raw.children?.map((r) => r.child) ?? [],
  };
}

/** All leads linked to a specific contact (e.g. "all leads for this parent") */
export async function getLeadsForContact(
  contactId: string
): Promise<LeadWithContacts[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("lead_contacts")
    .select("lead:leads(*, lead_contacts(is_primary, contact:contacts(*)))")
    .eq("contact_id", contactId);

  if (error) throw new Error(error.message);
  return (data?.map((r) => r.lead).filter(Boolean) ?? []) as LeadWithContacts[];
}

// ── Create lead + contacts in one call ────────────────────────

type NewContact = {
  role: ContactRole;
  first_name: string;
  last_name: string;
  email?: string;
  phone?: string;
  date_of_birth?: string;
  instrument_interest?: string;
};

export async function createLeadWithContacts(input: {
  source: LeadSource;
  notes?: string;
  /**
   * Contacts in order: first non-child is marked is_primary.
   * Children are automatically linked to the first parent via
   * contact_relationships.
   */
  contacts: NewContact[];
}): Promise<LeadWithContacts> {
  const supabase = createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  // 1. Create the lead
  const { data: lead, error: leadError } = await supabase
    .from("leads")
    .insert({ source: input.source, notes: input.notes ?? null, user_id: user.id })
    .select()
    .single();
  if (leadError) throw new Error(leadError.message);

  // 2. Create contact records
  const { data: createdContacts, error: contactError } = await supabase
    .from("contacts")
    .insert(input.contacts.map((c) => ({ ...c, user_id: user.id })))
    .select();
  if (contactError) throw new Error(contactError.message);

  const contacts = createdContacts as Contact[];

  // 3. Link contacts → lead (first adult/parent is primary)
  const primaryIndex = contacts.findIndex(
    (c) => c.role === "parent" || c.role === "adult"
  );
  const { error: lcError } = await supabase.from("lead_contacts").insert(
    contacts.map((c, i) => ({
      lead_id: lead.id,
      contact_id: c.id,
      is_primary: i === (primaryIndex >= 0 ? primaryIndex : 0),
    }))
  );
  if (lcError) throw new Error(lcError.message);

  // 4. Link children → parent via contact_relationships
  const parent = contacts.find(
    (c) => c.role === "parent" || c.role === "adult"
  );
  const children = contacts.filter((c) => c.role === "child");

  if (parent && children.length > 0) {
    const { error: relError } = await supabase
      .from("contact_relationships")
      .insert(children.map((child) => ({ parent_id: parent.id, child_id: child.id })));
    if (relError) throw new Error(relError.message);
  }

  // 5. Return fully joined lead
  const full = await getLead(lead.id);
  if (!full) throw new Error("Failed to retrieve created lead");
  return full;
}
