import { NextRequest, NextResponse } from "next/server"
import { revalidateTag } from "next/cache"
import { createClient } from "@/lib/supabase/server"
import { getRoleContext } from "@/lib/server-authz"
import { z } from "zod"

const projectStatusSchema = z.enum([
  "active",
  "in-progress",
  "on-hold",
  "completed",
  "closed",
])

const updateProjectSchema = z.object({
  name: z.string().trim().min(1).max(200).optional(),
  status: projectStatusSchema.optional(),
  start_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
  deadline: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
  budget: z.number().nonnegative().nullable().optional(),
  member_ids: z.array(z.string().uuid()).optional(),
  description: z.string().trim().nullable().optional(),
  client_name: z.string().trim().nullable().optional(),
  labels: z.array(z.string().trim().min(1)).nullable().optional(),
  color: z.string().trim().nullable().optional(),
  icon: z.string().trim().nullable().optional(),
})

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { data: project, error } = await supabase
    .from("projects")
    .select(`
      *,
      project_members (
        members (
          id,
          user_id,
          name,
          email,
          role
        )
      )
    `)
    .eq("id", id)
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 404 })
  }

  return NextResponse.json(project)
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createClient()
  
  const { data: { user } } = await supabase.auth.getUser()
  
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { effectiveRole } = await getRoleContext(supabase, user.id)

  if (!["admin", "member"].includes(effectiveRole)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const parsed = updateProjectSchema.safeParse(await request.json())
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid project payload" }, { status: 400 })
  }

  const payload = parsed.data

  const { data: project, error } = await supabase
    .from("projects")
    .update({
      ...(payload.name !== undefined ? { name: payload.name } : {}),
      ...(payload.status !== undefined ? { status: payload.status } : {}),
      ...(payload.start_date !== undefined ? { start_date: payload.start_date || null } : {}),
      ...(payload.deadline !== undefined ? { deadline: payload.deadline || null } : {}),
      ...(payload.budget !== undefined ? { budget: payload.budget } : {}),
      ...(payload.description !== undefined ? { description: payload.description || null } : {}),
      ...(payload.client_name !== undefined ? { client_name: payload.client_name || null } : {}),
      ...(payload.labels !== undefined
        ? { labels: payload.labels && payload.labels.length > 0 ? payload.labels : null }
        : {}),
      ...(payload.color !== undefined ? { color: payload.color || null } : {}),
      ...(payload.icon !== undefined ? { icon: payload.icon || null } : {}),
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // Replace project_members if provided
  if (Array.isArray(payload.member_ids)) {
    // Remove existing
    const { error: delError } = await supabase
      .from("project_members")
      .delete()
      .eq("project_id", id)
    if (delError) {
      return NextResponse.json({ error: delError.message }, { status: 500 })
    }
    // Insert new
    if (payload.member_ids.length > 0) {
      const rows = payload.member_ids.map((mid) => ({ project_id: id, member_id: mid }))
      const { error: insError } = await supabase.from("project_members").insert(rows)
      if (insError) {
        return NextResponse.json({ error: insError.message }, { status: 500 })
      }
    }
  }

  revalidateTag("projects", "max")
  revalidateTag("dashboard", "max")
  revalidateTag("reports", "max")
  revalidateTag("team", "max")

  return NextResponse.json(project)
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createClient()
  
  const { data: { user } } = await supabase.auth.getUser()
  
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { effectiveRole } = await getRoleContext(supabase, user.id)

  if (effectiveRole !== "admin") {
    return NextResponse.json({ error: "Forbidden - Admin only" }, { status: 403 })
  }

  const { error } = await supabase
    .from("projects")
    .delete()
    .eq("id", id)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  revalidateTag("projects", "max")
  revalidateTag("dashboard", "max")
  revalidateTag("reports", "max")
  revalidateTag("team", "max")

  return NextResponse.json({ success: true })
}
