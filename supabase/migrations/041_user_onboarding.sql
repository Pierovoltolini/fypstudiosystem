-- ============================================================
-- FYP.STUDIO — Tour de bienvenida para usuarios nuevos
-- Registra si el usuario ya completó o saltó el tour interactivo
-- ============================================================

create table if not exists user_onboarding (
  id           uuid primary key default uuid_generate_v4(),
  user_id      uuid not null unique references auth.users(id) on delete cascade,
  completed_at timestamptz,
  skipped_at   timestamptz,
  created_at   timestamptz not null default now()
);

create index if not exists idx_user_onboarding_user
  on user_onboarding(user_id);

alter table user_onboarding enable row level security;

-- Cada usuario solo ve y edita su propio registro
create policy "usuario gestiona su onboarding" on user_onboarding
  for all
  using  (user_id = auth.uid())
  with check (user_id = auth.uid());
