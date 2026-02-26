"use client"

import { createContext, useContext, useState, useEffect, ReactNode } from "react"
import { useUser } from "@/components/user-provider"
import { createClient } from "@/lib/supabase/client"

type Theme = "light" | "dark"

interface ThemeContextType {
  theme: Theme
  setTheme: (theme: Theme) => void
  mounted: boolean
  accentColor: string
  setAccentColor: (color: string) => void
  gradientEnabled: boolean
  setGradientEnabled: (enabled: boolean) => void
  microAnimations: boolean
  setMicroAnimations: (enabled: boolean) => void
}

function hexToHSL(hex: string) {
  const sanitized = hex.replace("#", "")
  const bigint = parseInt(sanitized, 16)
  if (Number.isNaN(bigint)) return null
  const r = (bigint >> 16) & 255
  const g = (bigint >> 8) & 255
  const b = bigint & 255
  const rNorm = r / 255
  const gNorm = g / 255
  const bNorm = b / 255
  const max = Math.max(rNorm, gNorm, bNorm)
  const min = Math.min(rNorm, gNorm, bNorm)
  let h = 0
  let s = 0
  const l = (max + min) / 2
  if (max !== min) {
    const d = max - min
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
    switch (max) {
      case rNorm:
        h = (gNorm - bNorm) / d + (gNorm < bNorm ? 6 : 0)
        break
      case gNorm:
        h = (bNorm - rNorm) / d + 2
        break
      default:
        h = (rNorm - gNorm) / d + 4
        break
    }
    h *= 60
  }
  return { h: Math.round(h), s: Math.round(s * 100), l: Math.round(l * 100) }
}

function getInitialTheme(): Theme {
  if (typeof window === "undefined") return "dark"
  const stored = localStorage.getItem("projecthub-theme") as Theme | null
  if (stored === "light" || stored === "dark") return stored
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light"
}

function getInitialAccentColor(): string {
  if (typeof window === "undefined") return "#8b5cf6"
  return localStorage.getItem("projecthub-accent") || "#8b5cf6"
}

function getInitialGradientEnabled(): boolean {
  if (typeof window === "undefined") return true
  const stored = localStorage.getItem("projecthub-gradient")
  return stored === null ? true : stored === "true"
}

function getInitialMicroAnimations(): boolean {
  if (typeof window === "undefined") return true
  const stored = localStorage.getItem("projecthub-micro")
  if (stored === null) {
    return !window.matchMedia("(prefers-reduced-motion: reduce)").matches
  }
  return stored === null ? true : stored === "true"
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined)

export function ThemeProvider({ children }: { children: ReactNode }) {
  const { user, profile } = useUser()

  const [theme, setThemeState] = useState<Theme>(getInitialTheme)
  const [mounted] = useState(typeof window !== "undefined")
  const [accentColor, setAccentColorState] = useState<string>(getInitialAccentColor)
  const [gradientEnabled, setGradientEnabledState] = useState(getInitialGradientEnabled)
  const [microAnimations, setMicroAnimationsState] = useState(getInitialMicroAnimations)

  const supabase = typeof window !== "undefined" ? createClient() : null

  const applyAccentColor = (color: string) => {
    if (typeof document === "undefined") return
    const root = document.documentElement
    const hsl = hexToHSL(color)
    if (hsl) {
      root.style.setProperty("--accent", `${hsl.h} ${hsl.s}% ${hsl.l}%`)
      root.style.setProperty("--primary", `${hsl.h} ${hsl.s}% ${hsl.l}%`)
      root.style.setProperty("--ring", `${hsl.h} ${hsl.s}% ${hsl.l}%`)
      root.style.setProperty("--accent-foreground", "0 0% 100%")
      root.style.setProperty("--primary-foreground", "0 0% 100%")
    }
  }

  const persistToDB = async (updates: Record<string, unknown>) => {
    if (!user?.id || !supabase) return
    const { error } = await supabase
      .from("profiles")
      .update(updates)
      .eq("id", user.id)
    if (error) {
      console.error('Failed to save preference:', error.message)
    }
  }

  const setTheme = (newTheme: Theme) => {
    setThemeState(newTheme)
    if (typeof window !== "undefined") {
      localStorage.setItem("projecthub-theme", newTheme)
      document.documentElement.classList.remove("light", "dark")
      document.documentElement.classList.add(newTheme)
    }
    persistToDB({ theme_preference: newTheme })
  }

  const setAccentColor = (color: string) => {
    setAccentColorState(color)
    if (typeof window !== "undefined") {
      localStorage.setItem("projecthub-accent", color)
    }
    applyAccentColor(color)
    persistToDB({ accent_color: color })
  }

  const setGradientEnabled = (enabled: boolean) => {
    setGradientEnabledState(enabled)
    if (typeof window !== "undefined") {
      localStorage.setItem("projecthub-gradient", String(enabled))
      document.documentElement.dataset.gradient = enabled ? "true" : "false"
    }
    persistToDB({ theme_gradient: enabled })
  }

  const setMicroAnimations = (enabled: boolean) => {
    setMicroAnimationsState(enabled)
    if (typeof window !== "undefined") {
      localStorage.setItem("projecthub-micro", String(enabled))
      document.documentElement.dataset.micro = enabled ? "true" : "false"
    }
    persistToDB({ micro_animations: enabled })
  }

  useEffect(() => {
    const root = document.documentElement
    root.classList.remove("light", "dark")
    root.classList.add(theme)
    root.dataset.gradient = gradientEnabled ? "true" : "false"
    root.dataset.micro = microAnimations ? "true" : "false"
    applyAccentColor(accentColor)
  }, [theme, gradientEnabled, microAnimations, accentColor, applyAccentColor])

  useEffect(() => {
    if (typeof window === "undefined") return

    const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)")

    const handleMotionChange = (e: MediaQueryListEvent) => {
      const shouldDisable = e.matches
      setMicroAnimationsState(!shouldDisable)
      if (typeof window !== "undefined") {
        localStorage.setItem("projecthub-micro", String(!shouldDisable))
        document.documentElement.dataset.micro = (!shouldDisable) ? "true" : "false"
      }
    }

    prefersReducedMotion.addEventListener("change", handleMotionChange)
    return () => prefersReducedMotion.removeEventListener("change", handleMotionChange)
  }, [])

  useEffect(() => {
    if (!mounted || !profile || !user?.id || !supabase) return

    const updates: Record<string, unknown> = {}

    if (!profile.theme_preference) {
      updates.theme_preference = theme
    }

    if (!profile.accent_color) {
      updates.accent_color = accentColor
    }

    if (profile.theme_gradient === null || profile.theme_gradient === undefined) {
      updates.theme_gradient = gradientEnabled
    }

    if (profile.micro_animations === null || profile.micro_animations === undefined) {
      updates.micro_animations = microAnimations
    }

    if (Object.keys(updates).length > 0) {
      persistToDB(updates)
    }
  }, [profile, mounted, theme, accentColor, gradientEnabled, microAnimations, user?.id, supabase])

  return (
    <ThemeContext.Provider
      value={{
        theme,
        setTheme,
        mounted,
        accentColor,
        setAccentColor,
        gradientEnabled,
        setGradientEnabled,
        microAnimations,
        setMicroAnimations,
      }}
    >
      {children}
    </ThemeContext.Provider>
  )
}

export function useTheme() {
  const context = useContext(ThemeContext)
  if (!context) {
    throw new Error("useTheme must be used within ThemeProvider")
  }
  return context
}
