-- ============================================================
-- FYP.STUDIO — Migración: Sistema de Verticales
-- Ejecutar en Supabase SQL Editor
-- ============================================================

-- Agregar vertical_type a businesses
alter table businesses
  add column if not exists vertical_type text
    not null default 'general'
    check (vertical_type in (
      'food','real_estate','fashion','beauty',
      'barbershop','services','general'
    ));

-- Agregar módulos habilitados (overrides del vertical)
alter table businesses
  add column if not exists enabled_modules text[] default null;
  -- null = usar defaults del vertical
  -- array = override manual

-- Agregar configuración de widgets del dashboard
alter table businesses
  add column if not exists dashboard_config jsonb default null;
  -- null = usar defaults del vertical

-- Índice para filtrar por vertical
create index if not exists idx_businesses_vertical
  on businesses(vertical_type);

-- Todos los negocios existentes → general
update businesses
  set vertical_type = 'general'
  where vertical_type is null;

-- ── Tabla de leads (para real_estate, services) ───────────────
create table if not exists leads (
  id           uuid primary key default uuid_generate_v4(),
  business_id  uuid not null references businesses(id) on delete cascade,
  name         text not null,
  phone        text,
  email        text,
  message      text,
  source       text default 'store',   -- store, whatsapp, form
  status       text not null default 'new'
                 check (status in ('new','contacted','qualified','closed','lost')),
  product_id   uuid references products(id) on delete set null,
  notes        text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index if not exists idx_leads_business on leads(business_id, status);
create index if not exists idx_leads_created  on leads(business_id, created_at desc);

create trigger set_updated_at_leads
  before update on leads
  for each row execute function update_updated_at();

alter table leads enable row level security;

create policy "comercio gestiona leads"
  on leads for all
  using  (business_id = get_my_business_id() or is_superadmin())
  with check (business_id = get_my_business_id() or is_superadmin());

create policy "api puede insertar leads"
  on leads for insert with check (true);

-- ── Tabla de turnos/appointments (beauty, barbershop) ────────
create table if not exists appointments (
  id           uuid primary key default uuid_generate_v4(),
  business_id  uuid not null references businesses(id) on delete cascade,
  customer_id  uuid references customers(id) on delete set null,
  product_id   uuid references products(id) on delete set null,
  customer_name text not null,
  customer_phone text,
  date         date not null,
  time_slot    text not null,  -- '10:00', '10:30', etc.
  duration_min int default 30,
  status       text not null default 'pending'
                 check (status in ('pending','confirmed','done','cancelled','noshow')),
  notes        text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index if not exists idx_appointments_business on appointments(business_id, date);
create index if not exists idx_appointments_date     on appointments(business_id, date, status);

create trigger set_updated_at_appointments
  before update on appointments
  for each row execute function update_updated_at();

alter table appointments enable row level security;

create policy "comercio gestiona appointments"
  on appointments for all
  using  (business_id = get_my_business_id() or is_superadmin())
  with check (business_id = get_my_business_id() or is_superadmin());

create policy "api inserta appointments"
  on appointments for insert with check (true);

-- Habilitar realtime para appointments
alter publication supabase_realtime add table appointments;
alter publication supabase_realtime add table leads;
