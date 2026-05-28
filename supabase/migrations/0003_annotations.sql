create table if not exists annotations (
  id uuid primary key default gen_random_uuid(),
  briefing_date date not null references briefings(briefing_date) on delete cascade,
  selected_text text not null,
  occurrence_index int not null default 0,
  note text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists annotations_briefing_date_idx on annotations(briefing_date);
