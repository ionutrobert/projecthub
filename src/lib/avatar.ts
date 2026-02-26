import { User } from "@supabase/supabase-js"

type ProfileLike = {
  avatar_url?: string | null
  full_name?: string | null
  email?: string | null
}

type MemberLike = {
  avatar_url?: string | null
  name?: string | null
  email?: string | null
  user_id?: string | null
}

const DICEBEAR_STYLES = [
  "notionists",
  "adventurer",
  "lorelei",
  "micah",
  "personas",
  "fun-emoji",
  "thumbs",
  "bottts",
] as const

export function getOAuthAvatar(user: User | null): string | null {
  const metadata = user?.user_metadata as Record<string, unknown> | undefined
  const oauthAvatar =
    (typeof metadata?.avatar_url === "string" && metadata.avatar_url) ||
    (typeof metadata?.picture === "string" && metadata.picture) ||
    null
  return oauthAvatar
}

export function getLinkedInAvatar(user: User | null): string | null {
  if (!user) return null

  const identities = Array.isArray(user.identities) ? user.identities : []
  const linkedInIdentity = identities.find((identity) =>
    String(identity?.provider || "").toLowerCase().includes("linkedin")
  )

  if (!linkedInIdentity) return null

  const identityData = (linkedInIdentity.identity_data || {}) as Record<string, unknown>
  const avatarFromIdentity =
    (typeof identityData.avatar_url === "string" && identityData.avatar_url) ||
    (typeof identityData.picture === "string" && identityData.picture) ||
    (typeof identityData.profile_picture_url === "string" && identityData.profile_picture_url) ||
    null

  const metadata = user.user_metadata as Record<string, unknown> | undefined
  const avatarFromMetadata =
    (typeof metadata?.avatar_url === "string" && metadata.avatar_url) ||
    (typeof metadata?.picture === "string" && metadata.picture) ||
    (typeof metadata?.profile_picture_url === "string" && metadata.profile_picture_url) ||
    null

  return avatarFromIdentity || avatarFromMetadata
}

export function getAvatarCandidates(profile: ProfileLike | null, user: User | null): string[] {
  if (profile?.avatar_url === "initials") {
    return []
  }

  const linkedInAvatar = getLinkedInAvatar(user)
  const oauthAvatar = getOAuthAvatar(user)
  const email = user?.email || profile?.email || ""
  const emailProfileAvatar = email
    ? `/api/avatar/email-profile?email=${encodeURIComponent(email)}`
    : null

  const uniqueSeed = user?.id || user?.email || profile?.email || profile?.full_name || "projecthub-user"
  const dicebearCartoon = `https://api.dicebear.com/9.x/notionists/svg?seed=${encodeURIComponent(uniqueSeed)}`

  return [
    profile?.avatar_url || null,
    linkedInAvatar,
    oauthAvatar,
    emailProfileAvatar,
    dicebearCartoon,
  ].filter(
    (value): value is string => Boolean(value)
  )
}

export function getMemberAvatarCandidates(member: MemberLike): string[] {
  if (member.avatar_url === "initials") {
    return []
  }

  const emailProfileAvatar = member.email
    ? `/api/avatar/email-profile?email=${encodeURIComponent(member.email)}`
    : null

  const uniqueSeed = member.user_id || member.email || member.name || "projecthub-member"
  const dicebearCartoon = `https://api.dicebear.com/9.x/notionists/svg?seed=${encodeURIComponent(uniqueSeed)}`

  return [member.avatar_url || null, emailProfileAvatar, dicebearCartoon].filter(
    (value): value is string => Boolean(value)
  )
}

export function getNameInitials(name?: string | null, fallbackEmail?: string | null): string {
  const displayName = name?.trim() || fallbackEmail?.split("@")[0] || "User"
  const parts = displayName.split(/\s+/).filter(Boolean)
  if (parts.length === 1) {
    return parts[0].slice(0, 2).toUpperCase()
  }
  return `${parts[0][0] || ""}${parts[1][0] || ""}`.toUpperCase()
}

export function getAvatarPickerOptions(seed: string, variant = 0): string[] {
  return DICEBEAR_STYLES.map((style, index) => {
    const styleSeed = `${seed}-${variant}-${index}`
    return `https://api.dicebear.com/9.x/${style}/svg?seed=${encodeURIComponent(styleSeed)}`
  })
}

export function getInitials(profile: ProfileLike | null, user: User | null): string {
  const displayName = profile?.full_name?.trim() || profile?.email?.split("@")[0] || user?.email?.split("@")[0] || "User"
  const parts = displayName.split(/\s+/).filter(Boolean)
  if (parts.length === 1) {
    return parts[0].slice(0, 2).toUpperCase()
  }
  return `${parts[0][0] || ""}${parts[1][0] || ""}`.toUpperCase()
}
