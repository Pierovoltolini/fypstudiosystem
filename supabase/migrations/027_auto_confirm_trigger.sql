-- 027_auto_confirm_trigger.sql
-- Auto-set confirmed_sale based on order status transitions.
-- 'delivered' and 'done' → confirmed_sale = true
-- 'cancelled'            → confirmed_sale = false

CREATE OR REPLACE FUNCTION fn_auto_confirm_sale()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.status IN ('delivered', 'done') THEN
    NEW.confirmed_sale := TRUE;
  ELSIF NEW.status = 'cancelled' THEN
    NEW.confirmed_sale := FALSE;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_auto_confirm_sale ON orders;

CREATE TRIGGER trg_auto_confirm_sale
  BEFORE UPDATE ON orders
  FOR EACH ROW
  EXECUTE FUNCTION fn_auto_confirm_sale();
