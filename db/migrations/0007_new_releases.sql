-- New-releases redesign: a queryable release date + IGDB (Twitch) signals.
alter table games add column if not exists released_at            date;
alter table games add column if not exists igdb_id                bigint;
alter table games add column if not exists igdb_hypes             int;
alter table games add column if not exists igdb_follows           int;
alter table games add column if not exists igdb_aggregated_rating numeric;
alter table games add column if not exists igdb_rating_count      int;
alter table games add column if not exists igdb_checked_at        timestamptz;

create index if not exists idx_games_released_at on games(released_at desc);
