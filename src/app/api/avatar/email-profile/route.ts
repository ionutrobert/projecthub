import { createHash } from "crypto"

import { NextRequest, NextResponse } from "next/server"

export const dynamic = "force-dynamic"

function md5(value: string) {
  return createHash("md5").update(value).digest("hex")
}

async function exists(url: string): Promise<boolean> {
  try {
    const response = await fetch(url, {
      method: "HEAD",
      cache: "no-store",
      redirect: "follow",
    })

    if (response.ok) {
      return true
    }

    if (response.status === 405) {
      const getResponse = await fetch(url, {
        method: "GET",
        cache: "no-store",
        redirect: "follow",
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
  const gravatarUrl = `https://www.gravatar.com/avatar/${hash}?s=256&d=404&r=g`
  const libravatarUrl = `https://seccdn.libravatar.org/avatar/${hash}?s=256&d=404`

  if (await exists(gravatarUrl)) {
    return NextResponse.redirect(gravatarUrl)
  }

  if (await exists(libravatarUrl)) {
    return NextResponse.redirect(libravatarUrl)
  }

  return NextResponse.json({ error: "No email-based avatar" }, { status: 404 })
}
