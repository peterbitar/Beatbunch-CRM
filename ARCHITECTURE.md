# BeatBunch CRM — Technical Architecture

> Last updated: Mar 2026  
> Status: Active development — Schema v9

---

## Overview

BeatBunch CRM is a multi-school pipeline management tool for music education businesses. It tracks leads (parents enrolling children, or adults enrolling themselves) through a kanban pipeline from first enquiry to enrolment, and maintains a full activity history for every lead and contact.

Each **school** is an isolated tenant. Multiple staff members share the same contacts, leads, and pipeline data within a school. Attendance, class schedules, and pricing are owned by a third-party system; the CRM bridges to it via `external_class_id` references on enrollment records.

---

## Tech Stack

| Layer | Technology | Version | Notes |
|---|---|---|---|
| Framework | Next.js (App Router) | 16.1.6 | Turbopack disabled — stability issues in v16 |
| Language | TypeScript | 5.x | Strict mode |
| Styling | Tailwind CSS | v4 | CSS-first config — no `tailwind.config.js` |
| Components | Shadcn/ui | 3.x | Radix UI primitives + Tailwind |
| Drag & Drop | @dnd-kit/core | 6.x | Kanban board |
| Auth & DB | Supabase | supabase-js 2.x, ssr 0.8 | PostgreSQL + RLS |
| Email | Resend | 6.x | Transactional emails + open/click tracking via webhooks |
| Hosting | Vercel (planned) | — | `npm run build` passes cleanly |

---

## Project Structure

```
src/
├── app/
│   ├── auth/
│   │   ├── actions.ts              Server actions: login, signup, logout, seedDummyData
│   │   └── callback/route.ts       OAuth / magic link exchange handler
│   ├── email/
│   │   └── actions.ts              triggerStageEmail server action (stores resend_id + tags on send)
│   ├── dashboard/
│   │   ├── page.tsx                Main app (pipeline board + add lead dialog)
│   │   └── leads/[id]/page.tsx     Lead detail page (editable info, student cards, activity timeline, email engagement metrics)
│   ├── login/page.tsx              Login + signup tabs
│   ├── page.tsx                    Root redirect (/ → /login or /dashboard)
│   ├── layout.tsx                  Root layout + fonts
│   └── globals.css                 Tailwind v4 + Shadcn CSS variables
│
├── components/
│   ├── leads/
│   │   ├── AddLeadForm.tsx         Form: adult OR parent + N children (requires schoolId prop)
│   │   └── LeadsList.tsx           Flat list view (used in testing)
│   ├── pipeline/
│   │   └── PipelineBoard.tsx       Kanban board with DnD + click-to-navigate + per-student badges
│   └── ui/                         Shadcn + custom components (button, card, dialog, select, textarea, …)
│
├── lib/
│   ├── supabase/
│   │   ├── client.ts               Browser Supabase client (createBrowserClient)
│   │   └── server.ts               Server/RSC Supabase client (createServerClient)
│   ├── email/
│   │   ├── client.ts               Resend instance + FROM_ADDRESS
│   │   └── templates.ts            HTML email templates per pipeline stage
│   ├── leads.ts                    All lead/contact/teacher/enrollment/trial CRUD
│   ├── activities.ts               Activity log: createActivity + all logXxx helpers
│   ├── types.ts                    Shared TypeScript types, interfaces, label maps
│   └── utils.ts                    Shadcn cn() utility
│
├── proxy.ts                        Auth route protection (Next.js 16 "proxy" convention)
│
supabase/
├── schema.sql                      v1 schema (superseded)
├── migration_v2.sql                v2 schema (superseded)
├── migration_v3.sql                v3 schema (superseded)
├── migration_v4.sql                v4: per-student stage/teacher/level/instruments; drops lead-level equivalents
├── migration_v5.sql                v5: is_student flag on lead_contacts
├── migration_v6.sql                v6: default parent contacts to is_student = false
├── migration_v7.sql                v7: email_templates table
├── migration_v8.sql                v8: automation_rules + automation_executions tables
├── migration_v9.sql                v9: GIN index on activities.metadata for email tracking lookups
│
└── functions/
    ├── run-automations/index.ts    Hourly cron — fires automation rules, sends emails via Resend
    └── resend-webhook/index.ts     Receives email.opened / email.clicked webhooks from Resend
```

