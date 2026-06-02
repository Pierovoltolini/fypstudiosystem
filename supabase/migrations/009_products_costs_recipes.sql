-- ============================================================
-- 009_products_costs_recipes.sql
-- Extends the product model with:
--   • business_costs table (persistent cost tracking)
--   • products: product_type, cost_price, margin_pct, inventory_item_id
--   • product_ingredients: recipe/BOM for composite products
--   • order_items: cost_price snapshot at time of sale
-- ============================================================

-- ── 1. business_costs ─────────────────────────────────────────
--    Replaces the localStorage-only approach in CostsClient.
CREATE TABLE IF NOT EXISTS business_costs (
  id            uuid            DEFAULT gen_random_uuid() PRIMARY KEY,
  business_id   uuid            REFERENCES businesses(id) ON DELETE CASCADE NOT NULL,
  name          text            NOT NULL,
  type          text            NOT NULL DEFAULT 'General',
  amount        decimal(12, 2)  NOT NULL,
  date          date            NOT NULL DEFAULT CURRENT_DATE,
  notes         text,
  created_at    timestamptz     DEFAULT now()
);

ALTER TABLE business_costs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "comercio gestiona costs"
  ON business_costs FOR ALL
  USING  (business_id = get_my_business_id() OR is_superadmin())
  WITH CHECK (business_id = get_my_business_id() OR is_superadmin());

CREATE INDEX IF NOT EXISTS idx_business_costs_business
  ON business_costs(business_id);

CREATE INDEX IF NOT EXISTS idx_business_costs_date
  ON business_costs(business_id, date);

-- ── 2. products — cost & inventory linkage columns ────────────
ALTER TABLE products
  ADD COLUMN IF NOT EXISTS product_type       text           DEFAULT 'simple'
    CHECK (product_type IN ('simple', 'composite', 'service')),
  ADD COLUMN IF NOT EXISTS cost_price         decimal(12, 2),
  ADD COLUMN IF NOT EXISTS margin_pct         decimal(5, 2)  DEFAULT 30,
  ADD COLUMN IF NOT EXISTS inventory_item_id  uuid
    REFERENCES inventory_items(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_products_inventory_item
  ON products(inventory_item_id)
  WHERE inventory_item_id IS NOT NULL;

-- ── 3. product_ingredients — recipe / bill of materials ───────
--    Each row = one raw ingredient used in a composite product.
--    quantity = how much of that inventory_item is consumed per
--               1 unit of the finished product.
CREATE TABLE IF NOT EXISTS product_ingredients (
  id                  uuid            DEFAULT gen_random_uuid() PRIMARY KEY,
  business_id         uuid            REFERENCES businesses(id)      ON DELETE CASCADE  NOT NULL,
  product_id          uuid            REFERENCES products(id)        ON DELETE CASCADE  NOT NULL,
  inventory_item_id   uuid            REFERENCES inventory_items(id) ON DELETE RESTRICT NOT NULL,
  quantity            decimal(12, 4)  NOT NULL DEFAULT 1,
  unit                text,
  created_at          timestamptz     DEFAULT now(),
  UNIQUE (product_id, inventory_item_id)
);

ALTER TABLE product_ingredients ENABLE ROW LEVEL SECURITY;

CREATE POLICY "comercio gestiona ingredients"
  ON product_ingredients FOR ALL
  USING  (business_id = get_my_business_id() OR is_superadmin())
  WITH CHECK (business_id = get_my_business_id() OR is_superadmin());

CREATE INDEX IF NOT EXISTS idx_product_ingredients_product
  ON product_ingredients(product_id);

CREATE INDEX IF NOT EXISTS idx_product_ingredients_item
  ON product_ingredients(inventory_item_id);

-- ── 4. order_items — cost snapshot at time of sale ────────────
--    Storing cost_price here allows historical COGS analysis
--    even if product cost changes later.
ALTER TABLE order_items
  ADD COLUMN IF NOT EXISTS cost_price decimal(12, 2);
