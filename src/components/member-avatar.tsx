"use client"

import { useMemo, useState } from "react"
import Image from "next/image"

import { cn } from "@/lib/utils"
import { getNameInitials } from "@/lib/avatar"
import { getAvatarCandidates } from "@/lib/avatar-service"

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
  const candidates = useMemo(
    () => {
      // Use the new avatar service for consistent processing
      const avatarData = {
        id: userId || "unknown",
        name: name || null,
        email: email || null,
        avatar_url: avatarUrl || null,
        user_id: userId || null,
        type: "member" as const
      };

      return getAvatarCandidates(avatarData);
    },
    [name, email, userId, avatarUrl]
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
