"use client"

import { useMemo, useState } from "react"
import { User } from "@supabase/supabase-js"
import Image from "next/image"

import { cn } from "@/lib/utils"
import { getAvatarCandidates, getInitials } from "@/lib/avatar"

type ProfileLike = {
  avatar_url?: string | null
  full_name?: string | null
  email?: string | null
}

export default function UserAvatar({
  profile,
  user,
  sizeClass = "h-8 w-8",
  textClass = "text-sm",
  className,
  ring = true,
}: {
  profile: ProfileLike | null
  user: User | null
  sizeClass?: string
  textClass?: string
  className?: string
  ring?: boolean
}) {
  const candidates = useMemo(() => getAvatarCandidates(profile, user), [profile, user])
  const [candidateIndex, setCandidateIndex] = useState(0)
  const currentSrc = candidates[candidateIndex]

  if (currentSrc) {
    return (
      <div className={cn("relative overflow-hidden rounded-full", ring && "avatar-ring", sizeClass, className)}>
        <Image
          src={currentSrc}
          alt="User avatar"
          fill
          sizes="48px"
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
      <span className={cn("font-medium", textClass)}>{getInitials(profile, user)}</span>
    </div>
  )
}
