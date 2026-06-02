-- ============================================================
-- 010_verticals_v2.sql
-- Migra el sistema de verticales de 7 tipos planos a
-- 4 grupos (gastro / comercio / servicios / mercados)
-- + columna vertical_sub para la subcategoría específica
-- ============================================================

-- ── 1. Agregar columna vertical_sub ──────────────────────────
ALTER TABLE businesses
  ADD COLUMN IF NOT EXISTS vertical_sub text;

-- ── 2. Poblar vertical_sub ANTES de cambiar vertical_type ────
--    Así conservamos el tipo original como subcategoría
UPDATE businesses
SET vertical_sub = CASE vertical_type
  WHEN 'food'        THEN 'restaurante'
  WHEN 'barbershop'  THEN 'barberia'
  WHEN 'beauty'      THEN 'estetica'
  WHEN 'services'    THEN 'profesional'
  WHEN 'fashion'     THEN 'ropa'
  WHEN 'general'     THEN 'barrio'
  WHEN 'real_estate' THEN 'barrio'
  -- Ya tiene grupo nuevo (caso de inserción posterior a esta migración)
  WHEN 'gastro'      THEN COALESCE(vertical_sub, 'restaurante')
  WHEN 'comercio'    THEN COALESCE(vertical_sub, 'barrio')
  WHEN 'servicios'   THEN COALESCE(vertical_sub, 'barberia')
  WHEN 'mercados'    THEN COALESCE(vertical_sub, 'supermercado')
  ELSE NULL
END
WHERE vertical_sub IS NULL
  AND vertical_type IS NOT NULL;

-- ── 3. Migrar vertical_type a los 4 grupos nuevos ────────────
--    real_estate se mantiene tal cual (no está en los 4 grupos)
UPDATE businesses
SET vertical_type = CASE vertical_type
  WHEN 'food'       THEN 'gastro'
  WHEN 'barbershop' THEN 'servicios'
  WHEN 'beauty'     THEN 'servicios'
  WHEN 'services'   THEN 'servicios'
  WHEN 'fashion'    THEN 'comercio'
  WHEN 'general'    THEN 'comercio'
  ELSE vertical_type   -- gastro/comercio/servicios/mercados/real_estate quedan igual
END
WHERE vertical_type IN ('food', 'barbershop', 'beauty', 'services', 'fashion', 'general');

-- ── 4. Índice para filtrar por vertical ──────────────────────
CREATE INDEX IF NOT EXISTS idx_businesses_vertical
  ON businesses(vertical_type, vertical_sub);
