-- Phase B - per-game signals. Additive; safe to re-run.

-- B1: ProtonDB / Steam Deck compatibility
alter table games add column if not exists proton_tier          text;  -- platinum|gold|silver|bronze|borked|unrated
alter table games add column if not exists proton_trending_tier text;
alter table games add column if not exists proton_confidence    text;
alter table games add column if not exists proton_checked_at     timestamptz;
alter table games add column if not exists deck_verified         text;  -- Valve official: verified|playable|unsupported
alter table games add column if not exists deck_checked_at        timestamptz;

-- B2: SteamSpy ownership + tag context
alter table games add column if not exists owners_estimate text;
alter table games add column if not exists spy_ccu          int;
alter table games add column if not exists spy_avg_playtime int;
alter table games add column if not exists spy_tags         jsonb;
alter table games add column if not exists spy_checked_at   timestamptz;

-- B4: review momentum (recent vs lifetime sentiment)
alter table games add column if not exists recent_review_pct   int;
alter table games add column if not exists review_trend        text;  -- up|down|flat
alter table games add column if not exists recent_review_up     int;
alter table games add column if not exists recent_review_down   int;
alter table games add column if not exists review_hist_checked_at timestamptz;

-- B10 follow-up: HowLongToBeat hours (main / main+extra / completionist)
alter table games add column if not exists hltb_main          int;
alter table games add column if not exists hltb_extra         int;
alter table games add column if not exists hltb_completionist int;
alter table games add column if not exists hltb_checked_at    timestamptz;

-- B11: release calendar
alter table games add column if not exists coming_soon  boolean default false;
alter table games add column if not exists release_date text;

-- B3: ITAD price intelligence (current best price + all-time low)
alter table games add column if not exists itad_id          text;
alter table games add column if not exists itad_price_cents int;
alter table games add column if not exists itad_atl_cents   int;
alter table games add column if not exists itad_cut         int;
alter table games add column if not exists itad_shop        text;
alter table games add column if not exists itad_currency    text;
alter table games add column if not exists itad_checked_at  timestamptz;
alter table games add column if not exists sub_names        text[];   -- B3 follow-up: subscriptions (e.g. {'Game Pass'})
alter table games add column if not exists bundle_count     int;
alter table games add column if not exists bundle_name      text;
alter table games add column if not exists bundle_checked_at timestamptz;

-- B6: critic scores (Metacritic + OpenCritic) via ITAD games/info
alter table games add column if not exists metacritic        int;
alter table games add column if not exists metacritic_user   int;
alter table games add column if not exists opencritic         int;
alter table games add column if not exists critic_checked_at  timestamptz;

-- B8: price-drop events (global; surfaced per-user via wishlist join)
create table if not exists price_drops (
  id         bigserial primary key,
  app_id     bigint not null references games(app_id),
  old_cents  int,
  new_cents  int,
  at_atl     boolean default false,
  dropped_at timestamptz not null default now()
);
create index if not exists idx_price_drops_time on price_drops(dropped_at desc);

-- B7: per-user per-game achievement summary
create table if not exists user_game_achievements (
  steam_id    text   not null,
  app_id      bigint not null references games(app_id),
  achieved    int    not null default 0,
  total       int    not null default 0,
  pct         int,
  last_unlock timestamptz,
  rarest_name text,
  rarest_pct  numeric,
  updated_at  timestamptz not null default now(),
  primary key (steam_id, app_id)
);

-- Extend the monitor RPC to surface proton_tier alongside player counts.
drop function if exists most_played_with_momentum(int);
create or replace function most_played_with_momentum(lim int)
returns table (app_id bigint, name text, header_image text, player_count int, prev_count int, proton_tier text)
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
  select l.app_id, g.name, g.header_image, l.player_count, p.prev_count, g.proton_tier
  from latest l
  join games g on g.app_id = l.app_id
  left join prev p on p.app_id = l.app_id
  order by l.player_count desc
  limit lim;
$$;
