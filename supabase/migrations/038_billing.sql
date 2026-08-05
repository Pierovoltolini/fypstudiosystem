-- ============================================================
-- FYP.STUDIO — Sistema de billing y suscripciones
-- Tabla subscriptions: una fila por negocio con estado actual
-- Tabla billing_events: log de todos los eventos de MercadoPago
-- ============================================================

-- 1. Tabla de suscripciones activas por negocio
create table if not exists subscriptions (
  id                          uuid primary key default uuid_generate_v4(),
  business_id                 uuid not null unique references businesses(id) on delete cascade,
  plan                        text not null default 'basic'
    check (plan in ('basic', 'pro', 'premium')),
  status                      text not null default 'active'
    check (status in ('active', 'past_due', 'cancelled', 'suspended')),
  billing_cycle               text not null default 'monthly'
    check (billing_cycle in ('monthly', 'annual')),
  mercadopago_subscription_id text unique,
  current_period_start        timestamptz,
  current_period_end          timestamptz,
  created_at                  timestamptz not null default now(),
  updated_at                  timestamptz not null default now()
);

-- 2. Tabla de eventos de billing (auditoría)
create table if not exists billing_events (
  id              uuid primary key default uuid_generate_v4(),
  business_id     uuid not null references businesses(id) on delete cascade,
  event_type      text not null,
  mercadopago_id  text,
  payload         jsonb,
  created_at      timestamptz not null default now()
);

-- 3. Índices
create index if not exists idx_subscriptions_business
  on subscriptions(business_id);

create index if not exists idx_billing_events_business
  on billing_events(business_id, created_at desc);

create index if not exists idx_billing_events_mp_id
  on billing_events(mercadopago_id);

-- 4. RLS
alter table subscriptions  enable row level security;
alter table billing_events enable row level security;

-- Cada negocio solo lee su propia suscripción
create policy "owner lee su suscripcion" on subscriptions
  for select
  using (business_id = get_my_business_id());

-- El service role puede escribir (webhooks usan service client)
create policy "service gestiona suscripciones" on subscriptions
  for all
  using (true)
  with check (true);

-- Cada negocio lee sus propios eventos
create policy "owner lee sus billing events" on billing_events
  for select
  using (business_id = get_my_business_id());

create policy "service inserta billing events" on billing_events
  for insert
  with check (true);

-- 5. Poblar subscriptions para negocios existentes (plan basic, status active)
insert into subscriptions (business_id, plan, status, billing_cycle)
select id, coalesce(plan, 'basic'), 'active', 'monthly'
from businesses
on conflict (business_id) do nothing;
