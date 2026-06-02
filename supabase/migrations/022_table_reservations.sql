-- Migration 022: Table Reservations
CREATE TABLE IF NOT EXISTS table_reservations (
  id            uuid        PRIMARY KEY DEFAULT uuid_generate_v4(),
  business_id   uuid        NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  table_id      uuid        REFERENCES restaurant_tables(id) ON DELETE SET NULL,
  customer_name text        NOT NULL,
  customer_phone text,
  party_size    int         NOT NULL DEFAULT 2 CHECK (party_size > 0),
  date          date        NOT NULL,
  time          time        NOT NULL,
  notes         text,
  status        text        NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','confirmed','seated','cancelled','noshow')),
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS table_reservations_business_date ON table_reservations(business_id, date);
CREATE INDEX IF NOT EXISTS table_reservations_table_id ON table_reservations(table_id);

ALTER TABLE table_reservations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "table_reservations_business_access" ON table_reservations
  FOR ALL USING (
    business_id IN (
      SELECT business_id FROM profiles WHERE user_id = auth.uid()
    )
  );
