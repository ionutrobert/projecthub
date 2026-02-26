import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { z } from "zod"
import { getRoleContext } from "@/lib/server-authz"

const createMemberSchema = z.object({
  name: z.string().min(1).max(120),
  email: z.string().email().max(200).nullable().optional(),
  role: z.string().min(1).max(80).nullable().optional(),
})

export async function GET() {
  const supabase = await createClient()
  
  const { data: { user } } = await supabase.auth.getUser()
  
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, email, full_name, role")
    .eq("id", user.id)
    .single()

  if (profile) {
    const { data: selfMember } = await supabase
      .from("members")
      .select("id")
      .eq("user_id", user.id)
      .maybeSingle()

    if (!selfMember) {
      const profileEmail = (profile.email || user.email || "").trim().toLowerCase()

      if (profileEmail) {
        const { data: existingByEmail } = await supabase
          .from("members")
          .select("id")
          .ilike("email", profileEmail)
          .maybeSingle()

        if (existingByEmail?.id) {
          await supabase
            .from("members")
            .update({ user_id: user.id })
            .eq("id", existingByEmail.id)
        } else {
          await supabase.from("members").insert({
            user_id: user.id,
            name: profile.full_name?.trim() || profile.email?.split("@")[0] || "Me",
            email: profile.email || user.email || null,
            role: profile.role || "member",
          })
        }
      } else {
        await supabase.from("members").insert({
          user_id: user.id,
          name: profile.full_name?.trim() || profile.email?.split("@")[0] || "Me",
          email: profile.email || user.email || null,
          role: profile.role || "member",
        })
      }
    }
  }

  const { data: members, error } = await supabase
    .from("members")
    .select("id, name, email, role, user_id, profiles:profiles!members_user_id_fkey(avatar_url)")
    .order("name")

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const normalizedMembers = (members || []).map((member) => ({
    id: member.id,
    name: member.name,
    email: member.email,
    role: member.role,
    user_id: member.user_id,
    avatar_url:
      Array.isArray(member.profiles) && member.profiles.length > 0
        ? member.profiles[0]?.avatar_url || null
        : (member.profiles as { avatar_url?: string | null } | null)?.avatar_url || null,
  }))

  const uniqueMembers = normalizedMembers.filter((member, index, all) => {
    const key = (member.email || member.name).trim().toLowerCase()
    return all.findIndex((candidate) => {
      const candidateKey = (candidate.email || candidate.name).trim().toLowerCase()
      return candidateKey === key
    }) === index
  })

  return NextResponse.json(uniqueMembers)
}

export async function POST(request: Request) {
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

  const body = await request.json()
  const parsed = createMemberSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid member payload" }, { status: 400 })
  }

  const { data, error } = await supabase
    .from("members")
    .insert({
      name: parsed.data.name.trim(),
      email: parsed.data.email?.trim() || null,
      role: parsed.data.role?.trim() || "developer",
    })
    .select("*")
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(data, { status: 201 })
}