---

## Database Schema

### Entity Map

```
auth.users
    │
    └── school_members (role: owner | admin | teacher | staff)
              │
              └── schools ──────────────────────────────────────────────────────┐
                    │                                                            │
                    ├── instruments (Piano, Guitar, …)                          │
                    ├── levels (Beginner, Grade 1, …)                           │
                    │                                                            │
                    ├── teachers ──── teacher_instruments ──── instruments      │
                    │                                                            │
                    ├── contacts ──── contact_relationships (parent ↔ child)    │
                    │                                                            │
                    ├── leads ──── lead_contacts ──── contacts                  │
                    │                   │  (is_primary, is_student, stage)      │
                    │                   ├── assigned_teacher (FK → teachers)    │
                    │                   ├── level (FK → levels)                 │
                    │                   └── lead_contact_instruments            │
                    │                            └── instruments                │
                    │                                                            │
                    ├── trial_lessons (teacher + instrument + level + status)   │
                    │                                                            │
                    ├── enrollments (external_class_id → third-party system)    │
                    │                                                            │
                    └── activities (append-only timeline per lead/contact) ─────┘
```

### Enums

| Enum | Values |
|---|---|
| `school_role` | `owner`, `admin`, `teacher`, `staff` |
| `lead_stage` | `new`, `contacted`, `trial_booked`, `trial_done`, `enrolled`, `lost` |
| `lead_source` | `website`, `referral`, `walk_in`, `social_media`, `school_event`, `other` |
| `contact_role` | `parent`, `adult`, `child` |
| `trial_status` | `pending`, `confirmed`, `completed`, `cancelled`, `no_show` |
| `enrollment_status` | `active`, `paused`, `cancelled`, `completed` |
| `activity_type` | 32 values — see Activities section |

### Tables

#### `schools`
Top-level tenant record. Every other piece of data hangs off `school_id`.

| Column | Type | Notes |
|---|---|---|
| id | uuid PK | |
| name | text | |
| slug | text unique | URL-safe identifier |
| created_at | timestamptz | |

#### `school_members`
Links `auth.users` to schools with a role. Drives all RLS policies.

| Column | Type | Notes |
|---|---|---|
| school_id | uuid FK → schools | composite PK |
| user_id | uuid FK → auth.users | composite PK |
| role | school_role | `owner` \| `admin` \| `teacher` \| `staff` |
| created_at | timestamptz | |

#### `instruments`
Per-school list of instruments offered.

| Column | Type | Notes |
|---|---|---|
| id | uuid PK | |
| school_id | uuid FK → schools | |
| name | text | e.g. "Piano", "Guitar" |
| created_at | timestamptz | unique per school |

#### `levels`
Per-school skill levels shown on student cards, teachers, and trial/enrollment records.

| Column | Type | Notes |
|---|---|---|
| id | uuid PK | |
| school_id | uuid FK → schools | |
| name | text | e.g. "Beginner", "Grade 1" |
| sort_order | int | display ordering |
| created_at | timestamptz | unique per school |

#### `teachers`
Teaching staff. `user_id` is nullable — a teacher may exist as a CRM record without a login.

| Column | Type | Notes |
|---|---|---|
| id | uuid PK | |
| school_id | uuid FK → schools | |
| user_id | uuid FK → auth.users nullable | login account if any |
| first_name / last_name | text | |
| email / phone | text nullable | |
| bio | text nullable | |
| created_at | timestamptz | |

#### `teacher_instruments`
Junction: which instruments a teacher can teach.

| Column | Type |
|---|---|
| teacher_id | uuid FK → teachers (composite PK) |
| instrument_id | uuid FK → instruments (composite PK) |

#### `contacts`
Reusable person records — parents, adults, children. A contact is shared across all leads that involve them.

