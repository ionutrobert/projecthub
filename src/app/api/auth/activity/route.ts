import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"

import { createClient } from "@/lib/supabase/server"
import { getRoleContext } from "@/lib/server-authz"
import { isMissingAuthActivityTableError, logAuthActivity } from "@/lib/auth-activity"

const postSchema = z.object({
  eventType: z.enum(["login_success", "logout", "session_check"]).default("login_success"),
  metadata: z.record(z.string(), z.unknown()).optional(),
})

const noStoreHeaders = {
  "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
  Pragma: "no-cache",
  Expires: "0",
}

export async function POST(request: NextRequest) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers: noStoreHeaders })
  }

  const parsed = postSchema.safeParse(await request.json().catch(() => ({})))
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid auth activity payload" }, { status: 400, headers: noStoreHeaders })
  }

  const logError = await logAuthActivity(supabase, {
    request,
    userId: user.id,
    email: user.email,
    eventType: parsed.data.eventType,
    metadata: parsed.data.metadata,
  })

  if (logError && !isMissingAuthActivityTableError(logError)) {
    return NextResponse.json({ error: logError }, { status: 500, headers: noStoreHeaders })
  }

  return NextResponse.json({ success: true }, { status: 200, headers: noStoreHeaders })
}

export async function GET(request: NextRequest) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers: noStoreHeaders })
  }

  const roleContext = await getRoleContext(supabase, user.id)
  const memberId = request.nextUrl.searchParams.get("memberId")

  if (memberId && roleContext.actualRole !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403, headers: noStoreHeaders })
  }

  let targetUserId = user.id
  let targetEmail = user.email || null
  let targetMember: { id: string; name: string; email: string | null; user_id: string | null } | null = null

  if (memberId) {
    const { data: member, error: memberError } = await supabase
      .from("members")
      .select("id,name,email,user_id")
      .eq("id", memberId)
      .maybeSingle()

    if (memberError || !member) {
      return NextResponse.json({ error: "Member not found" }, { status: 404, headers: noStoreHeaders })
    }

    targetMember = member
    targetUserId = member.user_id || ""
    targetEmail = member.email || null
  }

  let query = supabase
    .from("auth_activity")
    .select("id,event_type,created_at,country,city,user_agent,email,user_id")
    .order("created_at", { ascending: false })
    .limit(50)

  if (memberId) {
    if (targetUserId) {
      query = query.eq("user_id", targetUserId)
    } else if (targetEmail) {
      query = query.ilike("email", targetEmail)
    } else {
      return NextResponse.json(
        {
          hasLoggedIn: false,
          lastLoginAt: null,
          events: [],
          member: targetMember,
        },
        { status: 200, headers: noStoreHeaders }
      )
    }
  } else {
    query = query.eq("user_id", user.id)
  }

  const { data: events, error } = await query

  if (error) {
    if (error.message?.toLowerCase().includes("auth_activity")) {
      return NextResponse.json(
        {
          hasLoggedIn: false,
          lastLoginAt: null,
          events: [],
          missingTable: true,
          member: targetMember,
        },
        { status: 200, headers: noStoreHeaders }
      )
    }

    return NextResponse.json({ error: error.message }, { status: 500, headers: noStoreHeaders })
  }

  const loginEvents = (events || []).filter((event) => event.event_type === "login_success")

  return NextResponse.json(
    {
      hasLoggedIn: loginEvents.length > 0,
      lastLoginAt: loginEvents[0]?.created_at || null,
      events: events || [],
      member: targetMember,
    },
    { status: 200, headers: noStoreHeaders }
  )
}
