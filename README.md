# BeatBunch CRM

School pipeline management system built with Next.js, Supabase, and Shadcn/ui.

## Tech Stack

- **Framework**: Next.js 16 (App Router) + TypeScript
- **Styling**: Tailwind CSS v4 + Shadcn/ui
- **Auth & Database**: Supabase (PostgreSQL + Row-Level Security)
- **Hosting**: Vercel

## Getting Started

### 1. Create a Supabase project

Go to [supabase.com](https://supabase.com) → New project. Once created:

- Navigate to **Settings → API**
- Copy your **Project URL** and **anon public** key

### 2. Configure environment variables

```bash
cp .env.local.example .env.local
```

Fill in your Supabase credentials in `.env.local`:

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here
```

### 3. Configure Supabase Auth (important)

In your Supabase dashboard:
- Go to **Authentication → URL Configuration**
- Set **Site URL** to `http://localhost:3000` (for local dev)
- Add `http://localhost:3000/auth/callback` to **Redirect URLs**

For production, replace `localhost:3000` with your Vercel URL.

### 4. Run the dev server

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) — you'll be redirected to `/login`.

## Project Structure

```
src/
├── app/
│   ├── auth/
│   │   ├── actions.ts          # Server actions: login, signup, logout
│   │   └── callback/route.ts   # OAuth / magic link callback
│   ├── dashboard/page.tsx      # Protected dashboard
│   ├── login/page.tsx          # Login + signup tabs
│   └── page.tsx                # Root redirect
├── lib/
│   └── supabase/
│       ├── client.ts           # Browser client
│       └── server.ts           # Server/RSC client
└── middleware.ts               # Auth route protection
```

## Auth Flow

- **Login/Signup** → `/login` (tabbed UI)
- Middleware auto-redirects unauthenticated users to `/login`
- Middleware auto-redirects authenticated users away from `/login`
- After login → redirected to `/dashboard`
- Sign out → redirected back to `/login`

## Deploy to Vercel

```bash
npx vercel
```

Set your `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` as environment variables in the Vercel dashboard.
