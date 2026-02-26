# ProjectHub

ProjectHub is a small SaaS-style project dashboard built with Next.js and Supabase.

The goal of this repo is straightforward: sign in, manage projects, assign people, and track tasks with a clean UI and role-aware access.

## Stack

- Next.js 16 (App Router)
- React 19
- TypeScript
- Tailwind CSS
- Supabase (Postgres + Auth)

## What you can do

- Sign in/out with Supabase auth
- Access protected dashboard routes via `src/proxy.ts`
- Create, update, filter, and search projects
- Manage team members with role-aware permissions
- Manage tasks from:
  - project details page
  - dedicated `/tasks` workspace (kanban, list, calendar)
- Star projects and persist preferences
- Customize profile/theme/avatar in Settings
- Use admin impersonation for support/admin workflows

## Main routes

- `/auth/login`
- `/` (dashboard)
- `/projects`
- `/projects/new`
- `/projects/[id]`
- `/tasks`
- `/team`
- `/settings`
- `/reports`

## API overview

- `/api/projects` and `/api/projects/[id]`
- `/api/tasks` and `/api/tasks/[id]`
- `/api/members` and `/api/members/[id]`
- `/api/clients`
- `/api/profile`
- `/api/auth/me`
- `/api/admin/users`
- `/api/admin/impersonation`

## Setup

1. Install dependencies:

```bash
npm install
```

2. Create `.env.local` and add:

```env
NEXT_PUBLIC_SUPABASE_URL=your-supabase-url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-supabase-anon-key
```

3. Apply database schema:

- Run `supabase-schema.sql` in Supabase SQL Editor
- If needed for older data, run `sql/migrate_project_statuses.sql`

4. (Optional) load sample data:

```bash
# seed sample records
sql/seed_dummy_data.sql

# remove seeded records
sql/reset_dummy_data.sql
```

5. Run locally:

```bash
npm run dev
```

6. Production check:

```bash
npm run lint
npm run build
```

## Permission model (high-level)

- `admin`: full access
- `member`: can create/update most working data
- `viewer`: read-only dashboard access

## Notes

- Project client fallback is shown as `Internal project` when no client is selected.
- Avatar fallback order is: profile avatar -> OAuth avatar -> Gravatar/Libravatar -> generated fallback.
- This repository focuses on practical CRUD and dashboard usability first, then adds UX polish.

## Current status

- Core assignment requirements are implemented and working end-to-end (auth, protected routes, project/member/task CRUD).
- Bonus features are in progress and already partially included (impersonation, richer tasks workspace, UI personalization).
- Remaining work is mostly UI polish, with mobile layout refinements as the main focus before final commit.
