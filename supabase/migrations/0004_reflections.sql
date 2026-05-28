create table if not exists reflections (
  id uuid primary key default gen_random_uuid(),
  briefing_date date not null unique references briefings(briefing_date) on delete cascade,
  content text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists reflections_briefing_date_idx on reflections(briefing_date);
