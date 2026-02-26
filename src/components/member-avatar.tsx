"use client"

import { useMemo, useState } from "react"
import Image from "next/image"

import { useUser } from "@/components/user-provider"
import { cn } from "@/lib/utils"
import { getMemberAvatarCandidates, getNameInitials } from "@/lib/avatar"

type MemberAvatarProps = {
  name?: string | null
  email?: string | null
  userId?: string | null
  avatarUrl?: string | null
  sizeClass?: string
  textClass?: string
  className?: string
  ring?: boolean
}

export default function MemberAvatar({
  name,
  email,
  userId,
  avatarUrl,
  sizeClass = "h-10 w-10",
  textClass = "text-xs",
  className,
  ring = true,
}: MemberAvatarProps) {
  const { profile } = useUser()

  const candidates = useMemo(
    () => {
      const normalizedMemberEmail = (email || "").trim().toLowerCase()
      const normalizedProfileEmail = (profile?.email || "").trim().toLowerCase()

      const isCurrentUserAvatar =
        (Boolean(profile?.id) && Boolean(userId) && profile?.id === userId) ||
        (Boolean(normalizedMemberEmail) && normalizedMemberEmail === normalizedProfileEmail)

      return getMemberAvatarCandidates(
        {
          name,
          email,
          user_id: userId,
          avatar_url: avatarUrl,
        },
        { includeEmailAvatar: isCurrentUserAvatar }
      )
    },
    [name, email, userId, avatarUrl, profile?.id, profile?.email]
  )
  const [candidateIndex, setCandidateIndex] = useState(0)
  const currentSrc = candidates[candidateIndex]

  if (currentSrc) {
    return (
      <div className={cn("relative overflow-hidden rounded-full", ring && "avatar-ring", sizeClass, className)}>
        <Image
          src={currentSrc}
          alt={`${name || "Member"} avatar`}
          fill
          sizes="64px"
          className="object-cover"
          unoptimized
          referrerPolicy="no-referrer"
          onError={() => {
            setCandidateIndex((prev) => {
              if (prev >= candidates.length - 1) {
                return prev
              }
              return prev + 1
            })
          }}
        />
      </div>
    )
  }

  return (
    <div
      className={cn(
        "rounded-full bg-primary/20 flex items-center justify-center shrink-0",
        ring && "avatar-ring",
        sizeClass,
        className
      )}
    >
      <span className={cn("font-medium", textClass)}>{getNameInitials(name, email)}</span>
    </div>
  )
}
