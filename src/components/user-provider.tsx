"use client"

import { createContext, useContext, useEffect, useState, ReactNode } from "react"
import { createClient } from "@/lib/supabase"
import { User } from "@supabase/supabase-js"
import { useRouter } from "next/navigation"

interface Profile {
  theme_gradient?: boolean
  micro_animations?: boolean
  id: string
  email: string
  full_name: string | null
  role: "admin" | "member" | "viewer"
  actual_role?: "admin" | "member" | "viewer"
  avatar_url: string | null
  theme_preference?: "light" | "dark" | "system"
  accent_color?: string
  nav_style?: "top" | "sidebar"
}

interface UserContextType {
  user: User | null
  profile: Profile | null
  impersonation: { role: "admin" | "member" | "viewer"; memberName: string | null; memberId: string | null } | null
  loading: boolean
  signOut: () => Promise<void>
  clearImpersonation: () => Promise<void>
}

const UserContext = createContext<UserContextType | undefined>(undefined)

export function UserProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)
  const [impersonation, setImpersonation] = useState<{
    role: "admin" | "member" | "viewer"
    memberName: string | null
    memberId: string | null
  } | null>(null)
  const [initialized, setInitialized] = useState(false)
  const router = useRouter()

  useEffect(() => {
    let isMounted = true
    const supabase = createClient()

    const withTimeout = async <T,>(promise: Promise<T>, ms: number): Promise<T> => {
      return await new Promise<T>((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error("Auth bootstrap timed out")), ms)
        promise
          .then((value) => {
            clearTimeout(timer)
            resolve(value)
          })
          .catch((error) => {
            clearTimeout(timer)
            reject(error)
          })
      })
    }

    const loadProfile = async (userId: string) => {
      try {
        const { data: profileData } = await supabase
          .from("profiles")
          .select("*")
          .eq("id", userId)
          .single()

        if (isMounted) {
          setProfile((profileData as Profile) ?? null)
        }
      } catch {
        if (isMounted) {
          setProfile(null)
        }
      }
    }

    const getServerAuthSafe = async (): Promise<{
      user: User | null
      profile: Profile | null
      impersonation?: { role: "admin" | "member" | "viewer"; memberName: string | null; memberId: string | null } | null
    } | null> => {
      try {
        const response = await withTimeout(
          fetch("/api/auth/me", {
            method: "GET",
            cache: "no-store",
            headers: { "Content-Type": "application/json" },
          }),
          8000
        )

        if (!response.ok) {
          return null
        }

        return (await response.json()) as {
          user: User | null
          profile: Profile | null
          impersonation?: { role: "admin" | "member" | "viewer"; memberName: string | null; memberId: string | null } | null
        }
      } catch {
        return null
      }
    }

    const hydrateFromServerAuth = async () => {
      const snapshot = await getServerAuthSafe()
      if (!snapshot || !isMounted) return false

      setUser(snapshot.user)
      setProfile(snapshot.profile)
      setImpersonation(snapshot.impersonation || null)
      return true
    }

    const bootstrap = async () => {
      try {
        const getSessionSafe = async () => {
          try {
            return await withTimeout(supabase.auth.getSession(), 5000)
          } catch {
            return null
          }
        }

        const getUserSafe = async () => {
          try {
            return await withTimeout(supabase.auth.getUser(), 8000)
          } catch {
            return null
          }
        }

        const serverAuth = await getServerAuthSafe()

        if (serverAuth?.user) {
          if (!isMounted) return
          setUser(serverAuth.user)
          setProfile(serverAuth.profile)
          setImpersonation(serverAuth.impersonation || null)
          setLoading(false)
          setInitialized(true)
          return
        }

        const [sessionResult, userResult] = await Promise.all([
          getSessionSafe(),
          getUserSafe(),
        ])

        if (!isMounted) return

        const sessionUser = sessionResult?.data.session?.user ?? null
        const verifiedUser = userResult?.data.user ?? null
        const initialUser = verifiedUser ?? sessionUser

        setUser(initialUser)
        setImpersonation(null)

        setInitialized(true)

        if (initialUser) {
          const hydrated = await hydrateFromServerAuth()
          if (!hydrated) {
            await loadProfile(initialUser.id)
          }
          if (isMounted) {
            setLoading(false)
          }
        } else {
          setProfile(null)
          setLoading(false)
        }
      } catch {
        if (!isMounted) return
        setUser(null)
        setProfile(null)
        setLoading(false)
        setInitialized(true)
      }
    }

    bootstrap()

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (!isMounted) return

      setLoading(true)
      const nextUser = session?.user ?? null
      setUser(nextUser)

      if (!nextUser) {
        setProfile(null)
        setImpersonation(null)
        setLoading(false)
      } else {
        const hydrated = await hydrateFromServerAuth()
        if (!hydrated) {
          await loadProfile(nextUser.id)
        }
        if (isMounted) {
          setLoading(false)
        }
      }
    })

    return () => {
      isMounted = false
      subscription.unsubscribe()
    }
  }, [])

  const signOut = async () => {
    const supabase = createClient()

    try {
      await fetch("/api/auth/activity", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ eventType: "logout" }),
      })
    } catch {
      // no-op
    }

    try {
      await supabase.auth.signOut({ scope: "global" })
    } catch {
      // continue with local cleanup even if global signout fails
    }

    setUser(null)
    setProfile(null)
    setImpersonation(null)

    if (typeof window !== "undefined") {
      Object.keys(window.localStorage)
        .filter((key) => key.startsWith("sb-"))
        .forEach((key) => window.localStorage.removeItem(key))
    }

    router.replace("/auth/login")
    router.refresh()
  }

  const clearImpersonation = async () => {
    try {
      await fetch("/api/admin/impersonation", { method: "DELETE" })
    } catch {
      // no-op
    }

    setImpersonation(null)
    router.refresh()
  }

  if (!initialized) {
    return (
      <UserContext.Provider
        value={{
          user: null,
          profile: null,
          impersonation: null,
          loading: true,
          signOut: async () => {},
          clearImpersonation: async () => {},
        }}
      >
        {children}
      </UserContext.Provider>
    )
  }

  return (
    <UserContext.Provider value={{ user, profile, impersonation, loading, signOut, clearImpersonation }}>
      {children}
    </UserContext.Provider>
  )
}

export function useUser() {
  const context = useContext(UserContext)
  if (context === undefined) {
    throw new Error("useUser must be used within UserProvider")
  }
  return context
}