| Column | Type | Notes |
|---|---|---|
| id | uuid PK | |
| school_id | uuid FK → schools | shared across staff |
| role | contact_role | `parent` \| `adult` \| `child` |
| first_name / last_name | text | |
| email | text nullable | used for email triggers |
| phone | text nullable | |
| date_of_birth | date nullable | mainly for children |
| created_at | timestamptz | |

#### `contact_relationships`
Explicit parent → child links. Enables a parent to be reused across multiple leads and supports children with multiple parents.

| Column | Type |
|---|---|
| parent_id | uuid FK → contacts (composite PK) |
| child_id | uuid FK → contacts (composite PK) |

#### `leads`
One pipeline entry per enquiry. Stage is the kanban column position only — individual student progress is tracked in `lead_contacts`.

| Column | Type | Notes |
|---|---|---|
| id | uuid PK | |
| school_id | uuid FK → schools | |
| stage | lead_stage | kanban column position |
| source | lead_source | how they found the school |
| notes | text nullable | |
| created_at / updated_at | timestamptz | `updated_at` auto-maintained by trigger |

> **Note:** `assigned_teacher_id` and `level_id` were removed from `leads` in v4. Teacher and level assignment now live per student in `lead_contacts`.

#### `lead_contacts`
Junction: every contact on a lead, with per-student assignment and pipeline tracking.

| Column | Type | Notes |
|---|---|---|
| lead_id | uuid FK → leads | composite PK |
| contact_id | uuid FK → contacts | composite PK |
| is_primary | boolean | marks who receives system emails |
| is_student | boolean | whether this contact is also a student; parents default to `false`, adults and children default to `true` |
| stage | lead_stage | this student's individual pipeline stage |
| assigned_teacher_id | uuid FK → teachers nullable | teacher assigned to this student |
| level_id | uuid FK → levels nullable | skill level for this student |

**Kanban vs. student stage:** `leads.stage` determines which kanban column a card sits in. `lead_contacts.stage` tracks where each individual student is in the process. For adult leads (a single adult learner), changing the student's stage automatically syncs to `leads.stage` so there is no duplication. For parent+children leads, both can diverge — e.g. one child is enrolled while another is lost.

#### `lead_contact_instruments`
Per-student instruments of interest. Replaces the old lead-level `lead_instruments` table (dropped in v4).

| Column | Type |
|---|---|
| lead_id | uuid FK → leads (composite PK) |
| contact_id | uuid FK → contacts (composite PK) |
| instrument_id | uuid FK → instruments (composite PK) |

Foreign key on `(lead_id, contact_id)` references `lead_contacts`.

#### `trial_lessons`
CRM-owned booking record for a trial lesson.

| Column | Type | Notes |
|---|---|---|
| id | uuid PK | |
| school_id | uuid FK → schools | |
| lead_id | uuid FK → leads nullable | |
| teacher_id | uuid FK → teachers nullable | |
| instrument_id | uuid FK → instruments | |
| level_id | uuid FK → levels nullable | |
| scheduled_at | timestamptz | |
| duration_minutes | int | default 30 |
| status | trial_status | `pending` → `confirmed` → `completed` \| `cancelled` \| `no_show` |
| notes | text nullable | |
| created_at | timestamptz | |

#### `enrollments`
Lightweight CRM reference. The third party owns class schedules, attendance, and pricing.

| Column | Type | Notes |
|---|---|---|
| id | uuid PK | |
| school_id | uuid FK → schools | |
| contact_id | uuid FK → contacts | the enrolled student |
| teacher_id | uuid FK → teachers nullable | |
| instrument_id | uuid FK → instruments | |
| level_id | uuid FK → levels nullable | |
| external_class_id | text nullable | FK into third-party class system |
| status | enrollment_status | `active` \| `paused` \| `cancelled` \| `completed` |
| enrolled_at | date | |
| ended_at | date nullable | set when status leaves `active` |
| notes | text nullable | |
| created_at | timestamptz | |

#### `activities`
Append-only timeline for every lead and contact. Covers both system-generated events and manually recorded interactions.

