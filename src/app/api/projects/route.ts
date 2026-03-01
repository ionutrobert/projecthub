import { NextRequest, NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { z } from "zod";
import { getRoleContext } from "@/lib/server-authz";
import { logProjectActivity } from "@/lib/project-activity";

const projectStatusSchema = z.enum([
  "active",
  "in-progress",
  "on-hold",
  "completed",
  "closed",
]);

const createProjectSchema = z.object({
  name: z.string().trim().min(1, "Project name is required"),
  status: projectStatusSchema,
  start_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
  deadline: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
  budget: z.number().nonnegative().nullable().optional(),
  member_ids: z.array(z.string().uuid()).optional().default([]),
  description: z.string().trim().nullable().optional(),
  client_name: z.string().trim().nullable().optional(),
  labels: z.array(z.string().trim().min(1)).optional().default([]),
  color: z.string().trim().nullable().optional(),
  icon: z.string().trim().nullable().optional(),
});

function isMissingProjectMembersTable(message: string) {
  return message.includes("public.project_members");
}

function isMissingTasksTable(message: string) {
  return message.includes("public.tasks");
}

export async function GET(request: NextRequest) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const statusParam = searchParams.get("status"); // comma-separated allowed
  const q = searchParams.get("q") || searchParams.get("search") || undefined;
  const membersParam = searchParams.get("members"); // comma-separated member IDs
  const dateFrom = searchParams.get("dateFrom");
  const dateTo = searchParams.get("dateTo");
  const deadlineFrom = searchParams.get("deadlineFrom");
  const deadlineTo = searchParams.get("deadlineTo");
  const budgetMin = searchParams.get("budgetMin");
  const budgetMax = searchParams.get("budgetMax");
  const sort = (searchParams.get("sort") || "created_at_desc") as
    | "name_asc"
    | "created_at_desc";
  const page = parseInt(searchParams.get("page") || "1", 10);
  const pageSize = parseInt(searchParams.get("pageSize") || "20", 10);
  const offset = Math.max(0, (page - 1) * pageSize);

   let query = supabase.from("projects").select(
     `
       *,
       project_members (
         members (
           id,
           user_id,
           name,
           email,
           role,
           profiles:profiles!members_user_id_fkey(role, avatar_url, full_name)
         )
       )
       `,
     { count: "exact" },
   );

  // Filter by status (single or multiple)
  if (statusParam && statusParam !== "all") {
    const statuses = statusParam.split(",").filter(Boolean);
    if (statuses.length === 1) {
      query = query.eq("status", statuses[0]);
    } else if (statuses.length > 1) {
      query = query.in("status", statuses);
    }
  }

  // Filter by member IDs (many-to-many via project_members)
  if (membersParam) {
    const memberIds = membersParam.split(",").filter(Boolean);
    if (memberIds.length > 0) {
      const { data: pm, error: pmError } = await supabase
        .from("project_members")
        .select("project_id")
        .in("member_id", memberIds);
      if (pmError) {
        if (isMissingProjectMembersTable(pmError.message)) {
          return NextResponse.json([]);
        }
        return NextResponse.json({ error: pmError.message }, { status: 500 });
      }
      const projectIds = Array.from(
        new Set((pm || []).map((r) => r.project_id)),
      );
      if (projectIds.length === 0) {
        return NextResponse.json([]);
      }
      query = query.in("id", projectIds);
    }
  }

  // Text search across name + description
  if (q) {
    query = query.or(`name.ilike.%${q}%,description.ilike.%${q}%`);
  }

  // Created_at date range
  if (dateFrom) query = query.gte("created_at", dateFrom);
  if (dateTo) query = query.lte("created_at", dateTo);

  // Deadline date range
  if (deadlineFrom) query = query.gte("deadline", deadlineFrom);
  if (deadlineTo) query = query.lte("deadline", deadlineTo);

  // Budget range
  if (budgetMin) query = query.gte("budget", Number(budgetMin));
  if (budgetMax) query = query.lte("budget", Number(budgetMax));

  // Sorting
  if (sort === "name_asc") {
    query = query.order("name", { ascending: true });
  } else {
    query = query.order("created_at", { ascending: false });
  }

  // Pagination
  query = query.range(offset, offset + pageSize - 1);

  let { data: projects, error } = await query;

  // Fallback: if nested relation query fails, return basic projects list
  // so dashboard/project lists keep working while relation issues are resolved.
  if (error) {
    const fallback = await supabase
      .from("projects")
      .select("*")
      .order("created_at", { ascending: false })
      .range(offset, offset + pageSize - 1);

    if (fallback.error) {
      return NextResponse.json({ error: fallback.error.message }, { status: 500 });
    }

    projects = fallback.data;
    error = null;
  }

   interface MemberWithProfile {
     id: string;
     user_id?: string | null;
     name: string;
     email?: string | null;
     role?: string | null;
     profiles?: Array<{ full_name?: string }> | { full_name?: string } | null;
   }

   interface ProjectMember {
     members?: MemberWithProfile | null;
   }

   const projectList = (projects || []).map((project) => {
     const projectMembers = project.project_members as ProjectMember[] | undefined;
     if (!projectMembers) return project;

     const normalizedMembers = projectMembers.map((pm) => {
       const member = pm.members;
       if (!member) return pm;

       // member.profiles can be array (one-to-many) or object (one-to-one)
       const profileRecord = Array.isArray(member.profiles)
         ? member.profiles[0]
         : (member.profiles as { full_name?: string } | null);

       const displayName = profileRecord?.full_name || member.name;

       return {
         ...pm,
         members: {
           ...member,
           name: displayName,
         },
       };
     });

     return {
       ...project,
       project_members: normalizedMembers,
     };
   });

   if (projectList.length === 0) {
     return NextResponse.json(projectList);
   }

  const projectIds = projectList.map((project) => project.id);
  const { data: taskRows, error: taskError } = await supabase
    .from("tasks")
    .select("project_id")
    .in("project_id", projectIds);

  if (taskError && !isMissingTasksTable(taskError.message)) {
    return NextResponse.json({ error: taskError.message }, { status: 500 });
  }

  const taskCountByProject = new Map<string, number>();
  for (const row of taskRows || []) {
    const current = taskCountByProject.get(row.project_id) || 0;
    taskCountByProject.set(row.project_id, current + 1);
  }

  const projectsWithCounts = projectList.map((project) => ({
    ...project,
    task_count: taskCountByProject.get(project.id) || 0,
  }));

  return NextResponse.json(projectsWithCounts);
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const parseResult = createProjectSchema.safeParse(await request.json());
  if (!parseResult.success) {
    return NextResponse.json(
      { error: parseResult.error.issues[0]?.message || "Invalid request body" },
      { status: 400 },
    );
  }

  const {
    name,
    status,
    start_date,
    deadline,
    budget,
    member_ids,
    description,
    client_name,
    labels,
    color,
    icon,
  } = parseResult.data;

  const { effectiveRole } = await getRoleContext(supabase, user.id);

  if (!["admin", "member"].includes(effectiveRole)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

   const { data: project, error } = await supabase
     .from("projects")
     .insert({
       name,
       status,
       start_date: start_date || null,
       deadline: deadline || null,
       budget: budget ?? null,
       description,
       client_name: client_name || null,
       labels: labels,
       color,
       icon,
       created_by: user.id,
     })
     .select()
     .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Insert project_members if provided
  if (Array.isArray(member_ids) && member_ids.length > 0) {
    const rows = member_ids.map((mid: string) => ({
      project_id: project.id,
      member_id: mid,
    }));
    const { error: insError } = await supabase
      .from("project_members")
      .insert(rows);
    if (insError) {
      if (isMissingProjectMembersTable(insError.message)) {
        return NextResponse.json(
          { ...project, warning: "project_members table missing; assignments skipped" },
          { status: 201 },
        );
      }
      return NextResponse.json({ error: insError.message }, { status: 500 });
    }
  }

  void logProjectActivity(supabase, {
    projectId: project.id,
    actorUserId: user.id,
    eventType: "project_created",
    entityType: "project",
    entityId: project.id,
    message: `Created project ${project.name}`,
    metadata: {
      status: project.status,
      start_date: project.start_date,
      deadline: project.deadline,
    },
  })

  if (Array.isArray(member_ids) && member_ids.length > 0) {
    const { data: selectedMembers } = await supabase
      .from("members")
      .select("id,name,email")
      .in("id", member_ids)

    for (const member of selectedMembers || []) {
      void logProjectActivity(supabase, {
        projectId: project.id,
        actorUserId: user.id,
        eventType: "member_added",
        entityType: "member",
        entityId: member.id,
        message: `Added ${member.name || member.email || "member"} to project`,
        metadata: {
          member_id: member.id,
          member_name: member.name,
          member_email: member.email,
        },
      })
    }
  }

  revalidateTag("projects", "max");
  revalidateTag("dashboard", "max");
  revalidateTag("reports", "max");
  revalidateTag("team", "max");

  return NextResponse.json(project, { status: 201 });
}
