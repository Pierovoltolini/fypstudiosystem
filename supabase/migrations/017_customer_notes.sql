-- 017_customer_notes.sql
ALTER TABLE customers
  ADD COLUMN IF NOT EXISTS notes text,
  ADD COLUMN IF NOT EXISTS tags  text[] NOT NULL DEFAULT '{}';
