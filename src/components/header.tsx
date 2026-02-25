"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { useTheme } from "@/components/theme-provider"
import { useNavStyle } from "@/components/nav-style-provider"
import { useUser } from "@/components/user-provider"
import { Button } from "@/components/ui/button"
import { TopNav } from "@/components/top-nav"
import { Search, Bell, Moon, Sun, Settings, LogOut } from "lucide-react"

export function Header() {
  const { theme, setTheme } = useTheme()
  const { navStyle } = useNavStyle()
  const { user, profile, signOut } = useUser()
  const router = useRouter()

  const toggleTheme = () => {
    setTheme(theme === "dark" ? "light" : "dark")
  }

  const handleSignOut = async () => {
    await signOut()
    router.push("/auth/login")
  }

  return (
    <header className="flex h-16 flex-col border-b border-border bg-card/80 backdrop-blur-xl">
      <div className="flex h-full items-center justify-between px-6">
        {/* Logo - hidden when sidebar mode */}
        {navStyle === "top" && (
          <div className="flex items-center gap-3">
            <Link href="/" className="flex items-center gap-2">
              <div className="h-3 w-3 rounded-sm bg-primary shadow-[0_0_15px_hsl(var(--primary))]" />
              <span className="text-lg font-bold tracking-tight">ProjectHub</span>
            </Link>
          </div>
        )}

        {/* Spacer when sidebar mode */}
        {navStyle === "sidebar" && <div />}

        {/* Top Navigation - only show when top nav mode */}
        {navStyle === "top" && <TopNav />}

        {/* Right side - Search, Notifications, Theme, User */}
        <div className="flex items-center gap-3">
          <div className="relative hidden md:block">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search..."
              className="h-9 w-48 rounded-md border border-input bg-background/50 pl-10 pr-4 text-sm"
            />
          </div>

          <Button variant="ghost" size="icon" className="relative">
            <Bell className="h-5 w-5" />
            <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-destructive" />
          </Button>
          
          <Button variant="ghost" size="icon" onClick={toggleTheme}>
            {theme === "dark" ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
          </Button>

          {/* Settings - only show when top nav mode */}
          {navStyle === "top" && (
            <Link href="/settings">
              <Button variant="ghost" size="icon">
                <Settings className="h-5 w-5" />
              </Button>
            </Link>
          )}

        {/* User - only show when top nav mode */}
        {user && navStyle === "top" ? (
            <div className="flex items-center gap-2 ml-2 pl-3 border-l border-border">
              <div className="h-8 w-8 rounded-full bg-primary/20 flex items-center justify-center">
                <span className="text-sm font-medium">
                  {profile?.full_name?.[0] || user.email?.[0] || "U"}
                </span>
              </div>
              <div className="hidden lg:block">
                <p className="text-sm font-medium">{profile?.full_name || "User"}</p>
                <p className="text-xs text-muted-foreground">{user.email}</p>
              </div>
              <Button variant="ghost" size="icon" onClick={handleSignOut}>
                <LogOut className="h-4 w-4" />
              </Button>
            </div>
          ) : !user && navStyle === "top" ? (
            <Link href="/auth/login">
              <Button variant="outline" size="sm">Sign In</Button>
            </Link>
          ) : null}
        </div>
      </div>
    </header>
  )
}
