-- ============================================================
-- BeatBunch CRM — Schema v2
-- Run this in Supabase SQL Editor (replaces v1)
-- ============================================================

-- Drop v1
drop table if exists contacts cascade;
drop table if exists leads    cascade;
drop type  if exists lead_stage    cascade;
drop type  if exists lead_source   cascade;
drop type  if exists contact_role  cascade;
drop function if exists update_updated_at cascade;

-- ============================================================
-- Types
-- ============================================================
create type lead_stage as enum (
  'new', 'contacted', 'trial_booked', 'trial_done', 'enrolled', 'lost'
);

create type lead_source as enum (
  'website', 'referral', 'walk_in', 'social_media', 'school_event', 'other'
);

create type contact_role as enum ('parent', 'adult', 'child');

-- ============================================================
-- contacts — a reusable person record
-- One row per real human; shared across multiple leads
-- ============================================================
create table contacts (
  id                  uuid primary key default gen_random_uuid(),
  user_id             uuid not null references auth.users(id) on delete cascade,
  role                contact_role not null,
  first_name          text not null,
  last_name           text not null,
  email               text,
  phone               text,
  date_of_birth       date,            -- mainly for children
  instrument_interest text,
  created_at          timestamptz not null default now()
);

-- ============================================================
-- contact_relationships — explicit parent ↔ child links
-- A parent can have many children; a child can have many parents
-- ============================================================
create table contact_relationships (
  parent_id uuid not null references contacts(id) on delete cascade,
  child_id  uuid not null references contacts(id) on delete cascade,
  primary key (parent_id, child_id),
  check (parent_id <> child_id)
);

-- ============================================================
-- leads — one pipeline entry per enquiry
-- ============================================================
create table leads (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  stage      lead_stage  not null default 'new',
  source     lead_source not null default 'other',
  notes      text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ============================================================
-- lead_contacts — which contacts are involved in a lead
-- One lead can involve a parent + multiple children, or a single adult
-- ============================================================
create table lead_contacts (
  lead_id    uuid not null references leads(id)    on delete cascade,
  contact_id uuid not null references contacts(id) on delete cascade,
  is_primary boolean not null default false,
  primary key (lead_id, contact_id)
);

-- ============================================================
-- Auto-update updated_at
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
-- Row Level Security
-- ============================================================
alter table contacts              enable row level security;
alter table contact_relationships enable row level security;
alter table leads                 enable row level security;
alter table lead_contacts         enable row level security;

-- contacts
create policy "Users manage own contacts" on contacts
  using  (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- contact_relationships (inherit through contacts)
create policy "Users manage own relationships" on contact_relationships
  using (
    exists (select 1 from contacts where id = parent_id and user_id = auth.uid())
  )
  with check (
    exists (select 1 from contacts where id = parent_id and user_id = auth.uid())
  );

-- leads
create policy "Users manage own leads" on leads
  using  (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- lead_contacts (inherit through leads)
create policy "Users manage own lead_contacts" on lead_contacts
  using (
    exists (select 1 from leads where id = lead_id and user_id = auth.uid())
  )
  with check (
    exists (select 1 from leads where id = lead_id and user_id = auth.uid())
  );

-- ============================================================
-- Indexes
-- ============================================================
create index contacts_user_id_idx          on contacts(user_id);
create index leads_user_id_idx             on leads(user_id);
create index leads_stage_idx               on leads(stage);
create index lead_contacts_lead_id_idx     on lead_contacts(lead_id);
create index lead_contacts_contact_id_idx  on lead_contacts(contact_id);
create index relationships_parent_id_idx   on contact_relationships(parent_id);
create index relationships_child_id_idx    on contact_relationships(child_id);

-- ============================================================
-- Enable Realtime
-- ============================================================
alter publication supabase_realtime add table leads;
alter publication supabase_realtime add table contacts;
alter publication supabase_realtime add table lead_contacts;
