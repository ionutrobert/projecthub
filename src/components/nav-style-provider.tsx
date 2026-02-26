"use client"

import { createContext, useContext, useEffect, useState, type ReactNode } from "react"

import { useUser } from "@/components/user-provider"
import { createClient } from "@/lib/supabase/client"

type NavStyle = "top" | "sidebar"

interface NavStyleContextType {
  navStyle: NavStyle
  setNavStyle: (style: NavStyle) => void
  mobileMenuOpen: boolean
  setMobileMenuOpen: (open: boolean) => void
  toggleMobileMenu: () => void
  sidebarCollapsed: boolean
  setSidebarCollapsed: (collapsed: boolean) => void
}

const NavStyleContext = createContext<NavStyleContextType | undefined>(undefined)

function getInitialNavStyle(): NavStyle {
  if (typeof window === "undefined") return "top"
  const stored = localStorage.getItem("projecthub-navstyle")
  return stored === "top" || stored === "sidebar" ? stored : "top"
}

function getInitialSidebarCollapsed(): boolean {
  if (typeof window === "undefined") return false
  return localStorage.getItem("projecthub-sidebar-collapsed") === "true" && window.innerWidth >= 1024
}

function getInitialHasLocalPreference(): boolean {
  if (typeof window === "undefined") return false
  const stored = localStorage.getItem("projecthub-navstyle")
  return stored === "top" || stored === "sidebar"
}

export function NavStyleProvider({ children }: { children: ReactNode }) {
  const { user, profile } = useUser()

  const [navStyle, setNavStyleState] = useState<NavStyle>(getInitialNavStyle)
  const [mobileMenuOpen, setMobileMenuOpenState] = useState(false)
  const [sidebarCollapsed, setSidebarCollapsedState] = useState<boolean>(getInitialSidebarCollapsed)
  const [hasLocalPreference, setHasLocalPreference] = useState<boolean>(getInitialHasLocalPreference)

  const profileNavStyle =
    profile?.nav_style === "top" || profile?.nav_style === "sidebar"
      ? (profile.nav_style as NavStyle)
      : null

  useEffect(() => {
    if (!profileNavStyle || hasLocalPreference) return
    localStorage.setItem("projecthub-navstyle", profileNavStyle)
  }, [profileNavStyle, hasLocalPreference])

  const effectiveNavStyle = !hasLocalPreference && profileNavStyle ? profileNavStyle : navStyle

  const setNavStyle = async (style: NavStyle) => {
    setHasLocalPreference(true)
    setNavStyleState(style)
    localStorage.setItem("projecthub-navstyle", style)

    if (user?.id) {
      const supabase = createClient()
      const { error } = await supabase.from("profiles").update({ nav_style: style }).eq("id", user.id)
      if (error) {
        console.error("Failed to update nav style:", error.message)
      }
    }
  }

  const setMobileMenuOpen = (open: boolean) => {
    setMobileMenuOpenState(open)
  }

  const setSidebarCollapsed = (collapsed: boolean) => {
    setSidebarCollapsedState(collapsed)
    if (typeof window !== "undefined" && window.innerWidth >= 1024) {
      localStorage.setItem("projecthub-sidebar-collapsed", String(collapsed))
    }
  }

  const toggleMobileMenu = () => {
    setMobileMenuOpenState((prev) => !prev)
  }

  useEffect(() => {
    const handleResize = () => {
      if (typeof window !== "undefined" && window.innerWidth < 1024 && sidebarCollapsed) {
        setSidebarCollapsedState(false)
      }
    }

    window.addEventListener("resize", handleResize)
    return () => window.removeEventListener("resize", handleResize)
  }, [sidebarCollapsed])

  return (
    <NavStyleContext.Provider
      value={{
        navStyle: effectiveNavStyle,
        setNavStyle,
        mobileMenuOpen,
        setMobileMenuOpen,
        toggleMobileMenu,
        sidebarCollapsed,
        setSidebarCollapsed,
      }}
    >
      {children}
    </NavStyleContext.Provider>
  )
}

export function useNavStyle() {
  const context = useContext(NavStyleContext)
  if (!context) {
    throw new Error("useNavStyle must be used within NavStyleProvider")
  }
  return context
}
