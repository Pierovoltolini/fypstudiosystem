-- 031_inventory_fashion_attrs.sql
-- Agrega atributos de moda/indumentaria a inventory_items
ALTER TABLE inventory_items
  ADD COLUMN IF NOT EXISTS talle      text,
  ADD COLUMN IF NOT EXISTS modelo     text,
  ADD COLUMN IF NOT EXISTS color_attr text;
