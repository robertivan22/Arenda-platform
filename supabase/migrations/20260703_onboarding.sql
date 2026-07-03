-- ============================================================
-- Onboarding Wizard — state persistence
-- ============================================================
-- current_step values (in order):
--   account_type → fiscal_data → import_parcels → import_contracts
--   → alert_preferences → completed
-- ============================================================

create table if not exists public.onboarding_state (
  user_id        uuid primary key references auth.users(id) on delete cascade,
  current_step   text not null default 'account_type',
  data           jsonb not null default '{}'::jsonb,
  completed_at   timestamptz,
  tour_seen_at   timestamptz,
  updated_at     timestamptz not null default now()
);

alter table public.onboarding_state enable row level security;

create policy "users manage own onboarding state"
  on public.onboarding_state for all
  using  (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ── updated_at trigger ────────────────────────────────────────────────────────
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger onboarding_state_updated_at
  before update on public.onboarding_state
  for each row execute function public.set_updated_at();
