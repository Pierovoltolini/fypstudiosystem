-- ============================================================
-- FYP.STUDIO — Notas completas (cuaderno del usuario)
-- Widget de nota rápida sigue usando la tabla quick_notes.
-- Esta tabla es para el cuaderno completo en /admin/notes.
-- ============================================================

create table if not exists notes (
  id          uuid primary key default uuid_generate_v4(),
  business_id uuid not null references businesses(id) on delete cascade,
  user_id     uuid not null references auth.users(id) on delete cascade,
  title       text not null default '',
  content     text not null default '',
  tags        text[] not null default '{}',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists idx_notes_user
  on notes(business_id, user_id, updated_at desc);

create trigger set_updated_at_notes
  before update on notes
  for each row execute function update_updated_at();

alter table notes enable row level security;

create policy "usuario gestiona sus notas" on notes
  for all
  using  (user_id = auth.uid() and business_id = get_my_business_id())
  with check (user_id = auth.uid() and business_id = get_my_business_id());
