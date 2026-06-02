-- ============================================================
-- 012_tables.sql — Gestión avanzada de mesas (gastro)
-- Ejecutar DESPUÉS de 006_food.sql
-- ============================================================
-- Tablas: restaurant_tables, table_sessions
-- Columnas en orders: table_id, session_id
-- Triggers: updated_at, sync status mesa ↔ sesión, acumular total
-- Vista: v_active_tables (estado en tiempo real con pedidos activos)
-- RLS + Realtime
-- ============================================================

-- ── restaurant_tables ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS restaurant_tables (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid        NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  name        text        NOT NULL,                        -- "Mesa 1", "Terraza 4", "Barra"
  section     text,                                        -- "Salón", "Terraza", "VIP", "Barra"
  capacity    int         NOT NULL DEFAULT 4 CHECK (capacity > 0),
  shape       text        NOT NULL DEFAULT 'square'
                CHECK (shape IN ('square', 'round', 'rectangle')),
  color       text        NOT NULL DEFAULT '#6366F1',      -- color en el floor plan
  x_pos       numeric(6,2) NOT NULL DEFAULT 0,             -- posición X en el plano (%)
  y_pos       numeric(6,2) NOT NULL DEFAULT 0,             -- posición Y en el plano (%)
  status      text        NOT NULL DEFAULT 'free'
                CHECK (status IN ('free', 'occupied', 'reserved', 'unavailable')),
  active      boolean     NOT NULL DEFAULT true,
  sort_order  int         NOT NULL DEFAULT 0,
  notes       text,                                        -- notas internas del local
  qr_token    uuid        NOT NULL DEFAULT gen_random_uuid() UNIQUE,  -- token regenerable para QR
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

-- ── Sesiones de mesa ───────────────────────────────────────────
-- Una sesión = una ocupación de la mesa (desde que se sienta hasta que paga)
CREATE TABLE IF NOT EXISTS table_sessions (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id  uuid        NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  table_id     uuid        NOT NULL REFERENCES restaurant_tables(id) ON DELETE CASCADE,
  opened_at    timestamptz NOT NULL DEFAULT now(),
  closed_at    timestamptz,
  people_count int         NOT NULL DEFAULT 1 CHECK (people_count > 0),
  waiter_name  text,                                       -- nombre del mozo/a
  notes        text,
  total_billed numeric(10,2) NOT NULL DEFAULT 0,           -- suma de pedidos confirmados
  status       text        NOT NULL DEFAULT 'open'
                CHECK (status IN ('open', 'closed', 'voided')),
  created_at   timestamptz NOT NULL DEFAULT now()
);

-- ── Agregar columnas a orders ──────────────────────────────────
ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS table_id   uuid REFERENCES restaurant_tables(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS session_id uuid REFERENCES table_sessions(id)    ON DELETE SET NULL;

-- ── Índices ────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_restaurant_tables_business
  ON restaurant_tables(business_id) WHERE active = true;
CREATE INDEX IF NOT EXISTS idx_restaurant_tables_status
  ON restaurant_tables(business_id, status);
CREATE INDEX IF NOT EXISTS idx_restaurant_tables_section
  ON restaurant_tables(business_id, section) WHERE section IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_table_sessions_table
  ON table_sessions(table_id);
CREATE INDEX IF NOT EXISTS idx_table_sessions_business
  ON table_sessions(business_id);
CREATE INDEX IF NOT EXISTS idx_table_sessions_open
  ON table_sessions(business_id) WHERE status = 'open';
CREATE INDEX IF NOT EXISTS idx_orders_table
  ON orders(table_id) WHERE table_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_orders_session
  ON orders(session_id) WHERE session_id IS NOT NULL;

-- ── Trigger: updated_at en restaurant_tables ──────────────────
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.triggers
    WHERE trigger_name = 'set_updated_at_restaurant_tables'
  ) THEN
    CREATE TRIGGER set_updated_at_restaurant_tables
      BEFORE UPDATE ON restaurant_tables
      FOR EACH ROW EXECUTE FUNCTION update_updated_at();
  END IF;
END $$;

-- ── Trigger: sincronizar status de la mesa con la sesión ───────
-- Mesa → 'occupied' al abrir sesión
-- Mesa → 'free' al cerrar/anular sesión (si no hay otra abierta)
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
      SET status = 'free', updated_at = now()
      WHERE id = NEW.table_id;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.triggers
    WHERE trigger_name = 'trg_sync_table_status'
  ) THEN
    CREATE TRIGGER trg_sync_table_status
      AFTER INSERT OR UPDATE OF status ON table_sessions
      FOR EACH ROW EXECUTE FUNCTION sync_table_status_from_session();
  END IF;
