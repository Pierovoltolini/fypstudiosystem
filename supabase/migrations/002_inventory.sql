-- ============================================================
-- FYP.STUDIO — Módulo Inventario/Stock
-- Ejecutar en Supabase SQL Editor DESPUÉS de 001_initial.sql
-- ============================================================

-- ── Categorías de inventario (separadas de las de productos) ──
create table if not exists inventory_categories (
  id          uuid primary key default uuid_generate_v4(),
  business_id uuid not null references businesses(id) on delete cascade,
  name        text not null,
  color       text not null default '#1565FF',  -- color del badge
  icon        text not null default '📦',
  created_at  timestamptz not null default now()
);

-- ── Items de inventario ────────────────────────────────────────
create table if not exists inventory_items (
  id              uuid primary key default uuid_generate_v4(),
  business_id     uuid not null references businesses(id) on delete cascade,
  category_id     uuid references inventory_categories(id) on delete set null,
  product_id      uuid references products(id) on delete set null, -- opcional: vincular a producto
  name            text not null,
  sku             text,                        -- código interno
  unit            text not null default 'unidad', -- unidad, kg, litro, caja, etc.
  stock_current   numeric(10,2) not null default 0,
  stock_min       numeric(10,2) not null default 0,  -- alerta si baja de aquí
  stock_max       numeric(10,2),               -- stock ideal máximo
  cost_price      numeric(10,2),               -- precio de costo
  supplier        text,                        -- proveedor
  notes           text,
  active          boolean not null default true,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique(business_id, sku)
);

-- ── Movimientos de stock (entradas, salidas, ajustes) ─────────
create table if not exists inventory_movements (
  id          uuid primary key default uuid_generate_v4(),
  business_id uuid not null references businesses(id) on delete cascade,
  item_id     uuid not null references inventory_items(id) on delete cascade,
  order_id    uuid references orders(id) on delete set null, -- si viene de un pedido
  type        text not null check (type in ('entrada','salida','ajuste','devolucion')),
  quantity    numeric(10,2) not null,          -- positivo=entrada, negativo=salida
  stock_before numeric(10,2) not null,
  stock_after  numeric(10,2) not null,
  reason      text,                            -- motivo del movimiento
  created_by  text,                            -- email del usuario
  created_at  timestamptz not null default now()
);

-- ── Índices ────────────────────────────────────────────────────
create index if not exists idx_inv_items_business   on inventory_items(business_id, active);
create index if not exists idx_inv_items_low_stock  on inventory_items(business_id, stock_current, stock_min);
create index if not exists idx_inv_movements_item   on inventory_movements(item_id, created_at desc);
create index if not exists idx_inv_movements_biz    on inventory_movements(business_id, created_at desc);

-- ── Trigger updated_at ────────────────────────────────────────
create trigger set_updated_at_inv_items
  before update on inventory_items
  for each row execute function update_updated_at();

-- ── Trigger: actualizar stock_current al insertar movimiento ──
create or replace function apply_inventory_movement()
returns trigger language plpgsql as $$
begin
  -- Guardar stock antes
  select stock_current into new.stock_before
  from inventory_items where id = new.item_id;

  new.stock_after := new.stock_before + new.quantity;

  -- Actualizar stock del item
  update inventory_items
    set stock_current = new.stock_after, updated_at = now()
    where id = new.item_id;

  return new;
end;
$$;

create trigger trg_inventory_movement
  before insert on inventory_movements
  for each row execute function apply_inventory_movement();

-- ── RLS ───────────────────────────────────────────────────────
alter table inventory_categories enable row level security;
alter table inventory_items       enable row level security;
alter table inventory_movements   enable row level security;

create policy "comercio gestiona inv_categories"
  on inventory_categories for all
  using (business_id = get_my_business_id() or is_superadmin())
  with check (business_id = get_my_business_id() or is_superadmin());

create policy "comercio gestiona inv_items"
  on inventory_items for all
  using (business_id = get_my_business_id() or is_superadmin())
  with check (business_id = get_my_business_id() or is_superadmin());

create policy "comercio gestiona inv_movements"
  on inventory_movements for all
  using (business_id = get_my_business_id() or is_superadmin())
  with check (business_id = get_my_business_id() or is_superadmin());

-- ── Datos de ejemplo (comentar si no querés seed) ─────────────
-- insert into inventory_categories (business_id, name, color, icon)
-- select id, 'Bebidas', '#1565FF', '🥤' from businesses limit 1;
