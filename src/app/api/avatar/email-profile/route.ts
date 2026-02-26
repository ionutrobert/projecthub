import { createHash } from "crypto"

import { NextRequest, NextResponse } from "next/server"

type AvatarCacheEntry = {
  url: string | null
  expiresAt: number
}

const avatarLookupCache = new Map<string, AvatarCacheEntry>()
const POSITIVE_TTL_MS = 24 * 60 * 60 * 1000
const NEGATIVE_TTL_MS = 30 * 60 * 1000
const LOOKUP_TIMEOUT_MS = 1200

function md5(value: string) {
  return createHash("md5").update(value).digest("hex")
}

async function exists(url: string): Promise<boolean> {
  try {
    const timeoutSignal = AbortSignal.timeout(LOOKUP_TIMEOUT_MS)
    const response = await fetch(url, {
      method: "HEAD",
      cache: "no-store",
      redirect: "follow",
      signal: timeoutSignal,
    })

    if (response.ok) {
      return true
    }

    if (response.status === 405) {
      const getResponse = await fetch(url, {
        method: "GET",
        cache: "no-store",
        redirect: "follow",
        signal: AbortSignal.timeout(LOOKUP_TIMEOUT_MS),
      })
      return getResponse.ok
    }

    return false
  } catch {
    return false
  }
}

export async function GET(request: NextRequest) {
  const email = request.nextUrl.searchParams.get("email")?.trim().toLowerCase()

  if (!email) {
    return NextResponse.json({ error: "Missing email" }, { status: 400 })
  }

  const hash = md5(email)
  const cached = avatarLookupCache.get(hash)
  const now = Date.now()

  if (cached && cached.expiresAt > now) {
    if (cached.url) {
      return NextResponse.redirect(cached.url, {
        status: 307,
        headers: {
          "Cache-Control": "public, max-age=86400, stale-while-revalidate=604800",
        },
      })
    }

    return NextResponse.json(
      { error: "No email-based avatar" },
      {
        status: 404,
        headers: {
          "Cache-Control": "public, max-age=1800, stale-while-revalidate=21600",
        },
      }
    )
  }

  const gravatarUrl = `https://www.gravatar.com/avatar/${hash}?s=256&d=404&r=g`
  const libravatarUrl = `https://seccdn.libravatar.org/avatar/${hash}?s=256&d=404`

  const [gravatarExists, libravatarExists] = await Promise.all([
    exists(gravatarUrl),
    exists(libravatarUrl),
  ])

  if (gravatarExists) {
    avatarLookupCache.set(hash, { url: gravatarUrl, expiresAt: now + POSITIVE_TTL_MS })
    return NextResponse.redirect(gravatarUrl, {
      status: 307,
      headers: {
        "Cache-Control": "public, max-age=86400, stale-while-revalidate=604800",
      },
    })
  }

  if (libravatarExists) {
    avatarLookupCache.set(hash, { url: libravatarUrl, expiresAt: now + POSITIVE_TTL_MS })
    return NextResponse.redirect(libravatarUrl, {
      status: 307,
      headers: {
        "Cache-Control": "public, max-age=86400, stale-while-revalidate=604800",
      },
    })
  }

  avatarLookupCache.set(hash, { url: null, expiresAt: now + NEGATIVE_TTL_MS })
  return NextResponse.json(
    { error: "No email-based avatar" },
    {
      status: 404,
      headers: {
        "Cache-Control": "public, max-age=1800, stale-while-revalidate=21600",
      },
    }
  )
}
