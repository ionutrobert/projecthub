"use client"

import { useSyncExternalStore } from "react"

import { Header } from "@/components/header"
import { Sidebar } from "@/components/sidebar"
import { useNavStyle } from "@/components/nav-style-provider"
import { Button } from "@/components/ui/button"
import { useUser } from "@/components/user-provider"

function useIsHydrated() {
  return useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  )
}

export default function DashboardShell({
  children,
}: {
  children: React.ReactNode
}) {
  const isHydrated = useIsHydrated()
  const { navStyle } = useNavStyle()
  const { impersonation, clearImpersonation } = useUser()

  if (!isHydrated) {
    return (
      <div className="flex h-screen flex-col overflow-hidden bg-background">
        <div className="diffusion-orb orb-1" />
        <div className="diffusion-orb orb-2" />
        <div className="h-16 border-b border-border bg-card/80" />
        <main className="flex-1 overflow-y-auto p-4 md:p-6 lg:p-8" />
      </div>
    )
  }

  const impersonationBar = impersonation ? (
    <div className="flex h-10 items-center justify-between border-b border-amber-400/30 bg-amber-500/10 px-3 text-xs text-amber-700 dark:text-amber-300 md:px-6">
      <p className="truncate">
        Impersonating <span className="font-semibold">{impersonation.memberName || "selected user"}</span>
        <span className="ml-1">({impersonation.role})</span>
      </p>
      <Button variant="outline" size="sm" className="h-7 px-2 text-[11px]" onClick={clearImpersonation}>
        Stop
      </Button>
    </div>
  ) : null

  if (navStyle === "sidebar") {
    return (
      <div className="flex h-screen flex-col overflow-hidden bg-background">
        <div className="diffusion-orb orb-1" />
        <div className="diffusion-orb orb-2" />
        <div className="flex flex-1 overflow-hidden">
          <Sidebar />
          <div className="relative z-10 flex flex-1 flex-col overflow-hidden transition-all duration-300">
            {impersonationBar}
            <Header />
            <main className="flex-1 overflow-y-auto p-4 md:p-6 lg:p-8">{children}</main>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-background">
      <div className="diffusion-orb orb-1" />
      <div className="diffusion-orb orb-2" />
      {impersonationBar}
      <Header />
      <main className="relative z-10 flex-1 overflow-y-auto p-4 md:p-6 lg:p-8">{children}</main>
    </div>
  )
}
