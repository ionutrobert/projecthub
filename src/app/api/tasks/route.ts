import { NextRequest, NextResponse } from "next/server"
import { revalidateTag } from "next/cache"
import { z } from "zod"

import { createClient } from "@/lib/supabase/server"
import { getRoleContext } from "@/lib/server-authz"
import { logProjectActivity } from "@/lib/project-activity"

const createTaskSchema = z.object({
  project_id: z.string().uuid(),
  title: z.string().min(1).max(200),
  description: z.string().max(2000).nullable().optional(),
  status: z.enum(["todo", "in-progress", "done"]).optional(),
  priority: z.enum(["low", "medium", "high", "urgent"]).optional(),
  assignee_member_id: z.string().uuid().nullable().optional(),
  due_date: z.string().date().nullable().optional(),
})

function isMissingTasksTable(message: string) {
  return message.includes("public.tasks")
}

export async function GET(request: NextRequest) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const projectId = request.nextUrl.searchParams.get("projectId")
  const priority = request.nextUrl.searchParams.get("priority")
  const assigneeMemberId = request.nextUrl.searchParams.get("assigneeMemberId")
  const q = request.nextUrl.searchParams.get("q")
  const dueFrom = request.nextUrl.searchParams.get("dueFrom")
  const dueBefore = request.nextUrl.searchParams.get("dueBefore")
  const timeline = request.nextUrl.searchParams.get("timeline") === "1"
  const timelineBucket = request.nextUrl.searchParams.get("timelineBucket")
  const timelineOffset = Number(request.nextUrl.searchParams.get("timelineOffset") || "0")
  const timelineLimit = Number(request.nextUrl.searchParams.get("timelineLimit") || "5")

  if (timeline) {
    const now = new Date()
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    const in7 = new Date(today)
    in7.setDate(in7.getDate() + 7)
    const plus7 = `${in7.getFullYear()}-${String(in7.getMonth() + 1).padStart(2, "0")}-${String(in7.getDate()).padStart(2, "0")}`

    type QueryFilterable<T> = {
      eq: (column: string, value: string) => T
      in: (column: string, values: string[]) => T
      ilike: (column: string, pattern: string) => T
      gte: (column: string, value: string) => T
      lte: (column: string, value: string) => T
    }

    const applyFilters = <T extends QueryFilterable<T>>(query: T): T => {
      let next = query
      if (projectId) {
        const projectIds = projectId.split(",")
        next = projectIds.length === 1 ? next.eq("project_id", projectId) : next.in("project_id", projectIds)
      }
      if (priority) {
        const priorities = priority.split(",")
        next = priorities.length === 1 ? next.eq("priority", priority) : next.in("priority", priorities)
      }
      if (assigneeMemberId) {
        const assigneeMemberIds = assigneeMemberId.split(",")
        next = assigneeMemberIds.length === 1
          ? next.eq("assignee_member_id", assigneeMemberId)
          : next.in("assignee_member_id", assigneeMemberIds)
      }
      if (q) {
        next = next.ilike("title", `%${q}%`)
      }
      if (dueFrom) {
        next = next.gte("due_date", dueFrom)
      }
      if (dueBefore) {
        next = next.lte("due_date", dueBefore)
      }
      return next
    }

    const safeOffset = Number.isFinite(timelineOffset) && timelineOffset > 0 ? Math.floor(timelineOffset) : 0
    const safeLimit = Number.isFinite(timelineLimit) && timelineLimit > 0 ? Math.min(Math.floor(timelineLimit), 25) : 5

    if (timelineBucket === "later" || timelineBucket === "done") {
      const bucketQueryBase =
        timelineBucket === "later"
          ? supabase
              .from("tasks")
              .select("*")
              .neq("status", "done")
              .not("due_date", "is", null)
              .gt("due_date", plus7)
              .order("due_date", { ascending: true })
          : supabase
              .from("tasks")
              .select("*")
              .eq("status", "done")
              .order("due_date", { ascending: true })

      const bucketQuery = applyFilters(bucketQueryBase).range(safeOffset, safeOffset + safeLimit - 1)
      const { data, error } = await bucketQuery

      if (error) {
        if (isMissingTasksTable(error.message)) {
          return NextResponse.json({ bucket: timelineBucket, tasks: [], hasMore: false, offset: safeOffset, limit: safeLimit })
        }
        return NextResponse.json({ error: error.message }, { status: 500 })
      }

      const tasks = Array.isArray(data) ? data : []
      return NextResponse.json({
        bucket: timelineBucket,
        tasks,
        hasMore: tasks.length === safeLimit,
        offset: safeOffset,
        limit: safeLimit,
      })
    }

    const dueSoonQuery = applyFilters(supabase
      .from("tasks")
      .select("*")
      .neq("status", "done")
      .not("due_date", "is", null)
      .lte("due_date", plus7)
      .order("due_date", { ascending: true })
      .limit(200))

    const laterQuery = applyFilters(supabase
      .from("tasks")
      .select("*")
      .neq("status", "done")
      .not("due_date", "is", null)
      .gt("due_date", plus7)
      .order("due_date", { ascending: true })
      .limit(5))

    const doneQuery = applyFilters(supabase
      .from("tasks")
      .select("*")
      .eq("status", "done")
      .order("due_date", { ascending: true })
      .limit(5))

    const shouldFetchNoDue = !dueFrom && !dueBefore
    const noDueQuery = applyFilters(supabase
      .from("tasks")
      .select("*")
      .neq("status", "done")
      .is("due_date", null)
      .order("position", { ascending: true })
      .limit(5))

    const [dueSoonRes, laterRes, doneRes, noDueRes] = await Promise.all([
      dueSoonQuery,
      laterQuery,
      doneQuery,
      shouldFetchNoDue ? noDueQuery : Promise.resolve({ data: [], error: null }),
    ])

    const firstError = [dueSoonRes, laterRes, doneRes, noDueRes].find((res) => res.error)
    if (firstError?.error) {
      if (isMissingTasksTable(firstError.error.message)) {
        return NextResponse.json([])
      }
      return NextResponse.json({ error: firstError.error.message }, { status: 500 })
    }

    const merged = [
      ...(dueSoonRes.data || []),
      ...(laterRes.data || []),
      ...(doneRes.data || []),
      ...(noDueRes.data || []),
    ]

    const deduped = Array.from(new Map(merged.map((task) => [task.id, task])).values())
    return NextResponse.json(deduped)
  }

  let query = supabase.from("tasks").select("*").order("position", { ascending: true })
  if (projectId) {
    const projectIds = projectId.split(",")
    if (projectIds.length === 1) {
      query = query.eq("project_id", projectId)
    } else {
      query = query.in("project_id", projectIds)
    }
  }
  if (priority) {
    const priorities = priority.split(",")
    if (priorities.length === 1) {
      query = query.eq("priority", priority)
    } else {
      query = query.in("priority", priorities)
    }
  }
  if (assigneeMemberId) {
    const assigneeMemberIds = assigneeMemberId.split(",")
    if (assigneeMemberIds.length === 1) {
      query = query.eq("assignee_member_id", assigneeMemberId)
    } else {
      query = query.in("assignee_member_id", assigneeMemberIds)
    }
  }
  if (q) {
    query = query.ilike("title", `%${q}%`)
  }
  if (dueFrom) {
    query = query.gte("due_date", dueFrom)
  }
  if (dueBefore) {
    query = query.lte("due_date", dueBefore)
  }

  const { data, error } = await query
  if (error) {
    if (isMissingTasksTable(error.message)) {
      return NextResponse.json([])
    }
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(data || [])
}

