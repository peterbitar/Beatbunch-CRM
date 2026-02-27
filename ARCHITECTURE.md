# BeatBunch CRM — Technical Architecture

> Last updated: Feb 2026  
> Status: Prototype / Active development

---

## Overview

BeatBunch CRM is a school pipeline management tool for a music education business. It tracks leads (parents enrolling children, or adults enrolling themselves) through a kanban pipeline from first enquiry to enrolment.

---

## Tech Stack

| Layer | Technology | Version | Notes |
|---|---|---|---|
| Framework | Next.js (App Router) | 16.1.6 | Turbopack disabled — stability issues in v16 |
| Language | TypeScript | 5.x | Strict mode |
| Styling | Tailwind CSS | v4 | New CSS-first config (no tailwind.config.js) |
| Components | Shadcn/ui | 3.x | Radix UI primitives + Tailwind |
| Drag & Drop | @dnd-kit/core | 6.x | Kanban board |
| Auth & DB | Supabase | supabase-js 2.x, ssr 0.8 | PostgreSQL + RLS |
| Email | Resend | 6.x | Triggered transactional emails |
| Hosting | Vercel (planned) | — | `npm run build` passes cleanly |

---

## Project Structure

```
src/
├── app/
│   ├── auth/
│   │   ├── actions.ts          Server actions: login, signup, logout, seedDummyData
│   │   └── callback/route.ts   OAuth / magic link exchange handler
│   ├── email/
│   │   └── actions.ts          triggerStageEmail server action
│   ├── dashboard/page.tsx      Main app (pipeline board + add lead dialog)
│   ├── login/page.tsx          Login + signup tabs
│   ├── page.tsx                Root redirect (/ → /login or /dashboard)
│   ├── layout.tsx              Root layout + fonts
│   └── globals.css             Tailwind v4 + Shadcn CSS variables
│
├── components/
│   ├── leads/
│   │   ├── AddLeadForm.tsx     Form: adult OR parent + N children
│   │   └── LeadsList.tsx       Flat list view (used in testing)
│   ├── pipeline/
│   │   └── PipelineBoard.tsx   Kanban board with DnD + real-time
│   └── ui/                     Shadcn components (button, card, dialog, etc.)
│
├── lib/
│   ├── supabase/
│   │   ├── client.ts           Browser Supabase client (createBrowserClient)
│   │   └── server.ts           Server/RSC Supabase client (createServerClient)
│   ├── email/
│   │   ├── client.ts           Resend instance + FROM_ADDRESS
│   │   └── templates.ts        HTML email templates per stage
│   ├── leads.ts                All lead/contact CRUD functions
│   ├── types.ts                Shared TypeScript types + helper functions
│   └── utils.ts                Shadcn cn() utility
│
├── proxy.ts                    Auth route protection (Next.js 16 "proxy" convention)
│
supabase/
├── schema.sql                  v1 schema (superseded)
└── migration_v2.sql            Current schema — run this in Supabase SQL Editor
```

---

## Database Schema

```
contacts ←─────────────────── contact_relationships ──────────────────→ contacts
  (parent / adult)                parent_id / child_id                     (child)
         │
         └──────── lead_contacts ──────────→ leads
                  contact_id / lead_id        stage, source, notes
                  is_primary
```

### Tables

#### `contacts`
Reusable person records. A parent or adult can be linked to many leads without duplication.

| Column | Type | Notes |
|---|---|---|
| id | uuid PK | |
| user_id | uuid FK → auth.users | RLS owner |
| role | enum | `parent` \| `adult` \| `child` |
| first_name / last_name | text | |
| email | text nullable | Required for email triggers |
| phone | text nullable | |
| date_of_birth | date nullable | Mainly for children |
| instrument_interest | text nullable | e.g. "Piano", "Guitar" |

#### `contact_relationships`
Explicit parent → child links between contact records.

| Column | Type | Notes |
|---|---|---|
| parent_id | uuid FK → contacts | |
| child_id | uuid FK → contacts | |
| (composite PK) | | Prevents duplicates |

