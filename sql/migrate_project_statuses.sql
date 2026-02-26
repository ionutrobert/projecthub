-- Project status migration for existing databases
-- Adds newer statuses used by the UI/API: in-progress, closed

BEGIN;

ALTER TABLE projects DROP CONSTRAINT IF EXISTS projects_status_check;

ALTER TABLE projects
ADD CONSTRAINT projects_status_check
CHECK (status IN ('active', 'in-progress', 'on-hold', 'completed', 'closed'));

COMMIT;
