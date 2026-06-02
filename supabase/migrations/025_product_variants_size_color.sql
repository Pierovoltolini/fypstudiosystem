-- 025_product_variants_size_color.sql
-- Add structured size and color columns to product_variants.
-- 'name' stays NOT NULL for backward compat — auto-filled on save as "{size} / {color}".
ALTER TABLE product_variants
  ADD COLUMN IF NOT EXISTS size  text,
  ADD COLUMN IF NOT EXISTS color text;
