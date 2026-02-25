"use client"

import { createContext, useContext, useState, useEffect, ReactNode } from "react"

type NavStyle = "top" | "sidebar"

interface NavStyleContextType {
  navStyle: NavStyle
  setNavStyle: (style: NavStyle) => void
}

const NavStyleContext = createContext<NavStyleContextType | undefined>(undefined)

export function NavStyleProvider({ children }: { children: ReactNode }) {
  const [navStyle, setNavStyleState] = useState<NavStyle>("top")
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
    const stored = localStorage.getItem("projecthub-navstyle") as NavStyle | null
    if (stored) {
      setNavStyleState(stored)
    }
  }, [])

  const setNavStyle = (style: NavStyle) => {
    setNavStyleState(style)
    localStorage.setItem("projecthub-navstyle", style)
  }

  return (
    <NavStyleContext.Provider value={{ navStyle, setNavStyle }}>
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
