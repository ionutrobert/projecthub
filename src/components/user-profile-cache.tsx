/**
 * Cache Component for User Profile Data
 * Uses Next.js 16 Cache Components feature for optimized data fetching
 */
"use cache"

import { createClient } from "@/lib/supabase/server"
import { getRoleContext } from "@/lib/server-authz"

// Profile type matching our database schema
interface Profile {
  id: string
  email: string
  full_name: string | null
  role: "admin" | "member" | "viewer"
  avatar_url: string | null
  theme_preference?: "light" | "dark" | "system"
  accent_color?: string
  nav_style?: "top" | "sidebar"
  created_at?: string
  updated_at?: string
}

/**
 * Cached function to get user profile data
 * This component will be cached and reused across requests
 */
export async function getCachedUserProfile() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { user: null, profile: null }
  }

  // Fetch profile data
  const { data: profile } = await supabase
    .from("profiles")
    .select("*, members(role)")
    .eq("id", user.id)
    .maybeSingle()

  // Get role context
  const roleContext = await getRoleContext(supabase, user.id)

  // Shape the profile data
  const shapedProfile = profile
    ? {
        ...profile,
        actual_role: roleContext.actualRole,
        role: roleContext.effectiveRole,
      }
    : null

  return { user, profile: shapedProfile }
}

/**
 * Cache Component for User Avatar Data
 * Provides optimized avatar data fetching with caching
 */
export async function getUserAvatarCache() {
  const { user, profile } = await getCachedUserProfile()
  
  if (!user || !profile) {
    return null
  }

  return {
    id: profile.id,
    name: profile.full_name,
    email: profile.email,
    avatar_url: profile.avatar_url,
    user_id: user.id,
    type: "user" as const
  }
}