END $$;

-- ── Trigger: acumular total de la sesión al confirmar pedidos ──
CREATE OR REPLACE FUNCTION update_session_total()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.session_id IS NOT NULL THEN
    UPDATE table_sessions
    SET total_billed = (
      SELECT COALESCE(SUM(total), 0)
      FROM orders
      WHERE session_id = NEW.session_id
        AND confirmed_sale = true
    )
    WHERE id = NEW.session_id;
  END IF;
  RETURN NEW;
END;
$$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.triggers
    WHERE trigger_name = 'trg_update_session_total'
  ) THEN
    CREATE TRIGGER trg_update_session_total
      AFTER INSERT OR UPDATE OF confirmed_sale, total ON orders
      FOR EACH ROW EXECUTE FUNCTION update_session_total();
  END IF;
END $$;

-- ── Vista: estado en tiempo real de todas las mesas ───────────
-- Muestra sesión activa, total acumulado y cantidad de pedidos en curso
CREATE OR REPLACE VIEW v_active_tables AS
SELECT
  t.id,
  t.business_id,
  t.name,
  t.section,
  t.capacity,
  t.shape,
  t.color,
  t.x_pos,
  t.y_pos,
  t.status,
  t.sort_order,
  t.qr_token,
  t.notes,
  s.id            AS session_id,
  s.opened_at     AS session_opened_at,
  s.people_count  AS session_people,
  s.waiter_name   AS session_waiter,
  s.total_billed  AS session_total,
  COUNT(o.id)     AS pending_orders,
  EXTRACT(EPOCH FROM (now() - s.opened_at)) / 60 AS session_minutes
FROM restaurant_tables t
LEFT JOIN table_sessions s
  ON s.table_id = t.id AND s.status = 'open'
LEFT JOIN orders o
  ON o.session_id = s.id
  AND o.status IN ('pending', 'confirmed', 'preparing', 'ready')
WHERE t.active = true
GROUP BY t.id, t.business_id, t.name, t.section, t.capacity,
         t.shape, t.color, t.x_pos, t.y_pos, t.status,
         t.sort_order, t.qr_token, t.notes,
         s.id, s.opened_at, s.people_count, s.waiter_name, s.total_billed;

-- ── RLS ────────────────────────────────────────────────────────
ALTER TABLE restaurant_tables ENABLE ROW LEVEL SECURITY;
ALTER TABLE table_sessions    ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  -- Dueño y staff gestionan sus mesas
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'restaurant_tables' AND policyname = 'owner_manage_tables'
  ) THEN
    CREATE POLICY "owner_manage_tables" ON restaurant_tables FOR ALL
      USING  (business_id = get_my_business_id() OR is_superadmin())
      WITH CHECK (business_id = get_my_business_id() OR is_superadmin());
  END IF;
  -- La tienda pública puede leer mesas activas (para el QR)
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'restaurant_tables' AND policyname = 'store_read_tables'
  ) THEN
    CREATE POLICY "store_read_tables" ON restaurant_tables FOR SELECT
      USING (active = true);
  END IF;
END $$;

DO $$ BEGIN
  -- Dueño y staff gestionan sesiones
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'table_sessions' AND policyname = 'owner_manage_sessions'
  ) THEN
    CREATE POLICY "owner_manage_sessions" ON table_sessions FOR ALL
      USING  (business_id = get_my_business_id() OR is_superadmin())
      WITH CHECK (business_id = get_my_business_id() OR is_superadmin());
  END IF;
  -- La API de pedidos puede insertar sesiones sin autenticación de usuario
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'table_sessions' AND policyname = 'api_insert_session'
  ) THEN
    CREATE POLICY "api_insert_session" ON table_sessions FOR INSERT
      WITH CHECK (true);
  END IF;
END $$;

-- ── Realtime ───────────────────────────────────────────────────
ALTER PUBLICATION supabase_realtime ADD TABLE restaurant_tables;
ALTER PUBLICATION supabase_realtime ADD TABLE table_sessions;
