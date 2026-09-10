create table if not exists collector_health (
  source          text primary key,
  last_status     text not null,
  last_detail     text,
  last_success_at timestamptz,
  updated_at      timestamptz not null default now()
);
