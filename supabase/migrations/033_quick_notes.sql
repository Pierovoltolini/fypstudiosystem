-- ============================================================
-- FYP.STUDIO — Notas rápidas por usuario
-- Widget de bloc de notas en el dashboard, persistente por sesión
-- ============================================================

create table if not exists quick_notes (
  id          uuid primary key default uuid_generate_v4(),
  business_id uuid not null references businesses(id) on delete cascade,
  user_id     uuid not null references auth.users(id) on delete cascade,
  content     text not null default '',
  updated_at  timestamptz not null default now(),
  unique(business_id, user_id)
);

create index if not exists idx_quick_notes_user
  on quick_notes(user_id, business_id);

alter table quick_notes enable row level security;

-- Cada usuario solo ve y edita sus propias notas dentro de su negocio
create policy "usuario gestiona sus notas" on quick_notes
  for all
  using  (user_id = auth.uid() and business_id = get_my_business_id())
  with check (user_id = auth.uid() and business_id = get_my_business_id());
