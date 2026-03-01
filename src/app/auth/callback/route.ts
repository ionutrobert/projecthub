import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

import { isMissingAuthActivityTableError, logAuthActivity } from '@/lib/auth-activity'

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const next = searchParams.get('next') ?? '/'

  const response = NextResponse.redirect(`${origin}${next}`)

  if (code) {
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return request.cookies.getAll()
          },
          setAll(cookiesToSet: { name: string; value: string; options: CookieOptions }[]) {
            cookiesToSet.forEach(({ name, value, options }) => {
              response.cookies.set(name, value, options)
            })
          },
        },
      }
    )

    const { error } = await supabase.auth.exchangeCodeForSession(code)
    
    if (!error) {
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (user?.id) {
        const logError = await logAuthActivity(supabase, {
          request,
          userId: user.id,
          email: user.email,
          eventType: 'login_success',
          metadata: { auth_flow: 'oauth_callback' },
        })

        if (logError && !isMissingAuthActivityTableError(logError)) {
          console.error('Failed to write auth activity:', logError)
        }

        // Sync OAuth avatar to profiles table so it appears consistently across the app
        interface OAuthMetadata {
          avatar_url?: string
          picture?: string
          profile_picture_url?: string
        }
        const metadata = user.user_metadata as OAuthMetadata | undefined
        const oauthAvatar =
          typeof metadata?.avatar_url === 'string' && metadata.avatar_url
            ? metadata.avatar_url
            : typeof metadata?.picture === 'string' && metadata.picture
            ? metadata.picture
            : typeof metadata?.profile_picture_url === 'string' && metadata.profile_picture_url
            ? metadata.profile_picture_url
            : null

        if (oauthAvatar) {
          await supabase
            .from('profiles')
            .update({ avatar_url: oauthAvatar })
            .eq('id', user.id)
        }
      }

      return response
    }
  }

  return NextResponse.redirect(`${origin}/auth/auth-code-error`)
}
