-- =====================================================
-- PROJECT ACTIVITIES AUDIT LOG
-- =====================================================

CREATE TABLE IF NOT EXISTS project_activities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  actor_user_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  event_type TEXT NOT NULL CHECK (
    event_type IN (
      'project_created',
      'project_updated',
      'member_added',
      'member_removed',
      'task_created',
      'task_deleted',
      'task_status_changed',
      'task_assignee_changed'
    )
  ),
  entity_type TEXT CHECK (entity_type IN ('project', 'member', 'task')),
  entity_id UUID,
  message TEXT NOT NULL,
  metadata JSONB DEFAULT '{}'::JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS project_activities_project_created_idx
  ON project_activities (project_id, created_at DESC);

CREATE INDEX IF NOT EXISTS project_activities_entity_idx
  ON project_activities (entity_type, entity_id, created_at DESC);

ALTER TABLE project_activities ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can view project activities" ON project_activities;
CREATE POLICY "Authenticated users can view project activities" ON project_activities
  FOR SELECT TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Admins and members can insert project activities" ON project_activities;
CREATE POLICY "Admins and members can insert project activities" ON project_activities
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role IN ('admin', 'member')
    )
  );