| Column | Type | Notes |
|---|---|---|
| id | uuid PK | |
| school_id | uuid FK → schools | |
| lead_id | uuid FK → leads nullable | |
| contact_id | uuid FK → contacts nullable | |
| type | activity_type | see table below |
| performed_by | uuid FK → auth.users nullable | null = system/automated |
| body | text nullable | human-readable summary |
| metadata | jsonb nullable | per-type structured data |
| occurred_at | timestamptz | can be backdated for manual entries |
| is_system | boolean | true = auto-logged; false = staff-recorded |
| created_at | timestamptz | |

**Activity types by category:**

| Category | Types |
|---|---|
| Pipeline | `lead_created`, `stage_changed` |
| Communication | `email_sent`, `email_received`, `call_outbound`, `call_inbound`, `sms_sent`, `sms_received`, `whatsapp_sent`, `whatsapp_received`, `in_person`, `voicemail_left` |
| Notes | `note` |
| Trial | `trial_scheduled`, `trial_confirmed`, `trial_completed`, `trial_cancelled`, `trial_no_show` |
| Enrollment | `enrolled`, `enrollment_paused`, `enrollment_cancelled`, `enrollment_resumed` |
| Financial | `invoice_sent`, `payment_received`, `payment_overdue`, `refund_issued`, `payment_plan_agreed` |
| Assignments | `teacher_assigned`, `teacher_changed`, `level_changed` |
| Documents | `document_sent` |
| Tasks | `task_created`, `task_completed` |
| Other | `custom` |

**`metadata` shapes for key types:**

```jsonc
// stage_changed
{ "from": "new", "to": "contacted" }

// email_sent (auto)
{ "subject": "Trial confirmed!", "to": "parent@example.com", "resend_id": "re_..." }

// call_outbound / call_inbound
{ "duration_minutes": 5, "outcome": "Left voicemail" }

// invoice_sent / payment_received
{ "amount": 150.00, "currency": "AUD", "external_invoice_id": "inv_..." }

// trial_scheduled
{ "trial_lesson_id": "uuid", "scheduled_at": "2026-03-15T10:00:00Z" }

// teacher_assigned
{ "teacher_id": "uuid", "teacher_name": "Jane Doe" }

// document_sent
{ "document_name": "Welcome Pack", "method": "email" }
```

### Row Level Security

All tables have RLS enabled. Data ownership is scoped to school membership.

**Universal policy pattern:**

```sql
school_id IN (
  SELECT school_id FROM school_members WHERE user_id = auth.uid()
)
```

Junction tables (`lead_contacts`, `lead_contact_instruments`, `teacher_instruments`) inherit access by checking the parent record's `school_id` through a subquery.

Additional role guards apply for destructive operations — only `owner` can delete a school; only `owner`/`admin` can update school settings.

---

## Authentication Flow

```
Browser → / → proxy.ts checks session → redirect to /login or /dashboard
               ↓
            /login (tabs: Sign in / Create account)
               ↓ server action (login / signup)
            Supabase Auth (email + password)
               ↓ session set in cookies
            /dashboard (loads school_id via getCurrentSchoolId())
               ↓ server action (logout)
            /login
```

- **Session storage:** HTTP-only cookies via `@supabase/ssr`
- **Session refresh:** `proxy.ts` calls `supabase.auth.getUser()` on every request
- **OAuth/magic links:** `/auth/callback/route.ts` exchanges the code for a session
- **School resolution:** `getCurrentSchoolId()` in `leads.ts` fetches the user's first `school_members` row. Multi-school switching is a future addition.

---

## Data Flow: Creating a Lead

```
AddLeadForm (client) — requires schoolId prop from dashboard
  │
  ├── 1. leads.insert({ school_id, source, notes })              → leads
  ├── 2. contacts.insert([…contacts], { school_id })             → contacts (bulk)
  ├── 3. lead_contacts.insert([…])                               → junction
  │         is_student defaults: parent=false, adult=true, child=true
  ├── 4. contact_relationships.insert([…])                       → parent→child links
  ├── 5. logLeadCreated() fire-and-forget                        → activities
  └── 6. getLead(id) — full joined re-fetch returned to UI
```

**Note:** Steps 1–5 are sequential client-side calls, not wrapped in a transaction. See Limitations.

---

## Data Flow: Moving a Lead (Drag & Drop)

