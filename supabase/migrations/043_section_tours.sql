CREATE TABLE IF NOT EXISTS user_section_tours (
  user_id  uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  section  text NOT NULL,
  seen_at  timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, section)
);

ALTER TABLE user_section_tours ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users manage own tours"
  ON user_section_tours FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
