import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"

import { createClient } from "@/lib/supabase/server"
import { getRoleContext } from "@/lib/server-authz"

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

  return NextResponse.json(data, { status: 201 })
}
