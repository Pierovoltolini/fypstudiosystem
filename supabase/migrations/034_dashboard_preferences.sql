-- ============================================================
-- FYP.STUDIO — Preferencias de dashboard por usuario
-- Guarda qué widgets ve cada usuario, en qué orden y cuáles oculta
-- ============================================================

create table if not exists dashboard_preferences (
  id          uuid primary key default uuid_generate_v4(),
  business_id uuid not null references businesses(id) on delete cascade,
  user_id     uuid not null references auth.users(id) on delete cascade,
  -- config: { widgets: [{ id, visible, order }] }
  config      jsonb not null default '{}',
  updated_at  timestamptz not null default now(),
  unique(business_id, user_id)
);

create index if not exists idx_dashboard_prefs_user
  on dashboard_preferences(user_id, business_id);

alter table dashboard_preferences enable row level security;

create policy "usuario gestiona sus preferencias" on dashboard_preferences
  for all
  using  (user_id = auth.uid() and business_id = get_my_business_id())
  with check (user_id = auth.uid() and business_id = get_my_business_id());
