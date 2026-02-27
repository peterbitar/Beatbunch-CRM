"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export async function login(formData: FormData) {
  const supabase = await createClient();

  const { error } = await supabase.auth.signInWithPassword({
    email: formData.get("email") as string,
    password: formData.get("password") as string,
  });

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/", "layout");
  redirect("/dashboard");
}

export async function signup(formData: FormData) {
  const supabase = await createClient();

  const { data, error } = await supabase.auth.signUp({
    email: formData.get("email") as string,
    password: formData.get("password") as string,
  });

  if (error) {
    return { error: error.message };
  }

  // If session is null, email confirmation is required
  if (!data.session) {
    return { confirmEmail: true };
  }

  revalidatePath("/", "layout");
  redirect("/dashboard");
}

export async function logout() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  revalidatePath("/", "layout");
  redirect("/login");
}

export async function seedDummyData() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const dummies: Array<{
    stage: string;
    source: string;
    notes?: string;
    contacts: Array<{
      role: string;
      first_name: string;
      last_name: string;
      email?: string;
      phone?: string;
      date_of_birth?: string;
      instrument_interest?: string;
    }>;
  }> = [
    {
      stage: "new", source: "website", notes: "Enquired via contact form",
      contacts: [
        { role: "parent", first_name: "Sarah", last_name: "Johnson", email: "sarah.j@example.com", phone: "0412 345 678" },
        { role: "child", first_name: "Emma", last_name: "Johnson", date_of_birth: "2015-03-12", instrument_interest: "Piano" },
        { role: "child", first_name: "Liam", last_name: "Johnson", date_of_birth: "2017-07-22", instrument_interest: "Drums" },
      ],
    },
    {
      stage: "new", source: "social_media",
      contacts: [
        { role: "adult", first_name: "David", last_name: "Park", email: "dpark@example.com", phone: "0421 987 654", instrument_interest: "Guitar" },
      ],
    },
    {
      stage: "contacted", source: "referral", notes: "Referred by the Chen family",
      contacts: [
        { role: "parent", first_name: "Maria", last_name: "Santos", email: "maria.santos@example.com", phone: "0435 111 222" },
        { role: "child", first_name: "Lucas", last_name: "Santos", date_of_birth: "2016-11-05", instrument_interest: "Violin" },
      ],
    },
    {
      stage: "contacted", source: "website",
      contacts: [
        { role: "adult", first_name: "Yuki", last_name: "Tanaka", email: "yuki.t@example.com", phone: "0445 333 444", instrument_interest: "Piano" },
      ],
    },
    {
      stage: "trial_booked", source: "school_event", notes: "Trial booked for Saturday 10am",
      contacts: [
        { role: "parent", first_name: "James", last_name: "Wilson", email: "jwilson@example.com", phone: "0456 555 666" },
        { role: "child", first_name: "Olivia", last_name: "Wilson", date_of_birth: "2014-06-18", instrument_interest: "Guitar" },
        { role: "child", first_name: "Noah", last_name: "Wilson", date_of_birth: "2018-02-14", instrument_interest: "Piano" },
      ],
    },
    {
      stage: "trial_booked", source: "referral",
      contacts: [
        { role: "adult", first_name: "Priya", last_name: "Sharma", email: "priya.s@example.com", phone: "0467 777 888", instrument_interest: "Singing" },
      ],
    },
    {
      stage: "trial_done", source: "walk_in", notes: "Trial went well, following up",
      contacts: [
        { role: "parent", first_name: "Tom", last_name: "Baker", email: "tbaker@example.com", phone: "0478 999 000" },
        { role: "child", first_name: "Isla", last_name: "Baker", date_of_birth: "2016-09-30", instrument_interest: "Drums" },
      ],
    },
    {
      stage: "enrolled", source: "website",
      contacts: [
        { role: "adult", first_name: "Chris", last_name: "Lee", email: "chris.lee@example.com", phone: "0489 123 456", instrument_interest: "Bass Guitar" },
      ],
    },
    {
      stage: "enrolled", source: "referral", notes: "Enrolled in Saturday group class",
      contacts: [
        { role: "parent", first_name: "Anna", last_name: "Mueller", email: "anna.m@example.com", phone: "0490 234 567" },
        { role: "child", first_name: "Sophie", last_name: "Mueller", date_of_birth: "2015-12-01", instrument_interest: "Piano" },
      ],
    },
    {
      stage: "lost", source: "social_media", notes: "Went with a competitor",
      contacts: [
        { role: "adult", first_name: "Ben", last_name: "Taylor", email: "ben.t@example.com", phone: "0401 345 678", instrument_interest: "Guitar" },
      ],
    },
  ];

  for (const dummy of dummies) {
    // 1. Create lead
    const { data: lead, error: leadErr } = await supabase
      .from("leads")
      .insert({ user_id: user.id, stage: dummy.stage, source: dummy.source, notes: dummy.notes ?? null })
      .select()
      .single();
    if (leadErr || !lead) continue;

    // 2. Create contacts
    const { data: contacts, error: contactErr } = await supabase
      .from("contacts")
      .insert(dummy.contacts.map((c) => ({ ...c, user_id: user.id })))
      .select();
    if (contactErr || !contacts) continue;

    // 3. Link contacts → lead
    const primaryIdx = contacts.findIndex(
      (c) => c.role === "parent" || c.role === "adult"
    );
    await supabase.from("lead_contacts").insert(
      contacts.map((c: { id: string }, i: number) => ({
        lead_id: lead.id,
        contact_id: c.id,
        is_primary: i === (primaryIdx >= 0 ? primaryIdx : 0),
      }))
    );

    // 4. Link children → parent
    const parent = contacts.find(
      (c: { role: string }) => c.role === "parent" || c.role === "adult"
    );
    const children = contacts.filter((c: { role: string }) => c.role === "child");
    if (parent && children.length > 0) {
      await supabase.from("contact_relationships").insert(
        children.map((child: { id: string }) => ({ parent_id: parent.id, child_id: child.id }))
      );
    }
  }

  revalidatePath("/dashboard");
  return { success: true };
}
