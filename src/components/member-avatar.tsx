"use client"

import { useMemo, useState } from "react"

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
}

export default function MemberAvatar({
  name,
  email,
  userId,
  avatarUrl,
  sizeClass = "h-10 w-10",
  textClass = "text-xs",
  className,
}: MemberAvatarProps) {
  const candidates = useMemo(
    () =>
      getMemberAvatarCandidates({
        name,
        email,
        user_id: userId,
        avatar_url: avatarUrl,
      }),
    [name, email, userId, avatarUrl]
  )
  const [candidateIndex, setCandidateIndex] = useState(0)
  const currentSrc = candidates[candidateIndex]

  if (currentSrc) {
    return (
      <img
        src={currentSrc}
        alt={`${name || "Member"} avatar`}
        className={cn("rounded-full object-cover avatar-ring", sizeClass, className)}
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
    )
  }

  return (
    <div
      className={cn(
        "rounded-full bg-primary/20 flex items-center justify-center shrink-0 avatar-ring",
        sizeClass,
        className
      )}
    >
      <span className={cn("font-medium", textClass)}>{getNameInitials(name, email)}</span>
    </div>
  )
}
