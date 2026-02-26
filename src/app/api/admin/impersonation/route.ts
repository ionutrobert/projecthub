import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"

import { createClient } from "@/lib/supabase/server"
import { normalizeEffectiveRole } from "@/lib/server-authz"

const payloadSchema = z.object({
  role: z.string().nullable().optional(),
  memberName: z.string().max(120).nullable().optional(),
  memberId: z.string().max(80).nullable().optional(),
})

const cookieConfig = {
  httpOnly: true,
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
  path: "/",
  maxAge: 60 * 60 * 8,
}

async function requireAdmin() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) }
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single()

  if (normalizeEffectiveRole(profile?.role) !== "admin") {
    return { error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) }
  }

  return { user }
}

export async function POST(request: NextRequest) {
  const auth = await requireAdmin()
  if ("error" in auth) return auth.error

  const body = await request.json().catch(() => null)
  const parsed = payloadSchema.safeParse(body)

  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid impersonation payload" }, { status: 400 })
  }

  const rawRole = parsed.data.role?.trim() || null
  const response = NextResponse.json({ success: true })

  if (!rawRole) {
    response.cookies.delete("projecthub_impersonate_role")
    response.cookies.delete("projecthub_impersonate_member_name")
    response.cookies.delete("projecthub_impersonate_member_id")
    return response
  }

  const effectiveRole = normalizeEffectiveRole(rawRole)

  response.cookies.set("projecthub_impersonate_role", effectiveRole, cookieConfig)
  response.cookies.set("projecthub_impersonate_member_name", parsed.data.memberName?.trim() || "", cookieConfig)
  response.cookies.set("projecthub_impersonate_member_id", parsed.data.memberId?.trim() || "", cookieConfig)

  return response
}

export async function DELETE() {
  const auth = await requireAdmin()
  if ("error" in auth) return auth.error

  const response = NextResponse.json({ success: true })
  response.cookies.delete("projecthub_impersonate_role")
  response.cookies.delete("projecthub_impersonate_member_name")
  response.cookies.delete("projecthub_impersonate_member_id")
  return response
}