```
PipelineBoard (client)
  │
  ├── 1. Optimistic update — setLeads() immediately reflects new stage in UI
  ├── 2. updateLeadStage(leadId, newStage)
  │       ├── SELECT school_id, stage FROM leads (capture from-stage)
  │       ├── UPDATE leads SET stage = newStage
  │       ├── logStageChanged() fire-and-forget          → activities
  │       └── On error → revert optimistic update
  └── 3. triggerStageEmail(leadId, newStage) — fire-and-forget server action
              ├── Fetches lead server-side
              ├── Builds HTML template
              ├── Sends via Resend API
              └── Inserts email_sent activity row        → activities
```

---

## Data Flow: Lead Detail Page

```
/dashboard/leads/[id]/page.tsx (client component)
  │
  ├── getLead(id)                          → LeadWithDetails (lead + per-student rows)
  ├── getTeachers / getLevels / getInstruments
  ├── getActivitiesForLead(id)             → ActivityWithDetails[]
  │
  ├── Left column
  │     ├── Lead Details (source, date added)
  │     │     └── Pipeline stage select  — hidden for adult leads (student stage is the source of truth)
  │     ├── Lead Notes (free-text, auto-saved)
  │     └── Students section — one StudentCard per lead_contact
  │           ├── Adult card:   stage select at top (syncs → leads.stage); teacher, level, instruments below
  │           ├── Child card:   stage badge at top; stage select + teacher, level, instruments in body
  │           └── Parent card:  "Also a student" checkbox (default unchecked)
  │                             → when checked: shows stage, teacher, level, instruments
  │
  ├── Right column — Activity timeline (chronological, icon per type)
  │
  └── Log Interaction panel
        ├── Type picker: Note | Email | Call | SMS | WhatsApp | In Person | Voicemail
        ├── Direction toggle (Sent/Received or Made/Received) for communication types
        ├── Context-sensitive fields (subject + body for email; outcome + duration for call; etc.)
        └── Calls logXxx() from activities.ts on submit → activities
```

**Adult stage sync:** When a student with `contact.role === "adult"` changes their stage in the StudentCard, `updateLeadStage()` is also called to keep `leads.stage` (the kanban position) in sync. This means staff set it in one place only.

**Click vs. drag:** `PipelineBoard` tracks pointer movement via refs to distinguish a genuine click (< 4 px movement) from a drag, so card clicks navigate to the detail page without interfering with DnD.

---

## Data Flow: Per-Student Mutations

```
updateLeadContactStage(leadId, contactId, stage)
  └── UPDATE lead_contacts SET stage = $stage

updateLeadContactTeacher(leadId, contactId, teacherId)
  └── UPDATE lead_contacts SET assigned_teacher_id = $teacherId

updateLeadContactLevel(leadId, contactId, levelId)
  └── UPDATE lead_contacts SET level_id = $levelId

setLeadContactInstruments(leadId, contactId, instrumentIds)
  ├── DELETE FROM lead_contact_instruments WHERE lead_id + contact_id
  └── INSERT lead_contact_instruments (lead_id, contact_id, instrument_id) × N

updateLeadContactIsStudent(leadId, contactId, isStudent)
  └── UPDATE lead_contacts SET is_student = $isStudent
```

All mutations are called directly from the `StudentCard` client component (auto-save on change; instruments save on explicit button press).

---

## Data Flow: Trial Lessons

```
createTrialLesson(input)
  ├── INSERT into trial_lessons
  └── logTrialScheduled() fire-and-forget                → activities

updateTrialLessonStatus(id, status)
  ├── SELECT school_id, lead_id FROM trial_lessons
  ├── UPDATE trial_lessons SET status
  └── logTrialStatusChanged() fire-and-forget            → activities
      (for: confirmed, completed, cancelled, no_show)
```

---

## Data Flow: Enrollments

```
createEnrollment(input)
  ├── INSERT into enrollments
  └── logEnrolled() fire-and-forget                      → activities

updateEnrollmentStatus(id, status)
  ├── SELECT school_id, contact_id FROM enrollments
  ├── UPDATE enrollments SET status + ended_at
  └── logEnrollmentStatusChanged() fire-and-forget       → activities
      (for: paused, cancelled, resumed)
```

