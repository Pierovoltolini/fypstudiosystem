-- ============================================================
-- FYP.STUDIO — Contador de uso de IA por negocio/mes
-- Controla límites por plan: basic=15, pro=150, premium=ilimitado
-- ============================================================

create table if not exists ai_usage (
  id          uuid primary key default uuid_generate_v4(),
  business_id uuid not null references businesses(id) on delete cascade,
  month       text not null,  -- formato 'YYYY-MM'
  count       int  not null default 0,
  updated_at  timestamptz not null default now(),
  unique(business_id, month)
);

create index if not exists idx_ai_usage_biz_month
  on ai_usage(business_id, month);

alter table ai_usage enable row level security;

-- SELECT: el negocio ve su propio uso (para mostrar en el panel)
create policy "comercio ve su uso ia" on ai_usage for select
  using (business_id = get_my_business_id() or is_superadmin());

-- INSERT y UPDATE solo vía service role (desde las API routes con createServiceClient)
-- No se agrega policy de INSERT/UPDATE aquí intencionalmente:
-- las escrituras las hace el service role que bypasea RLS.
