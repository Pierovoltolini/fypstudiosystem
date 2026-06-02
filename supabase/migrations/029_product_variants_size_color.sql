-- 029_product_variants_size_color.sql
-- Fix: migration 025_product_variants_size_color.sql was never applied because
-- 025_delivery_zones.sql already claimed version 025.
ALTER TABLE product_variants
  ADD COLUMN IF NOT EXISTS size  text,
  ADD COLUMN IF NOT EXISTS color text;