---

## Activities System

`src/lib/activities.ts` is the single entry point for all timeline data.

### Auto-logged (is_system = true)

These fire without any staff action:

| Trigger | Activity type |
|---|---|
| Lead created | `lead_created` |
| Stage changed via drag | `stage_changed` |
| Email sent via Resend | `email_sent` |
| Trial lesson created | `trial_scheduled` |
| Trial status updated | `trial_confirmed / completed / cancelled / no_show` |
| Enrollment created | `enrolled` |
| Enrollment status updated | `enrollment_paused / cancelled / resumed` |

All auto-log calls are fire-and-forget (`.catch(() => {})`) — a logging failure never blocks the main operation.

### Manually recorded (is_system = false)

Staff record interactions via the Log Interaction panel on the lead detail page, which calls helpers in `activities.ts`:

```
logNote()               — free text note
logCall()               — outbound or inbound phone call
logSms()                — SMS sent or received
logWhatsApp()           — WhatsApp message sent or received
logInPerson()           — face-to-face meeting
logVoicemail()          — voicemail left
logManualEmail()        — email sent or received (not via Resend)
logDocument()           — document or form sent
logInvoiceSent()        — invoice raised (third party is source of truth)
logPaymentReceived()    — payment confirmed
logPaymentOverdue()     — payment flagged overdue
logRefundIssued()       — refund processed
logPaymentPlanAgreed()  — payment plan set up
logTeacherAssigned()    — teacher assigned or changed on a lead
logLevelChanged()       — skill level updated
logCustom()             — anything else
```

All manual helpers accept an optional `occurred_at` parameter for backdating ("I called them yesterday").

### Reading the timeline

```typescript
getActivitiesForLead(leadId)       // timeline for one lead
getActivitiesForContact(contactId) // all activity across all a contact's leads
getActivitiesForSchool(schoolId)   // recent activity across the whole school
```

---

## TypeScript Types

Key interfaces in `src/lib/types.ts`:

```typescript
// Pipeline/kanban position only — no assignment columns
interface Lead {
  id: string; school_id: string; stage: LeadStage;
  source: LeadSource; notes: string | null;
  created_at: string; updated_at: string;
}

// Lightweight row for list queries (pipeline board)
interface LeadContactRow {
  is_primary: boolean;
  is_student: boolean;       // false by default for parents
  stage: LeadStage;          // this student's stage
  contact: Contact;
}

// Full row with joins for the detail page
interface LeadContactWithDetails extends LeadContactRow {
  assigned_teacher_id: string | null;
  level_id: string | null;
  assigned_teacher: Teacher | null;
  level: Level | null;
  instruments: Instrument[];
}

interface LeadWithContacts extends Lead { lead_contacts: LeadContactRow[]; }
interface LeadWithDetails  extends Lead { lead_contacts: LeadContactWithDetails[]; }
```

---

## Real-Time

Supabase Realtime is subscribed on the following tables:

| Table | Events handled |
|---|---|
| `leads` | `UPDATE` patches stage in local state; `INSERT` triggers full refetch; `DELETE` removes from state |
| `contacts` | tracked for future contact panel updates |
| `lead_contacts` | tracked for future contact panel updates |
| `trial_lessons` | tracked for future trial calendar |
| `enrollments` | tracked for future enrollment dashboard |
| `activities` | tracked for future live activity feed |

**Channel name:** `pipeline-realtime`  
**Cleanup:** Channel is removed on component unmount via `useEffect` return.

---

## Email System

Emails are sent via Resend when a lead is dragged to a trigger stage. Every successful send is auto-logged as an `email_sent` activity.

### Trigger stages

`contacted` · `trial_booked` · `trial_done` · `enrolled`

### Personalisation

Templates check the contact roster and personalise:
- **Adult:** "Hi David, your trial lesson is confirmed!"
- **Parent + 1 child:** "Trial confirmed for Lucas!"
- **Parent + 2+ children:** "Trial confirmed for Emma and Liam!"

### Template structure

