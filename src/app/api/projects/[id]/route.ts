import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { getRoleContext } from "@/lib/server-authz"

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

  const body = await request.json()
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
  } = body

  const { data: project, error } = await supabase
    .from("projects")
    .update({
      name,
      status,
      start_date: start_date || null,
      deadline,
      budget,
      description,
      client_name: client_name || null,
      labels: Array.isArray(labels) && labels.length > 0 ? labels : null,
      color,
      icon,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // Replace project_members if provided
  if (Array.isArray(member_ids)) {
    // Remove existing
    const { error: delError } = await supabase
      .from("project_members")
      .delete()
      .eq("project_id", id)
    if (delError) {
      return NextResponse.json({ error: delError.message }, { status: 500 })
    }
    // Insert new
    if (member_ids.length > 0) {
      const rows = member_ids.map((mid: string) => ({ project_id: id, member_id: mid }))
      const { error: insError } = await supabase.from("project_members").insert(rows)
      if (insError) {
        return NextResponse.json({ error: insError.message }, { status: 500 })
      }
    }
  }

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

  return NextResponse.json({ success: true })
}
