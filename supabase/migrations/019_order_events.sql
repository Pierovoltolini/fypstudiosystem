-- Migration 019: Order Events / Timeline
-- Creates order_events table and a trigger that auto-logs every status change on orders

CREATE TABLE IF NOT EXISTS order_events (
  id          uuid        PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_id    uuid        NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  business_id uuid        NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  status      text        NOT NULL,
  note        text,
  actor_name  text,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS order_events_order_id_idx ON order_events(order_id);
CREATE INDEX IF NOT EXISTS order_events_business_id_idx ON order_events(business_id);

ALTER TABLE order_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "order_events_business_access" ON order_events
  FOR ALL USING (
    business_id IN (
      SELECT business_id FROM profiles WHERE user_id = auth.uid()
    )
  );

-- Trigger: auto-insert event row on every order status change
CREATE OR REPLACE FUNCTION log_order_status_change()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    INSERT INTO order_events(order_id, business_id, status, note)
    VALUES (NEW.id, NEW.business_id, NEW.status, NULL);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_log_order_status ON orders;
CREATE TRIGGER trg_log_order_status
  AFTER UPDATE OF status ON orders
  FOR EACH ROW EXECUTE FUNCTION log_order_status_change();

-- Seed the initial 'pending' event for existing orders that have no events yet
INSERT INTO order_events (order_id, business_id, status, created_at)
SELECT id, business_id, 'pending', created_at
FROM orders
WHERE id NOT IN (SELECT DISTINCT order_id FROM order_events);
