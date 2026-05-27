create extension if not exists "pgcrypto";

create table if not exists briefings (
  id uuid primary key default gen_random_uuid(),
  briefing_date date not null unique,
  themes_heading text not null,
  synthesis_md text not null,
  english_script text not null,
  norwegian_script text not null,
  sources jsonb default '[]'::jsonb,
  ingested_at timestamptz not null default now()
);

create table if not exists users (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz not null default now()
);

create index if not exists briefings_briefing_date_desc on briefings (briefing_date desc);
