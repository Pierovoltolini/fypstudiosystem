-- ============================================================
-- FYP.STUDIO — Módulos personalizados del menú lateral
-- Un módulo gratis por negocio. Los adicionales requieren is_paid=true
-- activado manualmente desde el superadmin.
-- ============================================================

-- Definición del módulo (estructura + campos)
create table if not exists custom_modules (
  id          uuid primary key default uuid_generate_v4(),
  business_id uuid not null references businesses(id) on delete cascade,
  name        text not null,
  icon        text not null default 'LayoutGrid',
  description text,
  -- fields: [{ key, label, type, required, options? }]
  -- types: 'text' | 'number' | 'date' | 'select' | 'boolean'
  fields      jsonb not null default '[]',
  is_paid     boolean not null default false, -- true = módulo de pago, requiere activación manual
  active      boolean not null default true,
  sort_order  int not null default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- Entradas del módulo (datos ingresados por el usuario)
create table if not exists custom_module_entries (
  id          uuid primary key default uuid_generate_v4(),
  module_id   uuid not null references custom_modules(id) on delete cascade,
  business_id uuid not null references businesses(id) on delete cascade,
  data        jsonb not null default '{}',
  created_by  uuid references auth.users(id) on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- Índices
create index if not exists idx_custom_modules_business
  on custom_modules(business_id, active);
create index if not exists idx_custom_entries_module
  on custom_module_entries(module_id, created_at desc);
create index if not exists idx_custom_entries_business
  on custom_module_entries(business_id, created_at desc);

-- Triggers updated_at
create trigger set_updated_at_custom_modules
  before update on custom_modules
  for each row execute function update_updated_at();

create trigger set_updated_at_custom_entries
  before update on custom_module_entries
  for each row execute function update_updated_at();

-- RLS
alter table custom_modules        enable row level security;
alter table custom_module_entries enable row level security;

create policy "comercio gestiona modulos" on custom_modules for all
  using  (business_id = get_my_business_id() or is_superadmin())
  with check (business_id = get_my_business_id() or is_superadmin());

create policy "comercio gestiona entradas" on custom_module_entries for all
  using  (business_id = get_my_business_id() or is_superadmin())
  with check (business_id = get_my_business_id() or is_superadmin());
