-- ============================================================
-- FYP.STUDIO — Disponibilidad avanzada barbería
-- Ejecutar DESPUÉS de 007_calendar.sql
-- ============================================================

-- ── Horarios semanales por staff ──────────────────────────────
-- (ya existe staff_schedules de 005, la extendemos)
alter table staff_schedules
  add column if not exists break_start time,
  add column if not exists break_end   time;

-- Si no existía la tabla, crearla completa
create table if not exists staff_schedules (
  id           uuid primary key default uuid_generate_v4(),
  staff_id     uuid not null references staff(id) on delete cascade,
  business_id  uuid not null references businesses(id) on delete cascade,
  day_of_week  int  not null check (day_of_week between 0 and 6),
  is_working   boolean not null default true,
  start_time   time not null default '09:00',
  end_time     time not null default '19:00',
  break_start  time,
  break_end    time,
  unique(staff_id, day_of_week)
);

create index if not exists idx_schedules_staff    on staff_schedules(staff_id);
create index if not exists idx_schedules_business on staff_schedules(business_id);

alter table staff_schedules enable row level security;

create policy "comercio gestiona staff_schedules"
  on staff_schedules for all
  using  (business_id = get_my_business_id() or is_superadmin())
  with check (business_id = get_my_business_id() or is_superadmin());

create policy "publico lee staff_schedules"
  on staff_schedules for select using (true);

-- ── Bloqueos extendidos ───────────────────────────────────────
-- Ampliar blocked_slots para rangos de fechas
alter table blocked_slots
  add column if not exists date_from date,  -- para rango
  add column if not exists date_to   date,  -- para rango
  add column if not exists time_from time,  -- para rango horario
  add column if not exists time_to   time;  -- para rango horario

-- Vista que expande rangos en días individuales (útil para queries)
create or replace view v_blocked_days as
  select
    b.id,
    b.business_id,
    b.staff_id,
    d::date as date,
    b.time_slot,
    b.time_from,
    b.time_to,
    b.reason
  from blocked_slots b
  cross join generate_series(
    coalesce(b.date_from, b.date),
    coalesce(b.date_to,   b.date),
    '1 day'::interval
  ) as d
  where b.date is not null or b.date_from is not null;

-- ── Días cerrados globales del negocio ────────────────────────
create table if not exists business_closed_days (
  id          uuid primary key default uuid_generate_v4(),
  business_id uuid not null references businesses(id) on delete cascade,
  date        date,
  date_from   date,
  date_to     date,
  reason      text,
  created_at  timestamptz not null default now()
);

create index if not exists idx_closed_business on business_closed_days(business_id);
alter table business_closed_days enable row level security;

create policy "comercio gestiona closed_days"
  on business_closed_days for all
  using  (business_id = get_my_business_id() or is_superadmin())
  with check (business_id = get_my_business_id() or is_superadmin());

create policy "publico lee closed_days"
  on business_closed_days for select using (true);

alter publication supabase_realtime add table business_closed_days;
