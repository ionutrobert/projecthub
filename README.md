# ProjectHub

A simple dashboard for tracking projects - built for a CPA firm that needed something clean and functional.

## What it does

- List, filter, and search through projects
- Add and edit project details (status, deadline, budget, assigned team member)
- Track active vs completed work
- Dark mode (because we all prefer it)

## The Stack

- Next.js 16 + React 19
- Tailwind CSS
- Supabase (PostgreSQL + Auth)
- TypeScript

## Where it's at

Right now you can:
- Sign in and see the dashboard
- Browse projects with filtering by status
- Search projects by name
- Create / edit / delete projects
- Toggle between light and dark themes

Still on the radar:
- Reports page is there but basic
- Team page needs work
- Could use some tests

## Getting Started

1. Copy `.env.example` to `.env.local` and add your Supabase credentials
2. Run the schema in Supabase (see `supabase-schema.sql`)
3. Start the dev server:

```bash
npm run dev
```

Visit http://localhost:3000 to see it in action.

## Deployment

Deploy to Vercel - works out of the box with Next.js. Just add your environment variables in the Vercel dashboard.

---

Built for a Mini-SaaS assessment. Keep it simple, make it work.
