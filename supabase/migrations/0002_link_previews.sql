alter table briefings
  add column if not exists link_previews jsonb not null default '{}'::jsonb;
