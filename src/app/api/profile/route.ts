import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"

import { createClient } from "@/lib/supabase/server"
import { getRoleContext, getEffectiveProfileId } from "@/lib/server-authz"
import { revalidateTag } from "next/cache"

const updateProfileSchema = z.object({
  full_name: z.string().max(120).nullable(),
  avatar_url: z.union([z.string().url().max(500), z.literal("initials")]).nullable(),
})

export async function PUT(request: NextRequest) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const body = await request.json()
  const parsed = updateProfileSchema.safeParse(body)

  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid profile payload" }, { status: 400 })
  }

  const roleContext = await getRoleContext(supabase, user.id)

  if (roleContext.actualRole === "admin" && roleContext.impersonation?.memberId) {
    const { data: member } = await supabase
      .from("members")
      .select("id, user_id")
      .eq("id", roleContext.impersonation.memberId)
      .maybeSingle()

    if (member && !member.user_id) {
      const memberPatch: Record<string, string | null> = {}
      if (parsed.data.full_name !== undefined) {
        memberPatch.name = parsed.data.full_name || ""
      }

      if (Object.keys(memberPatch).length > 0) {
        const { error: memberError } = await supabase
          .from("members")
          .update(memberPatch)
          .eq("id", member.id)

        if (memberError) {
          return NextResponse.json({ error: memberError.message }, { status: 500 })
        }
      }

      return NextResponse.json({
        success: true,
        warning: "Impersonated member has no linked login profile; only member name was updated.",
      })
    }
  }

  const targetProfileId = await getEffectiveProfileId(supabase, user.id)

  const updatePayload = {
    ...parsed.data,
    updated_at: new Date().toISOString(),
  }

  const { data, error } = await supabase
    .from("profiles")
    .update(updatePayload)
    .eq("id", targetProfileId)
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  if (!data) {
    return NextResponse.json({ error: "Profile not found" }, { status: 404 })
  }

  // Invalidate caches to reflect changes across app
  revalidateTag("dashboard", "max")
  revalidateTag("team", "max")

  return NextResponse.json({ success: true })
}
