-- ============================================================
-- BeatBunch CRM — Database Schema
-- Run this in Supabase SQL Editor
-- ============================================================

-- Lead pipeline stages
create type lead_stage as enum (
  'new',
  'contacted',
  'trial_booked',
  'trial_done',
  'enrolled',
  'lost'
);

-- How the lead found us
create type lead_source as enum (
  'website',
  'referral',
  'walk_in',
  'social_media',
  'school_event',
  'other'
);

-- Type of person in the lead
create type contact_role as enum (
  'parent',
  'adult',   -- adult enrolling themselves
  'child'    -- kid being enrolled by parent
);

-- ============================================================
-- leads — one row per enrollment inquiry
-- ============================================================
create table leads (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  stage       lead_stage not null default 'new',
  source      lead_source not null default 'other',
  notes       text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- ============================================================
-- contacts — the actual people linked to a lead
-- One lead can have: parent + child(ren), OR a single adult
-- ============================================================
create table contacts (
  id                  uuid primary key default gen_random_uuid(),
  lead_id             uuid not null references leads(id) on delete cascade,
  role                contact_role not null,
  first_name          text not null,
  last_name           text not null,
  email               text,
  phone               text,
  date_of_birth       date,           -- mainly for children
  instrument_interest text,           -- e.g. "Guitar", "Piano"
  created_at          timestamptz not null default now()
);

-- ============================================================
-- Auto-update updated_at on leads
-- ============================================================
create or replace function update_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger leads_updated_at
  before update on leads
  for each row execute function update_updated_at();

-- ============================================================
-- Row Level Security — users only see their own data
-- ============================================================
alter table leads    enable row level security;
alter table contacts enable row level security;

-- Leads policies
create policy "Users can view own leads"
  on leads for select using (auth.uid() = user_id);

create policy "Users can insert own leads"
  on leads for insert with check (auth.uid() = user_id);

create policy "Users can update own leads"
  on leads for update using (auth.uid() = user_id);

create policy "Users can delete own leads"
  on leads for delete using (auth.uid() = user_id);

-- Contacts policies (inherit access through the lead)
create policy "Users can view own contacts"
  on contacts for select using (
    exists (select 1 from leads where leads.id = contacts.lead_id and leads.user_id = auth.uid())
  );

create policy "Users can insert own contacts"
  on contacts for insert with check (
    exists (select 1 from leads where leads.id = contacts.lead_id and leads.user_id = auth.uid())
  );

create policy "Users can update own contacts"
  on contacts for update using (
    exists (select 1 from leads where leads.id = contacts.lead_id and leads.user_id = auth.uid())
  );

create policy "Users can delete own contacts"
  on contacts for delete using (
    exists (select 1 from leads where leads.id = contacts.lead_id and leads.user_id = auth.uid())
  );

-- ============================================================
-- Indexes for performance
-- ============================================================
create index leads_user_id_idx on leads(user_id);
create index leads_stage_idx   on leads(stage);
create index contacts_lead_id_idx on contacts(lead_id);

-- ============================================================
-- Enable Realtime on leads and contacts tables
-- Run this after the main schema
-- ============================================================
alter publication supabase_realtime add table leads;
alter publication supabase_realtime add table contacts;
