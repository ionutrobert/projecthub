import { NextRequest, NextResponse } from "next/server"
import { revalidateTag } from "next/cache"
import { z } from "zod"

import { createClient } from "@/lib/supabase/server"
import { getRoleContext } from "@/lib/server-authz"
import { logProjectActivity } from "@/lib/project-activity"

const updateTaskSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  description: z.string().max(2000).nullable().optional(),
  status: z.enum(["todo", "in-progress", "done"]).optional(),
  priority: z.enum(["low", "medium", "high", "urgent"]).optional(),
  assignee_member_id: z.string().uuid().nullable().optional(),
  due_date: z.string().date().nullable().optional(),
  position: z.number().int().min(0).optional(),
})

function isMissingTasksTable(message: string) {
  return message.includes("public.tasks")
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
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

  const parsed = updateTaskSchema.safeParse(await request.json())
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid task payload" }, { status: 400 })
  }

  const { data: previousTask } = await supabase
    .from("tasks")
    .select("id,project_id,title,status,assignee_member_id")
    .eq("id", id)
    .single()

  if (!previousTask) {
    return NextResponse.json({ error: "Task not found" }, { status: 404 })
  }

  const { data, error } = await supabase
    .from("tasks")
    .update({
      ...parsed.data,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
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

  if (parsed.data.status !== undefined && parsed.data.status !== previousTask.status) {
    void logProjectActivity(supabase, {
      projectId: data.project_id,
      actorUserId: user.id,
      eventType: "task_status_changed",
      entityType: "task",
      entityId: data.id,
      message: `${data.title} moved from ${previousTask.status} to ${data.status}`,
      metadata: {
        task_title: data.title,
        from_status: previousTask.status,
        to_status: data.status,
      },
    })
  }

  if (parsed.data.assignee_member_id !== undefined && parsed.data.assignee_member_id !== previousTask.assignee_member_id) {
    const memberIds = [previousTask.assignee_member_id, data.assignee_member_id].filter(
      (value): value is string => Boolean(value)
    )

    const { data: assignees } = memberIds.length
      ? await supabase
          .from("members")
          .select("id,name,email")
          .in("id", memberIds)
      : { data: [] as Array<{ id: string; name: string | null; email: string | null }> }

    const assigneeById = new Map((assignees || []).map((member) => [member.id, member]))
    const fromAssignee = previousTask.assignee_member_id
      ? assigneeById.get(previousTask.assignee_member_id)
      : null
    const toAssignee = data.assignee_member_id ? assigneeById.get(data.assignee_member_id) : null

    const fromLabel = fromAssignee?.name || fromAssignee?.email || "Unassigned"
    const toLabel = toAssignee?.name || toAssignee?.email || "Unassigned"

    void logProjectActivity(supabase, {
      projectId: data.project_id,
      actorUserId: user.id,
      eventType: "task_assignee_changed",
      entityType: "task",
      entityId: data.id,
      message: `${data.title} assignee changed from ${fromLabel} to ${toLabel}`,
      metadata: {
        task_title: data.title,
        from_assignee_member_id: previousTask.assignee_member_id,
        to_assignee_member_id: data.assignee_member_id,
        from_assignee_label: fromLabel,
        to_assignee_label: toLabel,
      },
    })
  }

  revalidateTag("tasks", "max")
  revalidateTag("projects", "max")
  revalidateTag("dashboard", "max")
  revalidateTag("reports", "max")

  return NextResponse.json(data)
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
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

  const { data: previousTask } = await supabase
    .from("tasks")
    .select("id,project_id,title,status,assignee_member_id")
    .eq("id", id)
    .single()

  if (!previousTask) {
    return NextResponse.json({ error: "Task not found" }, { status: 404 })
  }

  const { error } = await supabase.from("tasks").delete().eq("id", id)
  if (error) {
    if (isMissingTasksTable(error.message)) {
      return NextResponse.json(
        { error: "Tasks table is not set up yet. Run supabase-schema.sql to enable tasks." },
        { status: 400 }
      )
    }
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  void logProjectActivity(supabase, {
    projectId: previousTask.project_id,
    actorUserId: user.id,
    eventType: "task_deleted",
    entityType: "task",
    entityId: previousTask.id,
    message: `Deleted task ${previousTask.title}`,
    metadata: {
      task_title: previousTask.title,
      status: previousTask.status,
      assignee_member_id: previousTask.assignee_member_id,
    },
  })

  revalidateTag("tasks", "max")
  revalidateTag("projects", "max")
  revalidateTag("dashboard", "max")
  revalidateTag("reports", "max")

  return NextResponse.json({ success: true })
}
