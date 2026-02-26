import { NextResponse } from "next/server"

import { createClient } from "@/lib/supabase/server"
import { getRoleContext } from "@/lib/server-authz"

const noStoreHeaders = {
  "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
  Pragma: "no-cache",
  Expires: "0",
}

export async function GET() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ user: null, profile: null }, { status: 200, headers: noStoreHeaders })
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single()

  const roleContext = await getRoleContext(supabase, user.id)
  let shapedProfile = profile
    ? {
        ...profile,
        actual_role: roleContext.actualRole,
        role: roleContext.effectiveRole,
      }
    : null

  if (roleContext.actualRole === "admin" && roleContext.impersonation?.memberId) {
    const { data: member } = await supabase
      .from("members")
      .select("id, user_id, name, email, role")
      .eq("id", roleContext.impersonation.memberId)
      .maybeSingle()

    if (member) {
      let targetProfile: Record<string, unknown> | null = null

      if (member.user_id) {
        const { data } = await supabase
          .from("profiles")
          .select("*")
          .eq("id", member.user_id)
          .maybeSingle()
        targetProfile = (data as Record<string, unknown> | null) ?? null
      }

      shapedProfile = {
        ...(targetProfile || {}),
        id: member.user_id || null,
        email: member.email || (targetProfile?.email as string | null) || null,
        full_name: member.name || (targetProfile?.full_name as string | null) || null,
        role: roleContext.effectiveRole,
        actual_role: roleContext.actualRole,
        avatar_url: (targetProfile?.avatar_url as string | null) || null,
      }
    }
  }

  return NextResponse.json(
    { user, profile: shapedProfile, impersonation: roleContext.impersonation },
    { status: 200, headers: noStoreHeaders }
  )
}
