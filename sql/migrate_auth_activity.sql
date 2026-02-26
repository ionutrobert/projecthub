-- Auth activity table for login/session history

CREATE TABLE IF NOT EXISTS auth_activity (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  email TEXT,
  event_type TEXT NOT NULL CHECK (event_type IN ('login_success', 'logout', 'session_check')),
  user_agent TEXT,
  ip_hash TEXT,
  country TEXT,
  city TEXT,
  metadata JSONB DEFAULT '{}'::JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS auth_activity_user_created_idx
  ON auth_activity (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS auth_activity_email_created_idx
  ON auth_activity (email, created_at DESC);

ALTER TABLE auth_activity ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own auth activity" ON auth_activity;
CREATE POLICY "Users can view own auth activity" ON auth_activity
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Admins can view all auth activity" ON auth_activity;
CREATE POLICY "Admins can view all auth activity" ON auth_activity
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

DROP POLICY IF EXISTS "Users can insert own auth activity" ON auth_activity;
CREATE POLICY "Users can insert own auth activity" ON auth_activity
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());
