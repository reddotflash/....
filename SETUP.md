# Setup

## 1. Install the new dependency

```bash
npm install
```

(`@supabase/supabase-js` is now listed in `package.json` but wasn't actually
installed before — the old project would not have built.)

## 2. Create the `codes` table in Supabase

Open your Supabase project → SQL Editor → run:

```sql
create extension if not exists pgcrypto;

create table if not exists codes (
  id uuid primary key default gen_random_uuid(),
  code text unique not null,
  status text not null default 'unused' check (status in ('unused', 'redeemed')),
  created_at timestamptz not null default now(),
  redeemed_by text,
  redeemed_at timestamptz
);

-- Row Level Security is turned on with no policies, which means only
-- the service role key can touch this table. The browser never gets
-- direct database access anymore, so this table is safe even though
-- it holds Discord usernames.
alter table codes enable row level security;
```

You can drop the old `claims` table if you had one — it's no longer used;
everything now lives in `codes`.

## 3. Set environment variables

Copy `.env.local.example` to `.env.local` and fill in real values:

```bash
cp .env.local.example .env.local
```

- `SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` — from Supabase → Project
  Settings → API. Use the **service_role** key, not the anon key — and never
  put this key in any file that ships to the browser. It's only read inside
  `app/api/**/route.js` files, which run on the server.
- `STAFF_USERNAME` / `STAFF_PASSWORD` — whatever you want staff to log in with.
- `STAFF_SESSION_SECRET` — a random string used to sign login sessions.
  Generate one with `openssl rand -hex 32`.

On Vercel (or wherever you deploy), add the same variables under
Project Settings → Environment Variables. `.env.local` is git-ignored and
never gets deployed automatically.

## 4. Run it

```bash
npm run dev
```

- `/` — user redemption form (code + Discord username)
- Staff Portal link (top right) — staff login, then "Generate code" and
  "All codes" tabs

## What changed from the previous version, and why

- **Supabase keys and staff credentials are no longer in the browser bundle.**
  Previously the anon key and a hardcoded staff username/password were
  shipped straight to the client, so anyone with dev tools could read the
  full redemption table or log in as staff by editing React state. All
  database access now happens in API routes using the service role key,
  which never leaves the server.
- **Staff login is now a real session**, backed by a signed, `httpOnly`
  cookie, checked server-side on every request.
- **`@supabase/supabase-js` is now an actual dependency** — the previous
  `package.json` was missing it entirely, so the build would have failed.
- **The redemption flow now includes a code**, not just a Discord username,
  and codes can only be redeemed once (guarded against a race between two
  simultaneous submissions).
- **A staff "Generate code" screen was added**, which creates a unique code
  server-side and displays it for staff to hand out.
- Replaced `alert()`s and silent failures with inline error messages, disabled
  button states while requests are in flight, and a session-expiry redirect
  if a staff cookie lapses mid-session.
