-- Run this once in Supabase: SQL Editor -> New query -> paste -> Run.

create table if not exists public.trips (
  id          text primary key,
  meta        jsonb not null,          -- name, members, date windows, locked flag, final decision
  admin_key   text,                    -- coordinator's secret key
  brief       jsonb,                   -- latest Gemini group briefing (cached)
  created_at  timestamptz not null default now()
);

create table if not exists public.responses (
  trip_id     text not null references public.trips(id) on delete cascade,
  member      text not null,
  prefs       jsonb not null,          -- one person's dates, budget, travel limit, trip types, dealbreakers
  updated_at  timestamptz not null default now(),
  primary key (trip_id, member)        -- one row per person per trip
);

-- Lock the tables down: only the app's server (using the secret / service_role key) can read or write.
alter table public.trips enable row level security;
alter table public.responses enable row level security;
