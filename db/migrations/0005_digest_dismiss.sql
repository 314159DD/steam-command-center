create table if not exists dismissed_digest (
  steam_id text not null,
  app_id bigint not null,
  dismissed_at timestamptz not null default now(),
  primary key (steam_id, app_id)
);
