-- Migration 023: Loyalty Points Program
-- One config row per business + a ledger of point transactions

CREATE TABLE IF NOT EXISTS loyalty_settings (
  business_id      uuid    PRIMARY KEY REFERENCES businesses(id) ON DELETE CASCADE,
  enabled          boolean NOT NULL DEFAULT false,
  points_per_unit  numeric(6,2) NOT NULL DEFAULT 1,   -- points earned per currency unit spent
  redeem_ratio     numeric(6,2) NOT NULL DEFAULT 100, -- how many points = 1 currency unit
  min_redeem       int     NOT NULL DEFAULT 100,       -- minimum points to redeem
  welcome_points   int     NOT NULL DEFAULT 0,         -- bonus on first order
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE loyalty_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "loyalty_settings_access" ON loyalty_settings
  FOR ALL USING (
    business_id IN (SELECT business_id FROM profiles WHERE user_id = auth.uid())
  );

-- Points ledger (positive = earned, negative = redeemed)
CREATE TABLE IF NOT EXISTS loyalty_points (
  id          uuid        PRIMARY KEY DEFAULT uuid_generate_v4(),
  business_id uuid        NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  customer_id uuid        NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  order_id    uuid        REFERENCES orders(id) ON DELETE SET NULL,
  points      int         NOT NULL,   -- positive = earned, negative = redeemed
  reason      text        NOT NULL,   -- 'earned', 'redeemed', 'manual', 'welcome'
  note        text,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS loyalty_points_customer_id ON loyalty_points(customer_id);
CREATE INDEX IF NOT EXISTS loyalty_points_business_id ON loyalty_points(business_id);

ALTER TABLE loyalty_points ENABLE ROW LEVEL SECURITY;
CREATE POLICY "loyalty_points_access" ON loyalty_points
  FOR ALL USING (
    business_id IN (SELECT business_id FROM profiles WHERE user_id = auth.uid())
  );

-- Track loyalty redemption on orders
ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS loyalty_points_earned   int NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS loyalty_points_redeemed int NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS loyalty_discount        numeric(10,2) NOT NULL DEFAULT 0;

-- Helper: get total points balance for a customer
CREATE OR REPLACE FUNCTION get_customer_points(p_business_id uuid, p_customer_id uuid)
RETURNS int LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT COALESCE(SUM(points), 0)::int
  FROM loyalty_points
  WHERE business_id = p_business_id AND customer_id = p_customer_id;
$$;
