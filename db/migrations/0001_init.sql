-- Catalog of every app we know about
create table if not exists games (
  app_id        bigint primary key,
  name          text not null,
  header_image  text,
  tags          text[] default '{}',
  genres        text[] default '{}',
  review_score  int,
  review_count  int,
  price_cents   int,
  is_released   boolean default true,
  updated_at    timestamptz not null default now()
);

-- Discovery placements over time (new/trending/top sellers/specials/upcoming)
create table if not exists app_snapshots (
  id          bigserial primary key,
  app_id      bigint not null references games(app_id),
  category    text not null,                 -- new_release|trending|top_seller|special|upcoming
  rank        int,
  captured_at timestamptz not null default now()
);
create index if not exists idx_snap_cat_time on app_snapshots(category, captured_at desc);

-- Live player counts over time
create table if not exists player_counts (
  id          bigserial primary key,
  app_id      bigint not null references games(app_id),
  player_count int not null,
  captured_at timestamptz not null default now()
);
create index if not exists idx_pc_app_time on player_counts(app_id, captured_at desc);

-- News / patch items, classified
create table if not exists updates (
  gid            text primary key,            -- Steam news gid
  app_id         bigint not null references games(app_id),
  title          text not null,
  body           text,
  url            text,
  classification text not null,               -- MAJOR|UPDATE|HOTFIX|CONTENT
  posted_at      timestamptz not null
);
create index if not exists idx_updates_posted on updates(posted_at desc);

-- Users (one row per Steam login)
create table if not exists users (
  steam_id   text primary key,
  persona    text,
  avatar     text,
  created_at timestamptz not null default now(),
  last_login timestamptz not null default now()
);

-- A user's owned + wishlist games
create table if not exists user_libraries (
  steam_id          text not null references users(steam_id) on delete cascade,
  app_id            bigint not null,
  kind              text not null,            -- owned|wishlist
  playtime_forever  int default 0,
  playtime_2weeks   int default 0,
  primary key (steam_id, app_id, kind)
);

-- Per-user toggle state + derived taste weights
create table if not exists user_prefs (
  steam_id    text primary key references users(steam_id) on delete cascade,
  toggles     jsonb not null default '{"quality":true,"taste":true,"my_games":true,"global":false}',
  tag_weights jsonb not null default '{}',
  updated_at  timestamptz not null default now()
);

create or replace function most_played_with_momentum(lim int)
returns table (app_id bigint, name text, header_image text, player_count int, prev_count int)
language sql stable as $$
  with latest as (
    select distinct on (pc.app_id) pc.app_id, pc.player_count, pc.captured_at
    from player_counts pc order by pc.app_id, pc.captured_at desc
  ),
  prev as (
    select distinct on (pc.app_id) pc.app_id, pc.player_count as prev_count
    from player_counts pc
    where (pc.app_id, pc.captured_at) not in (select app_id, captured_at from latest)
    order by pc.app_id, pc.captured_at desc
  )
  select l.app_id, g.name, g.header_image, l.player_count, p.prev_count
  from latest l
  join games g on g.app_id = l.app_id
  left join prev p on p.app_id = l.app_id
  order by l.player_count desc
  limit lim;
$$;
