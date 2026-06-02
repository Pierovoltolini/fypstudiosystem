-- ============================================================
-- FYP.STUDIO — Módulo Proveedores
-- Ejecutar en Supabase SQL Editor DESPUÉS de 002_inventory.sql
-- ============================================================

-- ── Proveedores ───────────────────────────────────────────────
create table if not exists suppliers (
  id           uuid primary key default uuid_generate_v4(),
  business_id  uuid not null references businesses(id) on delete cascade,
  name         text not null,
  contact_name text,                    -- nombre del contacto
  phone        text,                    -- teléfono / WhatsApp
  email        text,
  address      text,
  city         text,
  notes        text,
  active       boolean not null default true,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

-- ── Productos por proveedor (un proveedor puede tener varios) ─
-- (precios negociados por item con ese proveedor)
create table if not exists supplier_products (
  id            uuid primary key default uuid_generate_v4(),
  supplier_id   uuid not null references suppliers(id) on delete cascade,
  business_id   uuid not null references businesses(id) on delete cascade,
  inventory_item_id uuid references inventory_items(id) on delete set null,
  product_name  text not null,           -- nombre del artículo
  sku_supplier  text,                    -- código del proveedor
  unit          text not null default 'unidad',
  price         numeric(10,2),           -- precio del proveedor
  min_order     numeric(10,2),           -- pedido mínimo
  lead_days     int,                     -- días de entrega
  notes         text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- ── Índices ───────────────────────────────────────────────────
create index if not exists idx_suppliers_business  on suppliers(business_id, active);
create index if not exists idx_sup_products_sup    on supplier_products(supplier_id);
create index if not exists idx_sup_products_biz    on supplier_products(business_id);

-- ── Triggers updated_at ───────────────────────────────────────
create trigger set_updated_at_suppliers
  before update on suppliers
  for each row execute function update_updated_at();

create trigger set_updated_at_sup_products
  before update on supplier_products
  for each row execute function update_updated_at();

-- ── RLS ───────────────────────────────────────────────────────
alter table suppliers          enable row level security;
alter table supplier_products  enable row level security;

create policy "comercio gestiona suppliers"
  on suppliers for all
  using  (business_id = get_my_business_id() or is_superadmin())
  with check (business_id = get_my_business_id() or is_superadmin());

create policy "comercio gestiona supplier_products"
  on supplier_products for all
  using  (business_id = get_my_business_id() or is_superadmin())
  with check (business_id = get_my_business_id() or is_superadmin());

-- ── Migrar proveedores existentes desde inventory_items ───────
-- Si ya tenías items con campo "supplier" en texto, esto los crea
-- automáticamente como proveedores reales.
-- (Ejecutar solo si tenés datos previos en inventory_items)

-- insert into suppliers (business_id, name)
-- select distinct business_id, supplier
-- from inventory_items
-- where supplier is not null and supplier != ''
-- on conflict do nothing;
