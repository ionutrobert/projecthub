"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { LayoutDashboard, FolderKanban, Settings, Users, BarChart3, LogOut } from "lucide-react"
import { cn } from "@/lib/utils"
import { useUser } from "@/components/user-provider"
import { createClient } from "@/lib/supabase"

const navigation = [
  { name: "Dashboard", href: "/", icon: LayoutDashboard },
  { name: "Projects", href: "/projects", icon: FolderKanban },
  { name: "Team", href: "/team", icon: Users },
  { name: "Reports", href: "/reports", icon: BarChart3 },
]

export function Sidebar() {
  const pathname = usePathname()
  const { profile, user } = useUser()
  const supabase = createClient()

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    window.location.href = "/auth/login"
  }

  return (
    <div className="flex w-64 flex-col border-r bg-card">
      {/* Logo */}
      <div className="flex h-16 items-center gap-3 border-b border-border px-6">
        <div className="h-3 w-3 rounded-sm bg-primary shadow-[0_0_15px_hsl(var(--primary))]" />
        <span className="text-lg font-bold">ProjectHub</span>
      </div>

      {/* Navigation */}
      <nav className="flex-1 space-y-1 px-3 py-4">
        {navigation.map((item) => {
          const isActive = pathname === item.href
          return (
            <Link
              key={item.name}
              href={item.href}
              className={cn(
                "flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium transition-all",
                isActive
                  ? "bg-primary/10 text-primary"
                  : "text-muted-foreground hover:bg-accent/50 hover:text-accent-foreground"
              )}
            >
              <item.icon className="h-5 w-5" />
              {item.name}
            </Link>
          )
        })}
      </nav>

      {/* Settings & User at bottom */}
      <div className="border-t border-border p-3">
        <Link
          href="/settings"
          className="flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium text-muted-foreground transition-all hover:bg-accent/50 hover:text-accent-foreground"
        >
          <Settings className="h-5 w-5" />
          Settings
        </Link>
        
        {/* User */}
        <div className="flex items-center gap-3 p-3 mt-1">
          <div 
            className="h-9 w-9 rounded-full flex items-center justify-center text-sm font-medium"
            style={{ backgroundColor: `${profile?.role === 'admin' ? '#8B5CF6' : '#10B981'}20`, color: profile?.role === 'admin' ? '#8B5CF6' : '#10B981' }}
          >
            {user?.email?.charAt(0).toUpperCase() || "U"}
          </div>
          <div className="flex-1 overflow-hidden">
            <p className="truncate text-sm font-medium">{profile?.full_name || user?.email?.split('@')[0] || "User"}</p>
            <p className="truncate text-xs text-muted-foreground capitalize">{profile?.role || "viewer"}</p>
          </div>
          <button
            onClick={handleSignOut}
            className="p-2 rounded-lg text-muted-foreground hover:bg-accent/50 hover:text-accent-foreground"
            title="Sign out"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  )
}
