-- Phase C (B12) - PICS build/patch watcher. Populated by the standalone pics_worker
-- (see collector/PICS-RUNBOOK.md), which needs a dedicated Steam account + a persistent host.
alter table games add column if not exists current_build_id text;

create table if not exists build_history (
  id          bigserial primary key,
  app_id      bigint not null references games(app_id),
  build_id    text not null,
  detected_at timestamptz not null default now()
);
create index if not exists idx_build_history_app_time on build_history(app_id, detected_at desc);
