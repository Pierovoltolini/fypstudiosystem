-- ============================================================
-- FYP.STUDIO — Calendario avanzado barbería
-- Ejecutar DESPUÉS de 005_barbershop.sql
-- ============================================================

-- Días/horarios bloqueados manualmente por el admin
create table if not exists blocked_slots (
  id           uuid primary key default uuid_generate_v4(),
  business_id  uuid not null references businesses(id) on delete cascade,
  staff_id     uuid references staff(id) on delete cascade,
  date         date not null,
  time_slot    text,        -- null = día entero bloqueado
  reason       text,
  created_at   timestamptz not null default now()
);

create index if not exists idx_blocked_business on blocked_slots(business_id, date);
create index if not exists idx_blocked_staff    on blocked_slots(staff_id,    date);

alter table blocked_slots enable row level security;

create policy "comercio gestiona blocked_slots"
  on blocked_slots for all
  using  (business_id = get_my_business_id() or is_superadmin())
  with check (business_id = get_my_business_id() or is_superadmin());

create policy "publico lee blocked_slots"
  on blocked_slots for select using (true);

-- Log de emails enviados
create table if not exists email_logs (
  id          uuid primary key default uuid_generate_v4(),
  business_id uuid not null references businesses(id) on delete cascade,
  booking_id  uuid references bookings(id) on delete set null,
  to_email    text not null,
  type        text not null,
  status      text not null default 'sent',
  created_at  timestamptz not null default now()
);

alter table email_logs enable row level security;
create policy "comercio ve email_logs"
  on email_logs for select
  using (business_id = get_my_business_id() or is_superadmin());

-- Agregar customer_email a bookings
alter table bookings
  add column if not exists customer_email text;

-- Email de notificaciones para la barbería
alter table businesses
  add column if not exists notification_email text;

alter publication supabase_realtime add table blocked_slots;
