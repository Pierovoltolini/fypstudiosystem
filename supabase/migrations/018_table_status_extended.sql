-- ============================================================
-- 018_table_status_extended.sql
-- Extiende los estados de mesas con señales operativas en tiempo real:
--   waiting_attention  — cliente llamó al mozo desde el QR
--   bill_requested     — cliente pidió la cuenta desde el QR
--   needs_cleaning     — mesa cerrada, pendiente de limpieza
-- ============================================================

-- Eliminar constraint anterior y reemplazar con los nuevos valores
ALTER TABLE restaurant_tables
  DROP CONSTRAINT IF EXISTS restaurant_tables_status_check;

ALTER TABLE restaurant_tables
  ADD CONSTRAINT restaurant_tables_status_check
  CHECK (status IN (
    'free', 'occupied', 'reserved', 'unavailable',
    'waiting_attention', 'bill_requested', 'needs_cleaning'
  ));

-- Al cerrar una sesión, la mesa pasa a needs_cleaning (no free directo)
CREATE OR REPLACE FUNCTION sync_table_status_from_session()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'INSERT' AND NEW.status = 'open' THEN
    UPDATE restaurant_tables
    SET status = 'occupied', updated_at = now()
    WHERE id = NEW.table_id;

  ELSIF TG_OP = 'UPDATE'
    AND NEW.status IN ('closed', 'voided')
    AND OLD.status = 'open'
  THEN
    IF NOT EXISTS (
      SELECT 1 FROM table_sessions
      WHERE table_id = NEW.table_id
        AND status = 'open'
        AND id <> NEW.id
    ) THEN
      UPDATE restaurant_tables
      SET status = 'needs_cleaning', updated_at = now()
      WHERE id = NEW.table_id;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

-- Agregar columna alert_at a table_sessions (cuando se activó la última alerta)
ALTER TABLE table_sessions
  ADD COLUMN IF NOT EXISTS last_alert   text,        -- 'waiter' | 'bill' | null
  ADD COLUMN IF NOT EXISTS alert_at     timestamptz; -- timestamp de la última solicitud
