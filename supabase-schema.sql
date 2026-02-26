-- =====================================================
-- PROJECTHUB DATABASE SCHEMA
-- Run this in Supabase SQL Editor
-- =====================================================

-- =====================================================
-- 1. PROFILES TABLE (links to auth.users)
-- =====================================================
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT,
  full_name TEXT,
  role TEXT DEFAULT 'viewer' CHECK (role IN ('admin', 'member', 'viewer')),
  avatar_url TEXT,
  theme_preference TEXT DEFAULT 'dark' CHECK (theme_preference IN ('light', 'dark')),
  accent_color TEXT DEFAULT '#8b5cf6',
  theme_gradient BOOLEAN DEFAULT true,
  micro_animations BOOLEAN DEFAULT true,
  nav_style TEXT DEFAULT 'sidebar' CHECK (nav_style IN ('top', 'sidebar')),
  dashboard_layout JSONB,
  dashboard_layout_mobile JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- RLS Policies for profiles
CREATE POLICY "Users can view all profiles" ON profiles
  FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Users can update own profile" ON profiles
  FOR UPDATE TO authenticated
  USING (auth.uid() = id);

CREATE POLICY "Admins can do anything with profiles" ON profiles
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- =====================================================
-- 2. MEMBERS TABLE (for project assignment)
-- =====================================================
CREATE TABLE IF NOT EXISTS members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  email TEXT,
  role TEXT DEFAULT 'developer', -- developer, designer, PM, accountant, etc.
  user_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE members ENABLE ROW LEVEL SECURITY;

-- RLS Policies for members
CREATE POLICY "Authenticated users can view members" ON members
  FOR SELECT TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Admins can insert members" ON members;
DROP POLICY IF EXISTS "Admins and members can insert members" ON members;
CREATE POLICY "Admins and members can insert members" ON members
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE id = auth.uid() AND role IN ('admin', 'member')
    )
  );

DROP POLICY IF EXISTS "Admins can update members" ON members;
DROP POLICY IF EXISTS "Admins and members can update members" ON members;
CREATE POLICY "Admins and members can update members" ON members
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE id = auth.uid() AND role IN ('admin', 'member')
    )
  );

CREATE POLICY "Admins can delete members" ON members
  FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- =====================================================
-- 3. CLIENTS TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS clients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  contact_email TEXT,
  contact_phone TEXT,
  website TEXT,
  company TEXT,
  notes TEXT,
  created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE clients ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view clients" ON clients
  FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Admins and members can insert clients" ON clients
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role IN ('admin', 'member')
    )
  );

CREATE POLICY "Admins and members can update clients" ON clients
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role IN ('admin', 'member')
    )
  );

CREATE POLICY "Admins can delete clients" ON clients
  FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- =====================================================
-- 4. PROJECTS TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  client_name TEXT,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'in-progress', 'on-hold', 'completed', 'closed')),
  start_date DATE,
  deadline DATE,
  budget DECIMAL(12,2),
  labels TEXT[] DEFAULT ARRAY[]::TEXT[],
  member_id UUID REFERENCES members(id) ON DELETE SET NULL,
  description TEXT,
  created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;

-- RLS Policies for projects
CREATE POLICY "Authenticated users can view projects" ON projects
  FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Admins can insert projects" ON projects
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE id = auth.uid() AND role IN ('admin', 'member')
    )
  );

CREATE POLICY "Admins can update projects" ON projects
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE id = auth.uid() AND role IN ('admin', 'member')
    )
  );

CREATE POLICY "Admins can delete projects" ON projects
  FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- =====================================================
-- 3.1 PROJECT_MEMBERS (many-to-many: projects ↔ members)
-- =====================================================
CREATE TABLE IF NOT EXISTS project_members (
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  member_id UUID REFERENCES members(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (project_id, member_id)
);

-- Enable RLS
ALTER TABLE project_members ENABLE ROW LEVEL SECURITY;

-- RLS: authenticated can view
CREATE POLICY "Authenticated users can view project_members" ON project_members
  FOR SELECT TO authenticated
  USING (true);

-- RLS: admins and members can assign
CREATE POLICY "Admins and members can insert project_members" ON project_members
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE id = auth.uid() AND role IN ('admin', 'member')
    )
  );

CREATE POLICY "Admins and members can delete project_members" ON project_members
  FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE id = auth.uid() AND role IN ('admin', 'member')
    )
  );

-- =====================================================
-- 3.2 PROJECT_STARS (per-user starred projects)
-- =====================================================
CREATE TABLE IF NOT EXISTS project_stars (
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (user_id, project_id)
);

-- Enable RLS
ALTER TABLE project_stars ENABLE ROW LEVEL SECURITY;

-- RLS: users can view their own stars
CREATE POLICY "Users can view own project_stars" ON project_stars
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

-- RLS: users can star projects for themselves
CREATE POLICY "Users can insert own project_stars" ON project_stars
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

