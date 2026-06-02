-- Migration 024: Purchase Orders (Órdenes de compra)

CREATE TABLE IF NOT EXISTS purchase_orders (
  id            uuid        PRIMARY KEY DEFAULT uuid_generate_v4(),
  business_id   uuid        NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  supplier_id   uuid        REFERENCES suppliers(id) ON DELETE SET NULL,
  supplier_name text        NOT NULL,
  status        text        NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft','sent','confirmed','received','cancelled')),
  notes         text,
  expected_date date,
  received_at   timestamptz,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS purchase_orders_business_id ON purchase_orders(business_id);
CREATE INDEX IF NOT EXISTS purchase_orders_supplier_id ON purchase_orders(supplier_id);

ALTER TABLE purchase_orders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "purchase_orders_access" ON purchase_orders
  FOR ALL USING (
    business_id IN (SELECT business_id FROM profiles WHERE user_id = auth.uid())
  );

CREATE TABLE IF NOT EXISTS purchase_order_items (
  id                uuid        PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_id          uuid        NOT NULL REFERENCES purchase_orders(id) ON DELETE CASCADE,
  business_id       uuid        NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  inventory_item_id uuid        REFERENCES inventory_items(id) ON DELETE SET NULL,
  item_name         text        NOT NULL,
  unit              text        NOT NULL DEFAULT 'unidad',
  quantity_ordered  numeric(10,2) NOT NULL CHECK (quantity_ordered > 0),
  quantity_received numeric(10,2),
  unit_cost         numeric(10,2),
  created_at        timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS purchase_order_items_order_id    ON purchase_order_items(order_id);
CREATE INDEX IF NOT EXISTS purchase_order_items_business_id ON purchase_order_items(business_id);

ALTER TABLE purchase_order_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "purchase_order_items_access" ON purchase_order_items
  FOR ALL USING (
    business_id IN (SELECT business_id FROM profiles WHERE user_id = auth.uid())
  );
