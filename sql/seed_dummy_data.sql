-- ProjectHub demo seed data
-- Safe to run multiple times. Uses [DEMO] prefix and +demo emails.

BEGIN;

-- Demo members
INSERT INTO members (name, email, role)
SELECT *
FROM (
  VALUES
    ('[DEMO] Ava Product', 'ava+demo@projecthub.local', 'admin'),
    ('[DEMO] Ben Engineer', 'ben+demo@projecthub.local', 'member'),
    ('[DEMO] Chloe Design', 'chloe+demo@projecthub.local', 'member'),
    ('[DEMO] David Ops', 'david+demo@projecthub.local', 'viewer'),
    ('[DEMO] Emma Finance', 'emma+demo@projecthub.local', 'viewer')
) AS incoming(name, email, role)
WHERE NOT EXISTS (
  SELECT 1 FROM members m WHERE m.email = incoming.email
);

-- Demo clients
INSERT INTO clients (name, company, contact_email, website, notes)
SELECT *
FROM (
  VALUES
    ('[DEMO] BlueHarbor Realty', 'BlueHarbor Realty Group', 'contact@blueharbor.local', 'https://blueharbor.local', 'Key real estate client for the website revamp project.'),
    ('[DEMO] Acme Corp', 'Acme Corporation', 'billing@acme.local', 'https://acme.local', 'Long-term manufacturing partner.'),
    ('[DEMO] Stellar Systems', 'Stellar Systems Inc.', 'support@stellar.local', 'https://stellar.local', 'Cloud infrastructure and security services.')
) AS incoming(name, company, contact_email, website, notes)
WHERE NOT EXISTS (
  SELECT 1 FROM clients c WHERE c.name = incoming.name
);

-- Demo projects
INSERT INTO projects (name, status, deadline, budget, description, client_name)
SELECT *
FROM (
  VALUES
    ('[DEMO] Website Revamp', 'active', CURRENT_DATE + 21, 18000, 'Landing, pricing, and onboarding refresh.', '[DEMO] BlueHarbor Realty'),
    ('[DEMO] Mobile MVP', 'on-hold', CURRENT_DATE + 45, 42000, 'Core mobile workflows and push notifications.', '[DEMO] Acme Corp'),
    ('[DEMO] Billing Automation', 'active', CURRENT_DATE + 14, 12000, 'Automate invoicing and payment reconciliation.', '[DEMO] Acme Corp'),
    ('[DEMO] Security Hardening', 'completed', CURRENT_DATE - 3, 9000, 'Security controls and dependency review.', '[DEMO] Stellar Systems')
) AS incoming(name, status, deadline, budget, description, client_name)
WHERE NOT EXISTS (
  SELECT 1 FROM projects p WHERE p.name = incoming.name
);

-- Demo tasks
INSERT INTO tasks (project_id, title, status, priority, assignee_member_id, due_date, position)
SELECT
  p.id,
  t.title,
  t.status,
  t.priority,
  m.id,
  t.due_date,
  t.position
FROM (
  VALUES
    ('[DEMO] Website Revamp', '[DEMO] Audit current pages', 'done', 'medium', 'ava+demo@projecthub.local', CURRENT_DATE + 3, 1),
    ('[DEMO] Website Revamp', '[DEMO] Build new hero section', 'in-progress', 'high', 'chloe+demo@projecthub.local', CURRENT_DATE + 6, 2),
    ('[DEMO] Website Revamp', '[DEMO] QA responsive breakpoints', 'todo', 'medium', 'ben+demo@projecthub.local', CURRENT_DATE + 10, 3),
    ('[DEMO] Mobile MVP', '[DEMO] Define auth flow', 'todo', 'high', 'david+demo@projecthub.local', CURRENT_DATE + 7, 1),
    ('[DEMO] Billing Automation', '[DEMO] Map invoice lifecycle', 'in-progress', 'urgent', 'emma+demo@projecthub.local', CURRENT_DATE + 5, 1),
    ('[DEMO] Security Hardening', '[DEMO] Verify dependency patches', 'done', 'high', 'ben+demo@projecthub.local', CURRENT_DATE - 5, 1)
) AS t(project_name, title, status, priority, assignee_email, due_date, position)
JOIN projects p ON p.name = t.project_name
LEFT JOIN members m ON m.email = t.assignee_email
WHERE NOT EXISTS (
  SELECT 1 FROM tasks existing
  WHERE existing.project_id = p.id AND existing.title = t.title
);

-- Demo project-member assignments (optional table)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'project_members'
  ) THEN
    INSERT INTO project_members (project_id, member_id)
    SELECT p.id, m.id
    FROM projects p
    JOIN members m ON m.email IN (
      'ava+demo@projecthub.local',
      'ben+demo@projecthub.local',
      'chloe+demo@projecthub.local',
      'david+demo@projecthub.local',
      'emma+demo@projecthub.local'
    )
    WHERE p.name LIKE '[DEMO]%'
      AND NOT EXISTS (
        SELECT 1
        FROM project_members pm
        WHERE pm.project_id = p.id AND pm.member_id = m.id
      );
  END IF;
END $$;

-- Demo activities
INSERT INTO project_activities (project_id, event_type, entity_type, entity_id, message, metadata)
SELECT
  p.id,
  'project_created',
  'project',
  p.id,
  'Created project ' || p.name,
  jsonb_build_object('status', p.status)
FROM projects p
WHERE p.name LIKE '[DEMO]%'
  AND NOT EXISTS (
    SELECT 1 FROM project_activities pa WHERE pa.project_id = p.id AND pa.event_type = 'project_created'
  );

COMMIT;