**Why this exists:** A parent who enquires about a second child later reuses their existing contact record. This table links them without duplicating data. A child can also have two parents (e.g. separated family both have accounts).

#### `leads`
One pipeline entry per enquiry.

| Column | Type | Notes |
|---|---|---|
| id | uuid PK | |
| user_id | uuid FK → auth.users | RLS owner |
| stage | enum | `new` → `contacted` → `trial_booked` → `trial_done` → `enrolled` \| `lost` |
| source | enum | `website` \| `referral` \| `walk_in` \| `social_media` \| `school_event` \| `other` |
| notes | text nullable | |
| created_at / updated_at | timestamptz | `updated_at` auto-maintained by trigger |

#### `lead_contacts`
Junction table linking people to a pipeline entry.

| Column | Type | Notes |
|---|---|---|
| lead_id | uuid FK → leads | |
| contact_id | uuid FK → contacts | |
| is_primary | boolean | The "face" of the enquiry — who to email |

### Row Level Security

All four tables have RLS enabled. The pattern:

- `contacts` / `leads` — `user_id = auth.uid()` on all operations
- `lead_contacts` / `contact_relationships` — inherit access by checking the parent record's `user_id`

This means every user is fully isolated — no cross-account data leakage.

---

## Authentication Flow

```
Browser → / → proxy.ts checks session → redirect to /login or /dashboard
               ↓
            /login (tabs: Sign in / Create account)
               ↓ server action (login / signup)
            Supabase Auth (email + password)
               ↓ session set in cookies
            /dashboard
               ↓ server action (logout)
            /login
```

- **Session storage:** HTTP-only cookies via `@supabase/ssr`
- **Session refresh:** `proxy.ts` calls `supabase.auth.getUser()` on every request, which silently refreshes the token
- **OAuth/magic links:** `/auth/callback/route.ts` exchanges the code for a session and redirects to `/dashboard`

---

## Data Flow: Creating a Lead

```
AddLeadForm (client)
  │
  ├── 1. supabase.from("leads").insert(...)           → leads table
  ├── 2. supabase.from("contacts").insert([...])      → contacts table (bulk)
  ├── 3. supabase.from("lead_contacts").insert([...]) → junction table
  └── 4. supabase.from("contact_relationships")       → parent→child links
           .insert([...])
  │
  └── 5. getLead(id) — re-fetch full joined record to return to UI
```

**Note:** Steps 1–4 are sequential client-side calls, not wrapped in a transaction. See Limitations.

---

## Data Flow: Moving a Lead (Drag & Drop)

```
PipelineBoard (client)
  │
  ├── 1. Optimistic update — setLeads() immediately reflects new stage in UI
  ├── 2. updateLeadStage(leadId, newStage) — client Supabase call
  │       └── On failure → revert optimistic update
  └── 3. triggerStageEmail(leadId, newStage) — fire-and-forget server action
              └── Fetches lead server-side
              └── Builds HTML template
              └── Sends via Resend API
```

---

## Real-Time Pipeline Updates

Supabase Realtime is subscribed to the `leads` table via `postgres_changes`.

