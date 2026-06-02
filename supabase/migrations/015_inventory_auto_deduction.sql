-- ============================================================
-- 015_inventory_auto_deduction.sql
-- Conecta Inventario ↔ Ventas automáticamente:
--   • Al confirmar un pedido → descuenta stock
--   • Al cancelar (post-confirmación) → devuelve stock
--   • Soporta productos simples (1 ítem) y compuestos (receta)
-- SECURITY DEFINER: corre como owner para bypassear RLS
-- cuando el pedido llega por la API pública (sin auth.uid)
-- ============================================================

-- ─────────────────────────────────────────────────────────────
-- Función principal
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION fn_deduct_inventory_on_order_confirm()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r_item RECORD;
  r_ing  RECORD;
BEGIN

  -- ── CASO 1: pedido confirmado → descontar stock ─────────────
  -- Dispara solo cuando el status pasa a 'confirmed' desde 'pending'
  IF NEW.status = 'confirmed' AND OLD.status = 'pending' THEN

    -- Idempotencia: si ya existen movimientos para este pedido, no duplicar
    IF EXISTS (
      SELECT 1 FROM inventory_movements WHERE order_id = NEW.id LIMIT 1
    ) THEN
      RETURN NEW;
    END IF;

    FOR r_item IN
      SELECT
        oi.quantity,
        p.product_type,
        p.inventory_item_id,
        oi.product_id
      FROM order_items oi
      JOIN products p ON p.id = oi.product_id
      WHERE oi.order_id = NEW.id
        AND p.product_type IN ('simple', 'composite')
    LOOP

      -- Producto simple → descontar el ítem vinculado
      IF r_item.product_type = 'simple'
         AND r_item.inventory_item_id IS NOT NULL THEN

        INSERT INTO inventory_movements (
          business_id, item_id, order_id, type,
          quantity, stock_before, stock_after, reason
        )
        VALUES (
          NEW.business_id,
          r_item.inventory_item_id,
          NEW.id,
          'salida',
          -(r_item.quantity),
          0, 0,  -- el trigger apply_inventory_movement sobreescribe estos
          'Venta — Pedido #' || NEW.order_number
        );

      -- Producto compuesto → descontar cada ingrediente de la receta
      ELSIF r_item.product_type = 'composite' THEN

        FOR r_ing IN
          SELECT pi.inventory_item_id, pi.quantity AS ing_qty
          FROM product_ingredients pi
          WHERE pi.product_id = r_item.product_id
        LOOP

          INSERT INTO inventory_movements (
            business_id, item_id, order_id, type,
            quantity, stock_before, stock_after, reason
          )
          VALUES (
            NEW.business_id,
            r_ing.inventory_item_id,
            NEW.id,
            'salida',
            -(r_ing.ing_qty * r_item.quantity),
            0, 0,
            'Venta (receta) — Pedido #' || NEW.order_number
          );

        END LOOP;
      END IF;

    END LOOP;

  -- ── CASO 2: pedido cancelado post-confirmación → devolver stock
  ELSIF NEW.status = 'cancelled'
        AND OLD.status IN ('confirmed', 'preparing', 'ready', 'shipped') THEN

    FOR r_item IN
      SELECT
        oi.quantity,
        p.product_type,
        p.inventory_item_id,
        oi.product_id
      FROM order_items oi
      JOIN products p ON p.id = oi.product_id
      WHERE oi.order_id = NEW.id
        AND p.product_type IN ('simple', 'composite')
    LOOP

      IF r_item.product_type = 'simple'
         AND r_item.inventory_item_id IS NOT NULL THEN

        -- Solo devolver si hubo descuento previo
        IF EXISTS (
          SELECT 1 FROM inventory_movements
          WHERE order_id = NEW.id
            AND item_id  = r_item.inventory_item_id
            AND type     = 'salida'
          LIMIT 1
        ) THEN
          INSERT INTO inventory_movements (
            business_id, item_id, order_id, type,
            quantity, stock_before, stock_after, reason
          )
          VALUES (
            NEW.business_id,
            r_item.inventory_item_id,
            NEW.id,
            'devolucion',
            r_item.quantity,
            0, 0,
            'Cancelación — Pedido #' || NEW.order_number
          );
        END IF;

      ELSIF r_item.product_type = 'composite' THEN

        FOR r_ing IN
          SELECT pi.inventory_item_id, pi.quantity AS ing_qty
          FROM product_ingredients pi
          WHERE pi.product_id = r_item.product_id
        LOOP

          IF EXISTS (
            SELECT 1 FROM inventory_movements
            WHERE order_id = NEW.id
              AND item_id  = r_ing.inventory_item_id
              AND type     = 'salida'
            LIMIT 1
          ) THEN
            INSERT INTO inventory_movements (
              business_id, item_id, order_id, type,
              quantity, stock_before, stock_after, reason
            )
            VALUES (
              NEW.business_id,
              r_ing.inventory_item_id,
              NEW.id,
              'devolucion',
              r_ing.ing_qty * r_item.quantity,
              0, 0,
              'Cancelación (receta) — Pedido #' || NEW.order_number
            );
          END IF;

        END LOOP;
      END IF;

    END LOOP;

  END IF;

  RETURN NEW;
END;
$$;

-- ─────────────────────────────────────────────────────────────
-- Trigger en orders
-- ─────────────────────────────────────────────────────────────
DROP TRIGGER IF EXISTS trg_deduct_inventory_on_order ON orders;

CREATE TRIGGER trg_deduct_inventory_on_order
  AFTER UPDATE ON orders
  FOR EACH ROW
  EXECUTE FUNCTION fn_deduct_inventory_on_order_confirm();

-- ─────────────────────────────────────────────────────────────
-- Índice para acelerar el lookup de movimientos por pedido
-- ─────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_inv_movements_order
  ON inventory_movements(order_id)
  WHERE order_id IS NOT NULL;
