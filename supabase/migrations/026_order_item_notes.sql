-- 026_order_item_notes.sql
-- Per-item customer instructions (e.g. "sin cebolla", "extra salsa")
ALTER TABLE order_items
  ADD COLUMN IF NOT EXISTS note text;
