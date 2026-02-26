import { createHash } from "crypto"

import type { NextRequest } from "next/server"

type AuthActivityEventType = "login_success" | "logout" | "session_check"

type LogAuthActivityInput = {
  request: NextRequest
  userId: string
  email?: string | null
  eventType: AuthActivityEventType
  metadata?: Record<string, unknown>
}

type SupabaseInsertResult = {
  error: { message?: string | null } | null
}

type SupabaseInsertClient = {
  from: (table: string) => {
    insert: (values: Record<string, unknown>) => PromiseLike<SupabaseInsertResult>
  }
}

const MISSING_TABLE_SENTINEL = "__MISSING_AUTH_ACTIVITY_TABLE__"

function getClientIp(request: NextRequest) {
  const forwarded = request.headers.get("x-forwarded-for")
  if (forwarded) {
    return forwarded.split(",")[0]?.trim() || null
  }

  return request.headers.get("x-real-ip") || null
}

function hashIp(ip: string | null) {
  if (!ip) return null
  const salt = process.env.AUTH_ACTIVITY_IP_SALT || "projecthub-auth-activity"
  return createHash("sha256").update(`${salt}:${ip}`).digest("hex")
}

export async function logAuthActivity(
  supabase: SupabaseInsertClient,
  input: LogAuthActivityInput
) {
  const userAgent = input.request.headers.get("user-agent")
  const country = input.request.headers.get("x-vercel-ip-country")
  const city = input.request.headers.get("x-vercel-ip-city")
  const ipHash = hashIp(getClientIp(input.request))

  const { error } = await supabase.from("auth_activity").insert({
    user_id: input.userId,
    email: input.email || null,
    event_type: input.eventType,
    user_agent: userAgent,
    ip_hash: ipHash,
    country,
    city,
    metadata: input.metadata || {},
  })

  if (!error) return null

  if (error.message?.toLowerCase().includes("auth_activity")) {
    return MISSING_TABLE_SENTINEL
  }

  return error.message || "Failed to log auth activity"
}

export function isMissingAuthActivityTableError(error: string | null) {
  return error === MISSING_TABLE_SENTINEL
}
