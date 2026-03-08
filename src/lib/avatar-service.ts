import { User } from "@supabase/supabase-js";
import { cache } from "react";

// Profile type matching our database schema
export interface Profile {
  id: string;
  email: string;
  full_name: string | null;
  role: "admin" | "member" | "viewer";
  avatar_url: string | null;
  theme_preference?: "light" | "dark" | "system";
  accent_color?: string;
  nav_style?: "top" | "sidebar";
  created_at?: string;
  updated_at?: string;
}

// Member type for team members
export interface Member {
  id: string;
  user_id?: string | null;
  name: string;
  email?: string | null;
  role?: string | null;
  avatar_url?: string | null;
  created_at?: string;
}

// Unified avatar data structure
export interface AvatarData {
  id: string;
  name: string | null;
  email: string | null;
  avatar_url: string | null;
  user_id?: string | null;
  type: "user" | "member";
}

/**
 * Get avatar data for a logged-in user
 * Source of truth: profiles.avatar_url
 */
export async function getUserAvatarData(user: User | null, profile: Profile | null): Promise<AvatarData | null> {
  if (!user || !profile) return null;
  
  return {
    id: profile.id,
    name: profile.full_name,
    email: profile.email,
    avatar_url: profile.avatar_url,
    user_id: user.id,
    type: "user"
  };
}

/**
 * Get avatar data for a team member
 * For registered users: source of truth is profiles.avatar_url
 * For guest members: source of truth would be members.avatar_url (if it existed)
 */
export async function getMemberAvatarData(member: Member): Promise<AvatarData> {
  return {
    id: member.id,
    name: member.name,
    email: member.email || null,
    avatar_url: member.avatar_url || null,
    user_id: member.user_id || null,
    type: "member"
  };
}

/**
 * Cached function to get user avatar data
 * Uses React cache for request memoization
 */
export const getCachedUserAvatarData = cache(getUserAvatarData);

/**
 * Cached function to get member avatar data
 * Uses React cache for request memoization
 */
export const getCachedMemberAvatarData = cache(getMemberAvatarData);

/**
 * Generate fallback avatar URL using DiceBear
 */
export function generateFallbackAvatar(seed: string, style: string = "notionists"): string {
  return `https://api.dicebear.com/9.x/${style}/svg?seed=${encodeURIComponent(seed)}`;
}

/**
 * Get avatar candidates in priority order
 */
export function getAvatarCandidates(avatarData: AvatarData): string[] {
  const candidates: (string | null)[] = [];
  
  // 1. Primary avatar URL (source of truth)
  if (avatarData.avatar_url) {
    candidates.push(avatarData.avatar_url);
  }
  
  // 2. Email-based avatar for members
  if (avatarData.type === "member" && avatarData.email) {
    candidates.push(`/api/avatar/email-profile?email=${encodeURIComponent(avatarData.email)}`);
  }
  
  // 3. Fallback avatar
  const seed = avatarData.user_id || avatarData.email || avatarData.name || `projecthub-${avatarData.type}`;
  candidates.push(generateFallbackAvatar(seed));
  
  // Filter out null values and return
  return candidates.filter((url): url is string => url !== null);
}