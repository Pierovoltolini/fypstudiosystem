-- ============================================================
-- FYP.STUDIO — Módulo Gastronomía
-- Ejecutar DESPUÉS de 005_barbershop.sql
-- ============================================================

-- ── Horarios del negocio ──────────────────────────────────────
create table if not exists business_hours (
  id           uuid primary key default uuid_generate_v4(),
  business_id  uuid not null references businesses(id) on delete cascade,
  branch_id    uuid references branches(id) on delete cascade,
  day_of_week  int not null check (day_of_week between 0 and 6),
  is_open      boolean not null default true,
  open_time    time not null default '09:00',
  close_time   time not null default '22:00',
  unique(business_id, day_of_week)
);

alter table business_hours enable row level security;
create policy "comercio gestiona horarios"
  on business_hours for all
  using  (business_id = get_my_business_id() or is_superadmin())
  with check (business_id = get_my_business_id() or is_superadmin());
create policy "tienda lee horarios"
  on business_hours for select using (true);

-- ── Combos / Promociones ─────────────────────────────────────
create table if not exists combos (
  id           uuid primary key default uuid_generate_v4(),
  business_id  uuid not null references businesses(id) on delete cascade,
  name         text not null,
  description  text,
  price        numeric(10,2) not null,
  image_url    text,
  active       boolean not null default true,
  featured     boolean not null default false,
  valid_from   timestamptz,
  valid_until  timestamptz,
  created_at   timestamptz not null default now()
);

create table if not exists combo_items (
  id         uuid primary key default uuid_generate_v4(),
  combo_id   uuid not null references combos(id) on delete cascade,
  product_id uuid references products(id) on delete set null,
  product_name text not null,
  quantity   int not null default 1
);

alter table combos      enable row level security;
alter table combo_items enable row level security;

create policy "comercio gestiona combos"
  on combos for all
  using  (business_id = get_my_business_id() or is_superadmin())
  with check (business_id = get_my_business_id() or is_superadmin());
create policy "tienda lee combos activos"
  on combos for select using (active = true);
create policy "todos leen combo_items"
  on combo_items for all
  using  (true) with check (true);

-- ── Agregar campo delivery_fee y pickup_enabled a businesses ──
alter table businesses
  add column if not exists delivery_fee    numeric(10,2) default 0;
alter table businesses
  add column if not exists delivery_enabled boolean default true;
alter table businesses
  add column if not exists pickup_enabled   boolean default true;
alter table businesses
  add column if not exists min_order        numeric(10,2) default 0;
alter table businesses
  add column if not exists estimated_time   text default '30-45 min';

-- ── Horarios default para negocios food ──────────────────────
create or replace function create_default_hours()
returns trigger language plpgsql as $$
begin
  if new.vertical_type = 'food' then
    insert into business_hours (business_id, day_of_week, is_open, open_time, close_time)
    values
      (new.id, 0, true,  '11:00', '23:00'),
      (new.id, 1, true,  '11:00', '23:00'),
      (new.id, 2, true,  '11:00', '23:00'),
      (new.id, 3, true,  '11:00', '23:00'),
      (new.id, 4, true,  '11:00', '23:00'),
      (new.id, 5, true,  '11:00', '00:00'),
      (new.id, 6, true,  '11:00', '00:00')
    on conflict do nothing;
  end if;
  return new;
end;
$$;

create trigger trg_create_default_hours
  after insert on businesses
  for each row execute function create_default_hours();

-- Realtime para orders (ya estaba, confirmar)
-- alter publication supabase_realtime add table orders;
