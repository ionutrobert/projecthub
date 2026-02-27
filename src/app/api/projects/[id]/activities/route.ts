import { NextRequest, NextResponse } from "next/server"

import { createClient } from "@/lib/supabase/server"
import {
  isProjectActivitiesUnavailableError,
  listProjectActivities,
} from "@/lib/project-activity"

type ActivityTone = "neutral" | "success" | "warn"

type ActivityResponseItem = {
  id: string
  timestamp: string
  title: string
  detail: string
  tone: ActivityTone
}

type TaskRow = {
  id: string
  title: string
  status: "todo" | "in-progress" | "done"
  due_date: string | null
  assignee_member_id: string | null
  created_at: string | null
  updated_at: string | null
}

type MemberRow = {
  id: string | null
  name: string | null
  email: string | null
}

function formatStatusLabel(status: string) {
  if (status === "in-progress") return "In Progress"
  if (status === "todo") return "To Do"
  if (status === "done") return "Done"
  return status
}

function isValidDate(value: string | null | undefined) {
  if (!value) return false
  const parsed = new Date(value)
  return !Number.isNaN(parsed.getTime())
}

function eventToTone(eventType: string): ActivityTone {
  if (eventType === "task_created" || eventType === "project_created" || eventType === "member_added") {
    return "success"
  }

  if (eventType === "task_status_changed") {
    return "warn"
  }

  return "neutral"
}

function eventToTitle(eventType: string) {
  switch (eventType) {
    case "project_created":
      return "Project created"
    case "project_updated":
      return "Project updated"
    case "member_added":
      return "Member added"
    case "member_removed":
      return "Member removed"
    case "task_created":
      return "Task created"
    case "task_deleted":
      return "Task deleted"
    case "task_status_changed":
      return "Task status updated"
    case "task_assignee_changed":
      return "Task assignee updated"
    default:
      return "Activity"
  }
}

function toDerivedActivityItems(input: {
  projectId: string
  projectName: string
  projectCreatedAt: string | null
  assignedMembers: MemberRow[]
  tasks: TaskRow[]
}): ActivityResponseItem[] {
  const items: ActivityResponseItem[] = []

  if (isValidDate(input.projectCreatedAt)) {
    items.push({
      id: `project-created-${input.projectId}`,
      timestamp: input.projectCreatedAt as string,
      title: "Project created",
      detail: `${input.projectName} was created`,
      tone: "neutral",
    })
  }

  for (const member of input.assignedMembers) {
    const label = member.name || member.email || "Member"
    items.push({
      id: `member-current-${member.id || member.email || label}`,
      timestamp: input.projectCreatedAt || new Date().toISOString(),
      title: "Member assigned",
      detail: `${label} is currently assigned`,
      tone: "neutral",
    })
  }

  for (const task of input.tasks) {
    const createdAt = isValidDate(task.created_at) ? (task.created_at as string) : new Date().toISOString()
    items.push({
      id: `task-created-${task.id}`,
      timestamp: createdAt,
      title: "Task created",
      detail: `${task.title} was added to this project`,
      tone: "neutral",
    })

    if (task.status === "done" || task.status === "in-progress") {
      const changedAt = isValidDate(task.updated_at) ? (task.updated_at as string) : createdAt
      items.push({
        id: `task-status-${task.id}`,
        timestamp: changedAt,
        title: "Task status updated",
        detail: `${task.title} is currently ${formatStatusLabel(task.status)}`,
        tone: task.status === "done" ? "success" : "warn",
      })
    }
  }

  return items.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
}

export async function GET(
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

  const searchParams = request.nextUrl.searchParams
  const offset = Number(searchParams.get("offset") || "0")
  const limit = Number(searchParams.get("limit") || "20")

  const activityResult = await listProjectActivities(supabase, id, {
    offset,
    limit,
    statusNoiseWindowMinutes: 10,
  })

  if (activityResult.error && !isProjectActivitiesUnavailableError(activityResult.error)) {
    return NextResponse.json({ error: activityResult.error }, { status: 500 })
  }

  if (activityResult.data) {
    const payload = activityResult.data.map<ActivityResponseItem>((row) => ({
      id: row.id,
      timestamp: row.created_at,
      title: eventToTitle(row.event_type),
      detail: row.message,
      tone: eventToTone(row.event_type),
    }))

    return NextResponse.json({
      activities: payload,
      hasMore: Boolean(activityResult.hasMore),
      source: "project_activities",
    })
  }

  const { data: project, error: projectError } = await supabase
    .from("projects")
    .select("id,name,created_at")
    .eq("id", id)
    .single()

  if (projectError || !project) {
    return NextResponse.json({ error: projectError?.message || "Project not found" }, { status: 404 })
  }

  const [{ data: projectMemberRows }, { data: memberRows }, { data: taskRows }] = await Promise.all([
    supabase
      .from("project_members")
      .select("member_id")
      .eq("project_id", id),
    supabase
      .from("members")
      .select("id,name,email"),
    supabase
      .from("tasks")
      .select("id,title,status,due_date,assignee_member_id,created_at,updated_at")
      .eq("project_id", id),
  ])

  const memberById = new Map<string, MemberRow>()
  for (const member of memberRows || []) {
    memberById.set(member.id, member)
  }

  const assignedMembers: MemberRow[] = []
  for (const row of projectMemberRows || []) {
    const member = memberById.get(row.member_id)
    if (member) assignedMembers.push(member)
  }

  const derived = toDerivedActivityItems({
    projectId: id,
    projectName: project.name,
    projectCreatedAt: project.created_at,
    assignedMembers,
    tasks: (taskRows || []) as TaskRow[],
  })

  const safeOffset = Number.isFinite(offset) && offset > 0 ? Math.floor(offset) : 0
  const safeLimit = Number.isFinite(limit) && limit > 0 ? Math.min(Math.floor(limit), 100) : 20
  const paged = derived.slice(safeOffset, safeOffset + safeLimit)

  return NextResponse.json({
    activities: paged,
    hasMore: derived.length > safeOffset + safeLimit,
    source: "derived",
  })
}