| Event | Action |
|---|---|
| `UPDATE` | Patch the changed lead's stage in local state (no refetch) |
| `INSERT` | Full refetch (need contacts too, can't get from payload alone) |
| `DELETE` | Remove lead from local state by id |

**Channel name:** `pipeline-realtime`  
**Cleanup:** Channel is removed on component unmount via `useEffect` return.

---

## Email System

Emails are sent via Resend when a lead is dragged to a trigger stage.

### Trigger stages
`contacted` · `trial_booked` · `trial_done` · `enrolled`

### Personalisation
Templates check the contact roster and personalise:
- **Adult:** "Hi David, your trial lesson is confirmed!"
- **Parent + 1 child:** "Trial confirmed for Lucas!"
- **Parent + 2+ children:** "Trial confirmed for Emma and Liam!"
- Children's instrument interests are listed in the enrolled email

### Template structure
Pure HTML with inline styles (required for email client compatibility). No React Email dependency — keeps the build simple and avoids an extra package.

### FROM address
- **Testing:** `onboarding@resend.dev` (Resend sandbox, no domain needed)
- **Production:** Set `EMAIL_FROM` env var once your domain is verified in Resend

---

## Environment Variables

| Variable | Required | Description |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | ✅ | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | ✅ | Supabase publishable key |
| `RESEND_API_KEY` | ✅ | Resend API key (`re_...`) |
| `EMAIL_FROM` | Optional | Sender address. Defaults to `onboarding@resend.dev` |

---

## Known Limitations & Future Work

### 🔴 No database transactions
`createLeadWithContacts` makes 4 sequential Supabase calls. If call 3 fails, you end up with an orphaned lead and contacts with no junction entries. 

**Fix:** Wrap in a Postgres function (RPC) so it's atomic, or use Supabase Edge Functions.

### 🔴 Stage emails fire on every move, not just first time
If a card is moved to "Contacted", then back to "New", then back to "Contacted" again — the email fires twice.

**Fix:** Track `last_emailed_stage` on the lead, or log sent emails in an `email_log` table.

### 🟡 No contact deduplication
If a parent enquires twice (for different children), the form creates a second contact record for them rather than reusing the existing one. The schema supports reuse via `contact_relationships`, but the UI doesn't yet offer a "search existing contact" flow.

**Fix:** Add a contact search/autocomplete in the Add Lead form.

### 🟡 Only one parent per lead in the form
The `AddLeadForm` supports one parent + N children. The schema supports multiple parents (both parents could be linked), but the UI doesn't expose this.

**Fix:** Add a second parent field, same pattern as the children list.

### 🟡 Resend free tier delivery restriction
On Resend's free plan, emails only deliver to your verified account email address. All other addresses appear in the Resend dashboard but are not actually delivered to inboxes.

**Fix:** Verify your sending domain in Resend (Settings → Domains). Free tier supports 3,000 emails/month.

### 🟡 No email for `new` → `contacted` from the form
Adding a new lead via the form doesn't trigger the "contacted" email — only dragging the card to "contacted" on the board does. The stage is `new` by default.

**Fix:** Option to trigger a "thanks for enquiring" email immediately on lead creation.

### 🟡 Real-time INSERT does a full refetch
When a new lead is inserted (by another session), the board does a full `getLeads()` call instead of using the realtime payload. This is because the payload doesn't include the joined contacts.

**Fix:** Subscribe to `lead_contacts` changes separately and stitch them together, or use Supabase's broadcast channel for a more structured approach.

### 🟢 Next.js 16 proxy convention
Next.js 16 renamed `middleware.ts` → `proxy.ts` and the exported function from `middleware` → `proxy`. The codebase follows the new convention. Note: this is a breaking change from all Next.js 13/14/15 documentation.

### 🟢 Tailwind v4 CSS-first config
Tailwind v4 no longer uses `tailwind.config.js` — configuration lives in `globals.css` via `@theme`. Shadcn v3 supports this. Be aware when reading older Tailwind docs.

---

## Deployment Checklist (Vercel)

- [ ] Set all env vars in Vercel project settings
- [ ] Add production URL to Supabase → Auth → URL Configuration → Redirect URLs
- [ ] Verify sending domain in Resend → update `EMAIL_FROM`
- [ ] Run `migration_v2.sql` on production Supabase project
- [ ] Enable Realtime on `leads`, `lead_contacts`, `contacts` tables
- [ ] Test login, lead creation, drag-and-drop, and email end-to-end

---

## What's Next

Suggested next features in priority order:

1. **Lead detail panel** — click a card to see full contact info, add notes, change stage, view email history
2. **Contact deduplication** — search existing contacts when adding a lead
3. **Atomic lead creation** — Supabase RPC to wrap the 4-step create in a transaction
4. **Email log** — `email_log` table to track what was sent and when, prevent duplicates
5. **Multiple users / team** — currently single-user per account; add team invites
6. **Stripe payments** — link enrolled leads to invoices / subscriptions
