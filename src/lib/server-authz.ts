import { cookies } from "next/headers"

import { createClient } from "@/lib/supabase/server"

export type EffectiveRole = "admin" | "member" | "viewer"

export function normalizeEffectiveRole(role: string | null | undefined): EffectiveRole {
  if (role === "admin") return "admin"
  if (role === "member") return "member"
  return "viewer"
}

export async function getRoleContext(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string
) {
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", userId)
    .single()

  const actualRoleRaw = (profile?.role as string | null | undefined) || null
  const actualRole = normalizeEffectiveRole(actualRoleRaw)

  if (actualRole !== "admin") {
    return {
      actualRole,
      effectiveRole: actualRole,
      impersonation: null as { role: EffectiveRole; memberName: string | null; memberId: string | null } | null,
    }
  }

  const cookieStore = await cookies()
  const impersonatedRoleRaw = cookieStore.get("projecthub_impersonate_role")?.value || null
  const impersonatedMemberName = cookieStore.get("projecthub_impersonate_member_name")?.value || null
  const impersonatedMemberId = cookieStore.get("projecthub_impersonate_member_id")?.value || null

  if (!impersonatedRoleRaw) {
    return {
      actualRole,
      effectiveRole: actualRole,
      impersonation: null,
    }
  }

  const impersonatedRole = normalizeEffectiveRole(impersonatedRoleRaw)

  return {
    actualRole,
    effectiveRole: impersonatedRole,
    impersonation: {
      role: impersonatedRole,
      memberName: impersonatedMemberName,
      memberId: impersonatedMemberId,
    },
  }
}

export async function getEffectiveProfileId(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string
) {
  const roleContext = await getRoleContext(supabase, userId)

  if (roleContext.actualRole !== "admin" || !roleContext.impersonation?.memberId) {
    return userId
  }

  const { data: member } = await supabase
    .from("members")
    .select("user_id")
    .eq("id", roleContext.impersonation.memberId)
    .maybeSingle()

  return member?.user_id || userId
}
