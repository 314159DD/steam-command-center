-- Calendar follow-up: real upcoming releases from OpenCritic's public .ics feed.
-- Global (not per-user); refreshed wholesale by the collector. steam_app_id is a
-- best-effort name match into games (nullable).
create table if not exists release_calendar (
  id           bigserial primary key,
  game_name    text not null,
  release_date date not null,
  url          text,
  steam_app_id bigint,
  updated_at   timestamptz not null default now()
);
create index if not exists idx_release_calendar_date on release_calendar(release_date);
