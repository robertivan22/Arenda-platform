-- ─── Contact Messages ────────────────────────────────────────────────────────
-- Run this in Supabase Dashboard → SQL Editor

CREATE TABLE IF NOT EXISTS contact_messages (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT        NOT NULL,
  email       TEXT        NOT NULL,
  phone       TEXT,
  company     TEXT,
  message     TEXT        NOT NULL,
  is_read     BOOLEAN     NOT NULL DEFAULT false,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Enable Row Level Security
ALTER TABLE contact_messages ENABLE ROW LEVEL SECURITY;

-- Anyone (including unauthenticated visitors) can submit a contact form
CREATE POLICY "contact_messages_insert_anon"
  ON contact_messages FOR INSERT TO anon
  WITH CHECK (true);

CREATE POLICY "contact_messages_insert_auth"
  ON contact_messages FOR INSERT TO authenticated
  WITH CHECK (true);

-- Only admin users can read messages
CREATE POLICY "contact_messages_admin_select"
  ON contact_messages FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true
    )
  );

-- Only admin users can update messages (e.g. mark as read)
CREATE POLICY "contact_messages_admin_update"
  ON contact_messages FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true
    )
  );
