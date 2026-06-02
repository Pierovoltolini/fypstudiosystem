-- ============================================================
-- 016_caja.sql
-- Módulo Caja / Arqueo
--   • cash_registers  — sesiones de apertura/cierre
--   • cash_movements  — movimientos manuales (ingreso / extracción)
-- ============================================================

-- ─────────────────────────────────────────────────────────────
-- Sesiones de caja
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS cash_registers (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id      uuid NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  opened_by        uuid REFERENCES profiles(id),
  closed_by        uuid REFERENCES profiles(id),
  opened_at        timestamptz NOT NULL DEFAULT now(),
  closed_at        timestamptz,
  opening_amount   numeric(12,2) NOT NULL DEFAULT 0,
  closing_amount   numeric(12,2),          -- monto físico contado al cierre
  expected_amount  numeric(12,2),          -- calculado en app: apertura + ventas + ingresos - extracciones
  difference       numeric(12,2),          -- closing_amount - expected_amount
  status           text NOT NULL DEFAULT 'open'
                     CHECK (status IN ('open','closed')),
  notes            text,
  created_at       timestamptz NOT NULL DEFAULT now()
);

-- ─────────────────────────────────────────────────────────────
-- Movimientos manuales dentro de una sesión
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS cash_movements (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id  uuid NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  register_id  uuid REFERENCES cash_registers(id) ON DELETE CASCADE,
  profile_id   uuid REFERENCES profiles(id),
  type         text NOT NULL CHECK (type IN ('ingreso','extraccion')),
  amount       numeric(12,2) NOT NULL CHECK (amount > 0),
  reason       text,
  created_at   timestamptz NOT NULL DEFAULT now()
);

-- ─────────────────────────────────────────────────────────────
-- RLS
-- ─────────────────────────────────────────────────────────────
ALTER TABLE cash_registers ENABLE ROW LEVEL SECURITY;
ALTER TABLE cash_movements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "cash_registers_own" ON cash_registers
  USING (business_id = get_my_business_id())
  WITH CHECK (business_id = get_my_business_id());

CREATE POLICY "cash_movements_own" ON cash_movements
  USING (business_id = get_my_business_id())
  WITH CHECK (business_id = get_my_business_id());

-- ─────────────────────────────────────────────────────────────
-- Índices
-- ─────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_cash_registers_business
  ON cash_registers(business_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_cash_registers_open
  ON cash_registers(business_id, status)
  WHERE status = 'open';

CREATE INDEX IF NOT EXISTS idx_cash_movements_register
  ON cash_movements(register_id, created_at DESC);
