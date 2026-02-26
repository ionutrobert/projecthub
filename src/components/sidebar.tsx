"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { LayoutDashboard, FolderKanban, CheckSquare, Settings, Users, BarChart3, LogOut, X, PanelLeftClose, PanelLeft, ChevronDown } from "lucide-react"
import { cn } from "@/lib/utils"
import { useUser } from "@/components/user-provider"
import { useNavStyle } from "@/components/nav-style-provider"
import UserAvatar from "@/components/user-avatar"
import { useState, useRef, useEffect } from "react"

const navigation = [
  { name: "Dashboard", href: "/", icon: LayoutDashboard },
  { name: "Projects", href: "/projects", icon: FolderKanban },
  { name: "Tasks", href: "/tasks", icon: CheckSquare },
  { name: "Team", href: "/team", icon: Users },
  { name: "Reports", href: "/reports", icon: BarChart3 },
]

export function Sidebar() {
  const pathname = usePathname()
  const { profile, user, impersonation, signOut } = useUser()
  const { mobileMenuOpen, setMobileMenuOpen, sidebarCollapsed, setSidebarCollapsed } = useNavStyle()
  const [userMenuOpen, setUserMenuOpen] = useState(false)
  const userMenuRef = useRef<HTMLDivElement>(null)

  const handleSignOut = async () => {
    await signOut()
  }

  const toggleCollapse = () => {
    setSidebarCollapsed(!sidebarCollapsed)
  }

  // Close user menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (userMenuRef.current && !userMenuRef.current.contains(event.target as Node)) {
        setUserMenuOpen(false)
      }
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [])

  const avatarUser = impersonation ? null : user
  const displayEmail = profile?.email || user?.email || ""
  const displayName = profile?.full_name || displayEmail.split("@")[0] || "User"

  return (
    <>
      {/* Mobile overlay */}
      {mobileMenuOpen && (
        <div
          role="presentation"
          aria-hidden="true"
          className="fixed inset-0 z-40 bg-black/50 lg:hidden"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}

      {/* Sidebar */}
      <div
        role="navigation"
        aria-label="Main navigation"
        className={cn(
          "fixed lg:relative inset-y-0 left-0 z-40 flex flex-col border-r bg-card sidebar-transition",
          sidebarCollapsed ? "w-16" : "w-64",
          mobileMenuOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
        )}
        aria-hidden={!mobileMenuOpen && typeof window !== "undefined" && window.innerWidth < 1024}
      >
        {/* Header with collapse button */}
        <div className={cn(
          "flex h-16 items-center border-b border-border pt-2 lg:pt-0",
          sidebarCollapsed ? "justify-center px-0" : "justify-between px-2"
        )}>
          {/* Logo - show when expanded, hide when collapsed */}
          {!sidebarCollapsed && (
            <div className="flex items-center gap-2 min-w-0 pl-2">
              <div
                className="h-3 w-3 rounded-sm bg-primary shadow-[0_0_15px_hsl(var(--accent))] shrink-0"
                aria-hidden="true"
              />
              <span className="text-lg font-bold truncate">ProjectHub</span>
            </div>
          )}
          
          {/* Right side controls */}
          <div className={cn(
            "flex items-center gap-1 shrink-0",
            sidebarCollapsed ? "" : "pr-2"
          )}>
            {/* Collapse/Expand button - show on xl+ (when collapse is available) */}
            <button
              onClick={toggleCollapse}
              className={cn(
                "p-1.5 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary",
                sidebarCollapsed ? "flex" : "hidden xl:flex"
              )}
              title={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
              aria-label={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
            >
              {sidebarCollapsed ? <PanelLeft className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
            </button>
            
            {/* Mobile close button */}
            <button
              onClick={() => setMobileMenuOpen(false)}
              className="p-1.5 rounded-lg lg:hidden focus:outline-none focus:ring-2 focus:ring-primary"
              aria-label="Close sidebar"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 space-y-1 px-2 py-4" aria-label="Primary">
          {navigation.map((item) => {
            const isActive = pathname === item.href
            return (
              <Link
                key={item.name}
                href={item.href}
                onClick={() => setMobileMenuOpen(false)}
                className={cn(
                  "flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-medium transition-all",
                  isActive
                    ? "bg-primary/10 text-primary"
                    : "text-muted-foreground hover:bg-accent/50 hover:text-accent-foreground",
                  sidebarCollapsed && "justify-center px-2"
                )}
                aria-current={isActive ? "page" : undefined}
                title={sidebarCollapsed ? item.name : undefined}
              >
                <item.icon className="h-5 w-5 shrink-0" aria-hidden="true" />
                {!sidebarCollapsed && <span>{item.name}</span>}
              </Link>
            )
          })}
        </nav>

        {/* Settings & User at bottom */}
        <div className="border-t border-border p-2">
          <Link
            href="/settings"
            onClick={() => setMobileMenuOpen(false)}
            className={cn(
              "flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-medium transition-all",
              pathname === "/settings"
                ? "bg-primary/10 text-primary"
                : "text-muted-foreground hover:bg-accent/50 hover:text-accent-foreground",
              sidebarCollapsed && "justify-center px-2"
            )}
            title={sidebarCollapsed ? "Settings" : undefined}
          >
            <Settings className="h-5 w-5 shrink-0" />
            {!sidebarCollapsed && <span>Settings</span>}
          </Link>
          
          {/* User with dropdown menu */}
          <div className="relative mt-1" ref={userMenuRef}>
            <button
              onClick={() => setUserMenuOpen(!userMenuOpen)}
              className={cn(
                "flex items-center gap-2 w-full rounded-xl px-2 py-2 text-sm font-medium transition-all",
                "text-muted-foreground hover:bg-accent/50 hover:text-accent-foreground",
                sidebarCollapsed ? "justify-center" : "justify-start"
              )}
              title={sidebarCollapsed ? displayName : undefined}
            >
              <UserAvatar profile={profile} user={avatarUser} sizeClass="h-8 w-8" textClass="text-xs" />
              {!sidebarCollapsed && (
                <>
                  <div className="flex-1 overflow-hidden min-w-0 text-left">
                    <p className="truncate text-sm font-medium">{displayName}</p>
                    <p className="truncate text-xs text-muted-foreground capitalize">{profile?.role || "viewer"}</p>
                  </div>
                  <ChevronDown className={cn("h-4 w-4 shrink-0 transition-transform", userMenuOpen && "rotate-180")} />
                </>
              )}
              {sidebarCollapsed && <ChevronDown className={cn("h-3 w-3 shrink-0 absolute -bottom-0.5 -right-0.5", userMenuOpen && "rotate-180")} />}
            </button>
            
            {/* Dropdown menu */}
            {userMenuOpen && (
              <div className={cn(
                "absolute z-50 rounded-lg border border-border bg-card shadow-xl",
                sidebarCollapsed ? "left-full top-0 ml-2 w-48" : "bottom-full left-0 mb-2 w-full"
              )}>
                <div className={sidebarCollapsed ? "p-2 space-y-1" : "p-2 space-y-1"}>
                  <button
                    onClick={handleSignOut}
                    className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm text-destructive hover:bg-destructive/10"
                  >
                    <LogOut className="h-4 w-4" />
                    Sign out
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  )
}
