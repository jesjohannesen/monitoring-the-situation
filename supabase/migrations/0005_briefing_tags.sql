alter table briefings
  add column if not exists tags text[] not null default '{}'::text[];

create index if not exists briefings_tags_gin on briefings using gin (tags);
