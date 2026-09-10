-- Game hover preview card: fields captured from appdetails.
alter table games add column if not exists developer          text;
alter table games add column if not exists has_vac            boolean;
alter table games add column if not exists family_sharing     boolean;
alter table games add column if not exists trailer_movie_id   bigint;
alter table games add column if not exists screenshots        jsonb;
alter table games add column if not exists details_checked_at timestamptz;
