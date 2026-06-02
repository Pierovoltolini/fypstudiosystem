-- Migration 025: Delivery Zones & per-order delivery fee tracking

-- Delivery zones stored as JSONB array: [{ id, name, fee }]
ALTER TABLE businesses
  ADD COLUMN IF NOT EXISTS delivery_zones jsonb DEFAULT '[]'::jsonb;

-- Per-order delivery fee and zone name for proper revenue tracking
ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS delivery_fee  numeric(10,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS delivery_zone text;