Pure HTML with inline styles (required for email client compatibility). No React Email dependency.

### FROM address

- **Testing:** `onboarding@resend.dev` (Resend sandbox, no domain needed)
- **Production:** Set `EMAIL_FROM` env var once your domain is verified in Resend

---

## Third-Party Boundary

BeatBunch CRM owns the pipeline, contacts, and history. Everything class-management related belongs to the third-party system.

| Data | Owner |
|---|---|
| Lead pipeline & stage history | CRM |
| Contact records | CRM |
| Teacher profiles | CRM |
| Trial lesson bookings | CRM |
| Activity / interaction log | CRM |
| Class schedules & timetables | Third party |
| Attendance records | Third party |
| Pricing & invoices | Third party |
| Payment processing | Third party |

The CRM stores `external_class_id` on enrollment records as the foreign key handle back into the third-party system.

---

## Environment Variables

| Variable | Required | Description |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Yes | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Yes | Supabase publishable key |
| `RESEND_API_KEY` | Yes | Resend API key (`re_...`) |
| `EMAIL_FROM` | Optional | Sender address. Defaults to `onboarding@resend.dev` |
| `DATABASE_URL` | Dev only | Full Postgres URL for running migrations via `psql` |

---

## Known Limitations

### No database transactions
`createLeadWithContacts` makes sequential Supabase calls. If an intermediate call fails, the lead may be partially created.

**Fix:** Wrap in a Postgres function (RPC) so the creation is atomic.

### Stage emails fire on every move, not just first time
Moving a card to "Contacted", back to "New", then back to "Contacted" again sends the email twice. The `activities` table records every send, making deduplication possible.

**Fix:** Before sending, query `activities` for an existing `email_sent` row with the same `lead_id` and stage in metadata.

### No contact deduplication
If a parent enquires twice (for different children), the form creates a second contact record rather than reusing the existing one.

**Fix:** Add a contact search/autocomplete to the Add Lead form.

### Only one parent per lead in the form
`AddLeadForm` supports one parent + N children. The schema supports multiple parents, but the UI does not expose this.

**Fix:** Add a second optional parent field.

### Resend free tier delivery restriction
On Resend's free plan, emails only deliver to your verified account address.

**Fix:** Verify your sending domain in Resend (Settings → Domains). Free tier supports 3,000 emails/month.

### Real-time INSERT does a full refetch
When a new lead is inserted by another session, the board does a full `getLeads()` call because the realtime payload does not include joined contacts.

**Fix:** Subscribe to `lead_contacts` changes separately and stitch them into local state, or use Supabase broadcast.

### Next.js 16 proxy convention
Next.js 16 renamed `middleware.ts` → `proxy.ts` and the exported function from `middleware` → `proxy`. This is a breaking change from all Next.js 13/14/15 documentation.

### Tailwind v4 CSS-first config
Tailwind v4 no longer uses `tailwind.config.js` — configuration lives in `globals.css` via `@theme`. Be aware when reading older Tailwind docs.

---

## Deployment Checklist (Vercel)

- [ ] Set all env vars in Vercel project settings
- [ ] Add production URL to Supabase → Auth → URL Configuration → Redirect URLs
- [ ] Verify sending domain in Resend → update `EMAIL_FROM`
- [ ] Run migrations v2 through v6 on the production Supabase project in order
- [ ] Enable Realtime on all tables listed in the Realtime section above
- [ ] Create the first school record and add the owner's user to `school_members`
- [ ] Test login, school setup, lead creation, drag-and-drop, lead detail page, email, and activity log end-to-end

---

## What's Next

Suggested next features in priority order:

1. **Contact deduplication** — search existing contacts when adding a lead
2. **Atomic lead creation** — Supabase RPC to wrap the multi-step create in a single transaction
3. **Duplicate email guard** — check `activities` before sending a stage email to prevent re-sends
4. **Multi-school switching** — UI to switch between schools for users who belong to more than one
5. **Teacher portal** — teachers log in and see only their assigned leads and trial lessons
6. **Third-party integration** — webhook or polling sync to pull class/attendance data from the external system and surface it alongside CRM records