-- RLS: users can remove their own stars
CREATE POLICY "Users can delete own project_stars" ON project_stars
  FOR DELETE TO authenticated
  USING (user_id = auth.uid());

-- =====================================================
-- 3.3 TASKS (project task tracking)
-- =====================================================
CREATE TABLE IF NOT EXISTS tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  status TEXT DEFAULT 'todo' CHECK (status IN ('todo', 'in-progress', 'done')),
  priority TEXT DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
  assignee_member_id UUID REFERENCES members(id) ON DELETE SET NULL,
  due_date DATE,
  position INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view tasks" ON tasks
  FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Admins and members can insert tasks" ON tasks
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role IN ('admin', 'member')
    )
  );

CREATE POLICY "Admins and members can update tasks" ON tasks
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role IN ('admin', 'member')
    )
  );

CREATE POLICY "Admins and members can delete tasks" ON tasks
  FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role IN ('admin', 'member')
    )
  );

-- =====================================================
-- 4. TRIGGER TO CREATE PROFILE ON SIGNUP
-- =====================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, role)
  VALUES (
    NEW.id,
    NEW.email,
    NEW.raw_user_meta_data->>'full_name',
    'viewer' -- Default role
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- =====================================================
-- 5. SEED DEMO DATA
-- =====================================================

-- NOTE:
-- Keep production schemas clean by managing demo data via:
--   sql/seed_dummy_data.sql
--   sql/reset_dummy_data.sql

-- =====================================================
-- 6. VERIFICATION QUERIES
-- =====================================================

-- Check tables created
-- SELECT table_name FROM information_schema.tables 
-- WHERE table_schema = 'public';

-- View current data
-- SELECT * FROM profiles;
-- SELECT * FROM members;
-- SELECT * FROM projects;

-- =====================================================
-- 7. MIGRATION FOR EXISTING USERS (run manually if needed)
-- =====================================================

-- Add theme columns to existing profiles table (if not already added via table recreation)
-- ALTER TABLE profiles ADD COLUMN IF NOT EXISTS theme_preference TEXT DEFAULT 'dark' CHECK (theme_preference IN ('light', 'dark'));
-- ALTER TABLE profiles ADD COLUMN IF NOT EXISTS accent_color TEXT DEFAULT '#8b5cf6';
-- ALTER TABLE profiles ADD COLUMN IF NOT EXISTS theme_gradient BOOLEAN DEFAULT true;
-- ALTER TABLE profiles ADD COLUMN IF NOT EXISTS micro_animations BOOLEAN DEFAULT true;
-- ALTER TABLE profiles ADD COLUMN IF NOT EXISTS nav_style TEXT DEFAULT 'sidebar' CHECK (nav_style IN ('top', 'sidebar'));
-- ALTER TABLE profiles ADD COLUMN IF NOT EXISTS dashboard_layout JSONB;
-- ALTER TABLE profiles ADD COLUMN IF NOT EXISTS dashboard_layout_mobile JSONB;

-- Projects table compatibility migrations (if table already existed before latest schema):
-- ALTER TABLE projects ADD COLUMN IF NOT EXISTS client_name TEXT;
-- ALTER TABLE projects ADD COLUMN IF NOT EXISTS start_date DATE;
-- ALTER TABLE projects ADD COLUMN IF NOT EXISTS labels TEXT[] DEFAULT ARRAY[]::TEXT[];
-- ALTER TABLE projects DROP CONSTRAINT IF EXISTS projects_status_check;
-- ALTER TABLE projects ADD CONSTRAINT projects_status_check CHECK (status IN ('active', 'in-progress', 'on-hold', 'completed', 'closed'));

-- Create clients table if it does not exist yet:
-- CREATE TABLE IF NOT EXISTS clients (
--   id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
--   name TEXT NOT NULL,
--   contact_email TEXT,
--   contact_phone TEXT,
--   website TEXT,
--   company TEXT,
--   notes TEXT,
--   created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
--   created_at TIMESTAMPTZ DEFAULT NOW(),
--   updated_at TIMESTAMPTZ DEFAULT NOW()
-- );

-- Update existing users to have a default nav style based on screen size preference (defaulting to sidebar)
-- UPDATE profiles SET nav_style = 'sidebar' WHERE nav_style IS NULL;

-- =====================================================
-- 8. INDEXES FOR PERFORMANCE
-- =====================================================

CREATE INDEX IF NOT EXISTS idx_profiles_email ON profiles(email);
CREATE INDEX IF NOT EXISTS idx_profiles_role ON profiles(role);
CREATE INDEX IF NOT EXISTS idx_projects_member ON projects(member_id);
CREATE INDEX IF NOT EXISTS idx_projects_status ON projects(status);
CREATE INDEX IF NOT EXISTS idx_projects_start_date ON projects(start_date);
CREATE INDEX IF NOT EXISTS idx_clients_name ON clients(name);
CREATE INDEX IF NOT EXISTS idx_tasks_project ON tasks(project_id);
CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);
