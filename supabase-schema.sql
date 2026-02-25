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

CREATE POLICY "Admins can insert members" ON members
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

CREATE POLICY "Admins can update members" ON members
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE id = auth.uid() AND role = 'admin'
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
-- 3. PROJECTS TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'on-hold', 'completed')),
  deadline DATE,
  budget DECIMAL(12,2),
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

-- Insert demo members
INSERT INTO members (name, email, role) VALUES
  ('John Smith', 'john@projecthub.com', 'developer'),
  ('Sarah Johnson', 'sarah@projecthub.com', 'PM'),
  ('Mike Davis', 'mike@projecthub.com', 'designer'),
  ('Emily Brown', 'emily@projecthub.com', 'accountant'),
  ('Alex Wilson', 'alex@projecthub.com', 'developer')
ON CONFLICT DO NOTHING;

-- Insert demo projects
INSERT INTO projects (name, status, deadline, budget, description) VALUES
  ('Website Redesign', 'active', '2026-03-15', 15000, 'Complete redesign of company website with new branding'),
  ('Mobile App Development', 'on-hold', '2026-04-01', 45000, 'iOS and Android app for client portal'),
  ('API Integration', 'completed', '2026-02-28', 8500, 'Integrate payment gateway and CRM'),
  ('Database Migration', 'active', '2026-05-15', 25000, 'Migrate from MySQL to PostgreSQL'),
  ('Security Audit', 'active', '2026-03-30', 12000, 'Comprehensive security review and penetration testing'),
  ('Q1 Financial Report', 'completed', '2026-01-31', 5000, 'Quarterly financial statements and analysis'),
  ('Cloud Infrastructure Setup', 'on-hold', '2026-06-01', 35000, 'AWS infrastructure for production environment'),
  ('Mobile App Phase 2', 'active', '2026-07-15', 28000, 'Add push notifications and analytics');

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
