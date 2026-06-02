-- ============================================================
-- FYP.STUDIO — Módulo Barbería (y Belleza)
-- Ejecutar DESPUÉS de 004_verticals.sql
-- ============================================================

-- ── Sucursales ────────────────────────────────────────────────
create table if not exists branches (
  id           uuid primary key default uuid_generate_v4(),
  business_id  uuid not null references businesses(id) on delete cascade,
  name         text not null,
  address      text,
  phone        text,
  whatsapp     text,
  city         text,
  is_main      boolean not null default false,
  active       boolean not null default true,
  created_at   timestamptz not null default now()
);

create index if not exists idx_branches_business on branches(business_id, active);
alter table branches enable row level security;
create policy "comercio gestiona branches"
  on branches for all
  using  (business_id = get_my_business_id() or is_superadmin())
  with check (business_id = get_my_business_id() or is_superadmin());

-- ── Staff (barberos / profesionales) ─────────────────────────
create table if not exists staff (
  id           uuid primary key default uuid_generate_v4(),
  business_id  uuid not null references businesses(id) on delete cascade,
  branch_id    uuid references branches(id) on delete set null,
  name         text not null,
  role         text not null default 'barber', -- barber, stylist, specialist
  bio          text,
  avatar_url   text,
  phone        text,
  color        text not null default '#1565FF', -- color en el calendario
  active       boolean not null default true,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index if not exists idx_staff_business on staff(business_id, active);
alter table staff enable row level security;
create policy "comercio gestiona staff"
  on staff for all
  using  (business_id = get_my_business_id() or is_superadmin())
  with check (business_id = get_my_business_id() or is_superadmin());
create policy "tienda publica lee staff activo"
  on staff for select using (active = true);

create trigger set_updated_at_staff
  before update on staff
  for each row execute function update_updated_at();

-- ── Horarios por staff ────────────────────────────────────────
-- Qué días trabaja y en qué horario
create table if not exists staff_schedules (
  id           uuid primary key default uuid_generate_v4(),
  staff_id     uuid not null references staff(id) on delete cascade,
  business_id  uuid not null references businesses(id) on delete cascade,
  day_of_week  int not null check (day_of_week between 0 and 6), -- 0=Dom, 1=Lun...
  start_time   time not null,  -- '09:00'
  end_time     time not null,  -- '18:00'
  break_start  time,           -- '13:00' (opcional)
  break_end    time,           -- '14:00'
  is_working   boolean not null default true,
  unique(staff_id, day_of_week)
);

alter table staff_schedules enable row level security;
create policy "comercio gestiona staff_schedules"
  on staff_schedules for all
  using  (business_id = get_my_business_id() or is_superadmin())
  with check (business_id = get_my_business_id() or is_superadmin());
create policy "tienda publica lee schedules"
  on staff_schedules for select using (is_working = true);

-- ── Turnos/Appointments ───────────────────────────────────────
-- (reemplaza/extiende la tabla appointments de 004)
create table if not exists bookings (
  id              uuid primary key default uuid_generate_v4(),
  business_id     uuid not null references businesses(id) on delete cascade,
  branch_id       uuid references branches(id) on delete set null,
  staff_id        uuid references staff(id) on delete set null,
  product_id      uuid references products(id) on delete set null, -- servicio
  customer_name   text not null,
  customer_phone  text,
  customer_email  text,
  date            date not null,
  start_time      time not null,
  end_time        time not null,
  duration_min    int not null default 30,
  status          text not null default 'pending'
                    check (status in ('pending','confirmed','done','cancelled','noshow')),
  notes           text,
  price           numeric(10,2),
  source          text default 'store', -- store, admin, whatsapp
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index if not exists idx_bookings_business  on bookings(business_id, date);
create index if not exists idx_bookings_staff     on bookings(staff_id, date);
create index if not exists idx_bookings_date      on bookings(business_id, date, status);

alter table bookings enable row level security;
create policy "comercio gestiona bookings"
  on bookings for all
  using  (business_id = get_my_business_id() or is_superadmin())
  with check (business_id = get_my_business_id() or is_superadmin());
create policy "api inserta bookings"
  on bookings for insert with check (true);

create trigger set_updated_at_bookings
  before update on bookings
  for each row execute function update_updated_at();

-- Realtime para bookings (dashboard admin live)
alter publication supabase_realtime add table bookings;
alter publication supabase_realtime add table staff;

-- ── Page Builder config ───────────────────────────────────────
-- Configuración visual de la tienda pública
alter table businesses
  add column if not exists page_config jsonb default null;
-- Estructura: { hero, sections, theme, fonts, layout }

-- ── Insertar sucursal principal automáticamente ───────────────
-- (trigger para nuevos negocios con vertical barbershop/beauty)
create or replace function create_main_branch()
returns trigger language plpgsql as $$
begin
  if new.vertical_type in ('barbershop','beauty') then
    insert into branches (business_id, name, is_main, active)
    values (new.id, 'Sucursal principal', true, true)
    on conflict do nothing;
  end if;
  return new;
end;
$$;

create trigger trg_create_main_branch
  after insert on businesses
  for each row execute function create_main_branch();
