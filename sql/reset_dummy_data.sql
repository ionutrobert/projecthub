-- Remove ProjectHub demo data created by sql/seed_dummy_data.sql
-- Deletes only rows tagged with [DEMO] names or +demo emails.

BEGIN;

-- Clear stars linked to demo projects (optional table)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'project_stars'
  ) THEN
    DELETE FROM project_stars
    WHERE project_id IN (
      SELECT id FROM projects WHERE name LIKE '[DEMO]%'
    );
  END IF;
END $$;

-- Clear project-member links (optional table)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'project_members'
  ) THEN
    DELETE FROM project_members
    WHERE project_id IN (
      SELECT id FROM projects WHERE name LIKE '[DEMO]%'
    )
    OR member_id IN (
      SELECT id FROM members WHERE email LIKE '%+demo@projecthub.local'
    );
  END IF;
END $$;

-- Clear demo activities
DELETE FROM project_activities
WHERE project_id IN (
  SELECT id FROM projects WHERE name LIKE '[DEMO]%'
);

-- Clear demo tasks
DELETE FROM tasks
WHERE title LIKE '[DEMO]%'
   OR project_id IN (
     SELECT id FROM projects WHERE name LIKE '[DEMO]%'
   );

-- Clear demo projects
DELETE FROM projects WHERE name LIKE '[DEMO]%';

-- Clear demo clients
DELETE FROM clients WHERE name LIKE '[DEMO]%';

-- Clear demo members
DELETE FROM members WHERE email LIKE '%+demo@projecthub.local';

-- Optional cleanup for legacy seed rows from older schema versions:
-- DELETE FROM projects WHERE name IN (
--   'Website Redesign',
--   'Mobile App Development',
--   'API Integration',
--   'Database Migration',
--   'Security Audit',
--   'Q1 Financial Report',
--   'Cloud Infrastructure Setup',
--   'Mobile App Phase 2'
-- );
-- DELETE FROM members WHERE email IN (
--   'john@projecthub.com',
--   'sarah@projecthub.com',
--   'mike@projecthub.com',
--   'emily@projecthub.com',
--   'alex@projecthub.com'
-- );

COMMIT;
