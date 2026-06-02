-- Migration 021: Discount Codes / Cupones
CREATE TABLE IF NOT EXISTS discount_codes (
  id          uuid    PRIMARY KEY DEFAULT uuid_generate_v4(),
  business_id uuid    NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  code        text    NOT NULL,
  type        text    NOT NULL DEFAULT 'percent' CHECK (type IN ('percent','fixed')),
  value       numeric(10,2) NOT NULL CHECK (value > 0),
  min_order   numeric(10,2) NOT NULL DEFAULT 0,
  max_uses    int,
  uses_count  int     NOT NULL DEFAULT 0,
  active      boolean NOT NULL DEFAULT true,
  expires_at  timestamptz,
  created_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE(business_id, code)
);

CREATE INDEX IF NOT EXISTS discount_codes_business_id_idx ON discount_codes(business_id);

ALTER TABLE discount_codes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "discount_codes_business_access" ON discount_codes
  FOR ALL USING (
    business_id IN (
      SELECT business_id FROM profiles WHERE user_id = auth.uid()
    )
  );

-- Helper: atomically increment uses_count
CREATE OR REPLACE FUNCTION increment_coupon_uses(p_business_id uuid, p_code text)
RETURNS void LANGUAGE sql SECURITY DEFINER AS $$
  UPDATE discount_codes
  SET uses_count = uses_count + 1
  WHERE business_id = p_business_id AND LOWER(code) = LOWER(p_code);
$$;

-- Track discount on orders
ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS discount_code   text,
  ADD COLUMN IF NOT EXISTS discount_amount numeric(10,2) NOT NULL DEFAULT 0;
