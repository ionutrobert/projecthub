import { NextRequest, NextResponse } from "next/server"
import { revalidateTag } from "next/cache"
import { createClient } from "@/lib/supabase/server"
import { getRoleContext } from "@/lib/server-authz"
import { logProjectActivity } from "@/lib/project-activity"
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
           role,
           profiles:profiles!members_user_id_fkey(role, avatar_url, full_name)
         )
       )
     `)
     .eq("id", id)
     .single()

   if (error) {
     return NextResponse.json({ error: error.message }, { status: 404 })
   }

   // Normalize member names to use full_name from profile if available
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

   if (project?.project_members) {
     project.project_members = (project.project_members as ProjectMember[]).map((pm) => {
       const member = pm.members;
       if (!member) return pm;

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

  const { data: previousProject } = await supabase
    .from("projects")
    .select("id,name,status,start_date,deadline,budget,client_name,description,labels")
    .eq("id", id)
    .single()

  if (!previousProject) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 })
  }

  const hadMemberUpdate = Array.isArray(payload.member_ids)
  const { data: previousMemberRows } = hadMemberUpdate
    ? await supabase
        .from("project_members")
        .select("member_id")
        .eq("project_id", id)
    : { data: [] as Array<{ member_id: string }> }

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

  const metadataChanges: Record<string, unknown> = {}
  if (payload.status !== undefined && payload.status !== previousProject.status) {
    metadataChanges.status = {
      from: previousProject.status,
      to: payload.status,
    }
  }
  if (payload.start_date !== undefined && payload.start_date !== previousProject.start_date) {
    metadataChanges.start_date = {
      from: previousProject.start_date,
      to: payload.start_date,
    }
  }
  if (payload.deadline !== undefined && payload.deadline !== previousProject.deadline) {
    metadataChanges.deadline = {
      from: previousProject.deadline,
      to: payload.deadline,
    }
  }
  if (payload.name !== undefined && payload.name !== previousProject.name) {
    metadataChanges.name = {
      from: previousProject.name,
      to: payload.name,
    }
  }
  if (payload.client_name !== undefined && payload.client_name !== previousProject.client_name) {
    metadataChanges.client_name = {
      from: previousProject.client_name,
      to: payload.client_name,
    }
  }

  if (Object.keys(metadataChanges).length > 0) {
    void logProjectActivity(supabase, {
      projectId: id,
      actorUserId: user.id,
      eventType: "project_updated",
      entityType: "project",
      entityId: id,
      message: `Updated project ${project.name}`,
      metadata: metadataChanges,
    })
  }

  if (hadMemberUpdate) {
    const previousMemberIds = new Set((previousMemberRows || []).map((row) => row.member_id))
    const nextMemberIds = new Set(payload.member_ids || [])

    const addedMemberIds = [...nextMemberIds].filter((memberId) => !previousMemberIds.has(memberId))
    const removedMemberIds = [...previousMemberIds].filter((memberId) => !nextMemberIds.has(memberId))
    const changedMemberIds = [...new Set([...addedMemberIds, ...removedMemberIds])]

    if (changedMemberIds.length > 0) {
      const { data: memberRows } = await supabase
        .from("members")
        .select("id,name,email")
        .in("id", changedMemberIds)
      const memberById = new Map((memberRows || []).map((member) => [member.id, member]))

      for (const memberId of addedMemberIds) {
        const member = memberById.get(memberId)
        void logProjectActivity(supabase, {
          projectId: id,
          actorUserId: user.id,
          eventType: "member_added",
          entityType: "member",
          entityId: memberId,
          message: `Added ${member?.name || member?.email || "member"} to project`,
          metadata: {
            member_id: memberId,
            member_name: member?.name || null,
            member_email: member?.email || null,
          },
        })
      }

      for (const memberId of removedMemberIds) {
        const member = memberById.get(memberId)
        void logProjectActivity(supabase, {
          projectId: id,
          actorUserId: user.id,
          eventType: "member_removed",
          entityType: "member",
          entityId: memberId,
          message: `Removed ${member?.name || member?.email || "member"} from project`,
          metadata: {
            member_id: memberId,
            member_name: member?.name || null,
            member_email: member?.email || null,
          },
        })
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
