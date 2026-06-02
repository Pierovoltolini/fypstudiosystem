-- 030_table_alert_minutes.sql
-- Allow owners to configure a per-table delay alert (in minutes)
ALTER TABLE restaurant_tables
  ADD COLUMN IF NOT EXISTS alert_after_minutes int;
