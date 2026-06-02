-- 011_product_variants.sql
CREATE TABLE IF NOT EXISTS product_variants (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id    uuid NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  business_id   uuid NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  name          text NOT NULL,
  sku           text,
  price_modifier numeric(10,2) NOT NULL DEFAULT 0,
  stock         int NOT NULL DEFAULT 0,
  active        boolean NOT NULL DEFAULT true,
  sort_order    int NOT NULL DEFAULT 0,
  created_at    timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE product_variants ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename  = 'product_variants'
      AND policyname = 'owner_access'
  ) THEN
    CREATE POLICY "owner_access" ON product_variants
      USING (business_id IN (
        SELECT business_id FROM profiles WHERE user_id = auth.uid()
      ))
      WITH CHECK (business_id IN (
        SELECT business_id FROM profiles WHERE user_id = auth.uid()
      ));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_product_variants_product ON product_variants(product_id);
CREATE INDEX IF NOT EXISTS idx_product_variants_business ON product_variants(business_id);