export async function POST(request: NextRequest) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { effectiveRole } = await getRoleContext(supabase, user.id)
  if (!["admin", "member"].includes(effectiveRole)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const parsed = createTaskSchema.safeParse(await request.json())
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid task payload" }, { status: 400 })
  }

  const targetStatus = parsed.data.status || "todo"
  const { data: latestInLane } = await supabase
    .from("tasks")
    .select("position")
    .eq("project_id", parsed.data.project_id)
    .eq("status", targetStatus)
    .order("position", { ascending: false })
    .limit(1)

  const nextPosition = ((latestInLane && latestInLane[0]?.position) || 0) + 1

  const { data, error } = await supabase
    .from("tasks")
    .insert({
      project_id: parsed.data.project_id,
      title: parsed.data.title.trim(),
      description: parsed.data.description?.trim() || null,
      status: targetStatus,
      priority: parsed.data.priority || "medium",
      assignee_member_id: parsed.data.assignee_member_id || null,
      due_date: parsed.data.due_date || null,
      position: nextPosition,
    })
    .select("*")
    .single()

  if (error) {
    if (isMissingTasksTable(error.message)) {
      return NextResponse.json(
        { error: "Tasks table is not set up yet. Run supabase-schema.sql to enable tasks." },
        { status: 400 }
      )
    }
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  let assigneeName: string | null = null
  if (data.assignee_member_id) {
    const { data: assignee } = await supabase
      .from("members")
      .select("name,email")
      .eq("id", data.assignee_member_id)
      .single()
    assigneeName = assignee?.name || assignee?.email || null
  }

  void logProjectActivity(supabase, {
    projectId: data.project_id,
    actorUserId: user.id,
    eventType: "task_created",
    entityType: "task",
    entityId: data.id,
    message: assigneeName
      ? `Created task ${data.title} and assigned it to ${assigneeName}`
      : `Created task ${data.title}`,
    metadata: {
      task_title: data.title,
      status: data.status,
      priority: data.priority,
      assignee_member_id: data.assignee_member_id,
      assignee_name: assigneeName,
      due_date: data.due_date,
    },
  })

  revalidateTag("tasks", "max")
  revalidateTag("projects", "max")
  revalidateTag("dashboard", "max")
  revalidateTag("reports", "max")

  return NextResponse.json(data, { status: 201 })
}
