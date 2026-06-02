-- Allow dine_in as a delivery_type for table QR orders
ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_delivery_type_check;
ALTER TABLE orders ADD CONSTRAINT orders_delivery_type_check
  CHECK (delivery_type IN ('delivery', 'pickup', 'dine_in'));
