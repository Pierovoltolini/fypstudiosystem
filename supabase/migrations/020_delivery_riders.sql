-- Migration 020: Delivery Riders
-- Registers delivery staff and allows assigning orders to specific riders

CREATE TABLE IF NOT EXISTS delivery_riders (
  id          uuid    PRIMARY KEY DEFAULT uuid_generate_v4(),
  business_id uuid    NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  name        text    NOT NULL,
  phone       text,
  active      boolean NOT NULL DEFAULT true,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS delivery_riders_business_id_idx ON delivery_riders(business_id);

ALTER TABLE delivery_riders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "delivery_riders_business_access" ON delivery_riders
  FOR ALL USING (
    business_id IN (
      SELECT business_id FROM profiles WHERE user_id = auth.uid()
    )
  );

-- Add rider assignment to orders
ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS rider_id uuid REFERENCES delivery_riders(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS orders_rider_id_idx ON orders(rider_id);
