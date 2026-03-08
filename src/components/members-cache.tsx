/**
 * Cache Component for Member Data
 * Uses Next.js 16 Cache Components feature for optimized data fetching
 */
"use cache"

import { createClient } from "@/lib/supabase/server"

// Member type for team members
interface Member {
  id: string
  user_id?: string | null
  name: string
  email?: string | null
  role?: string | null
  avatar_url?: string | null
  created_at?: string
}

/**
 * Cached function to get all members
 * This component will be cached and reused across requests
 */
export async function getCachedMembers() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return []
  }

  // Fetch members with profile data
  const { data: members, error } = await supabase
    .from("members")
    .select(
      "id, name, email, role, user_id, profiles:profiles!members_user_id_fkey(role, avatar_url, full_name)",
    )
    .order("name")

  if (error) {
    console.error("Error fetching members:", error)
    return []
  }

  // Normalize member data
  const normalizedMembers = (members || []).map((member) => {
    // Extract avatar from profile if available
    const joinedAvatar =
      Array.isArray(member.profiles) && member.profiles.length > 0
        ? member.profiles[0]?.avatar_url || null
        : (member.profiles as { avatar_url?: string | null } | null)
            ?.avatar_url || null

    // Get display name from profile if available
    const profileRecord = Array.isArray(member.profiles)
      ? member.profiles[0]
      : (member.profiles as { full_name?: string } | null)
      
    const displayName = profileRecord?.full_name || member.name

    // Get system role from profile if available
    let systemRole: string | null = null
    if (Array.isArray(member.profiles) && member.profiles[0]) {
      systemRole = (member.profiles[0] as { role?: string | null })?.role ?? null
    } else if (member.profiles && typeof member.profiles === 'object' && 'role' in member.profiles) {
      systemRole = (member.profiles as { role?: string | null })?.role ?? null
    }

    return {
      id: member.id,
      name: displayName,
      email: member.email,
      role: member.role,
      system_role: systemRole,
      user_id: member.user_id,
      avatar_url: joinedAvatar,
    }
  })

  return normalizedMembers
}

/**
 * Cached function to get a specific member
 * This component will be cached and reused across requests
 */
export async function getCachedMemberById(id: string) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return null
  }

  // Fetch specific member with profile data
  const { data: member, error } = await supabase
    .from("members")
    .select(
      "id, name, email, role, user_id, created_at, profiles:profiles!members_user_id_fkey(role, avatar_url, full_name)",
    )
    .eq("id", id)
    .maybeSingle()

  if (error || !member) {
    console.error("Error fetching member:", error)
    return null
  }

  // Extract avatar from profile if available
  const joinedAvatar =
    Array.isArray(member.profiles) && member.profiles.length > 0
      ? member.profiles[0]?.avatar_url || null
      : (member.profiles as { avatar_url?: string | null } | null)
          ?.avatar_url || null

  // Get display name from profile if available
  const profileRecord = Array.isArray(member.profiles)
    ? member.profiles[0]
    : (member.profiles as { full_name?: string } | null)
    
  const displayName = profileRecord?.full_name || member.name

  // Get system role from profile if available
  let systemRole: string | null = null
  if (Array.isArray(member.profiles) && member.profiles[0]) {
    systemRole = (member.profiles[0] as { role?: string | null })?.role ?? null
  } else if (member.profiles && typeof member.profiles === 'object' && 'role' in member.profiles) {
    systemRole = (member.profiles as { role?: string | null })?.role ?? null
  }

  return {
    id: member.id,
    name: displayName,
    email: member.email,
    role: member.role,
    system_role: systemRole,
    user_id: member.user_id,
    avatar_url: joinedAvatar,
    created_at: member.created_at,
  }
}