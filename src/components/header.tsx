"use client"

import { useState, useRef, useEffect } from "react"
import Link from "next/link"
import { useRouter, usePathname } from "next/navigation"
import { useTheme } from "@/components/theme-provider"
import { useNavStyle } from "@/components/nav-style-provider"
import { useUser } from "@/components/user-provider"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { TopNav } from "@/components/top-nav"
import UserAvatar from "@/components/user-avatar"
import { Search, Bell, Moon, Sun, Settings, LogOut, Menu, X, CalendarDays } from "lucide-react"
import { cn } from "@/lib/utils"

const navigation = [
  { name: "Dashboard", href: "/", icon: null },
  { name: "Projects", href: "/projects", icon: null },
  { name: "Tasks", href: "/tasks", icon: null },
  { name: "Team", href: "/team", icon: null },
  { name: "Reports", href: "/reports", icon: null },
]

type ProjectDeadline = {
  id: string
  name: string
  deadline: string | null
  status?: string | null
}

type SearchResult = {
  id: string
  type: "project" | "task" | "person" | "client"
  title: string
  subtitle?: string
  href: string
}

function formatDeadlineLabel(deadline: string | null) {
  if (!deadline) return "No deadline"
  const date = new Date(deadline)
  if (Number.isNaN(date.getTime())) return "No deadline"

  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const due = new Date(date)
  due.setHours(0, 0, 0, 0)
  const diffDays = Math.round((due.getTime() - today.getTime()) / 86400000)

  if (diffDays < 0) return `Overdue by ${Math.abs(diffDays)}d`
  if (diffDays === 0) return "Due today"
  if (diffDays === 1) return "Due tomorrow"
  return `Due in ${diffDays}d`
}

function getDeadlineTone(deadline: string | null) {
  if (!deadline) return "bg-muted text-muted-foreground"
  const date = new Date(deadline)
  if (Number.isNaN(date.getTime())) return "bg-muted text-muted-foreground"

  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const due = new Date(date)
  due.setHours(0, 0, 0, 0)
  const diffDays = Math.round((due.getTime() - today.getTime()) / 86400000)

  if (diffDays < 0) return "bg-red-500/15 text-red-600 dark:text-red-400"
  if (diffDays <= 2) return "bg-amber-500/15 text-amber-700 dark:text-amber-400"
  return "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400"
}

export function Header() {
  const { theme, setTheme } = useTheme()
  const { navStyle, mobileMenuOpen, toggleMobileMenu, sidebarCollapsed, setSidebarCollapsed } = useNavStyle()
  const { user, profile, impersonation, loading, signOut } = useUser()
  const router = useRouter()
  const pathname = usePathname()

  const [searchExpanded, setSearchExpanded] = useState(false)
  const [searchQuery, setSearchQuery] = useState("")
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState("")
  const [searchResults, setSearchResults] = useState<SearchResult[]>([])
  const [searchLoading, setSearchLoading] = useState(false)
  const [navDropdownOpen, setNavDropdownOpen] = useState(false)
  const [upcomingDeadlines, setUpcomingDeadlines] = useState<ProjectDeadline[]>([])
  const [deadlinesLoading, setDeadlinesLoading] = useState(true)
  const searchInputRef = useRef<HTMLInputElement>(null)
  const navDropdownRef = useRef<HTMLDivElement>(null)

  const toggleTheme = () => {
    setTheme(theme === "dark" ? "light" : "dark")
  }

  const handleSignOut = async () => {
    await signOut()
    router.push("/auth/login")
  }

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    if (searchQuery.trim()) {
      router.push(`/projects?q=${encodeURIComponent(searchQuery)}`)
      setSearchExpanded(false)
      setSearchQuery("")
      setSearchResults([])
    }
  }

  const goToSearchResult = (result: SearchResult) => {
    router.push(result.href)
    setSearchExpanded(false)
    setSearchQuery("")
    setDebouncedSearchQuery("")
    setSearchResults([])
  }

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (navDropdownRef.current && !navDropdownRef.current.contains(e.target as Node)) {
        setNavDropdownOpen(false)
      }
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [])

  useEffect(() => {
    if (searchExpanded && searchInputRef.current) {
      searchInputRef.current.focus()
    }
  }, [searchExpanded])

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchQuery(searchQuery.trim())
    }, 250)
    return () => clearTimeout(timer)
  }, [searchQuery])

  useEffect(() => {
    if (!searchExpanded || debouncedSearchQuery.length < 2) {
      setSearchResults([])
      setSearchLoading(false)
      return
    }

    let cancelled = false

    const loadSearchResults = async () => {
      setSearchLoading(true)
      const q = debouncedSearchQuery
      const qLower = q.toLowerCase()

      try {
        const [projectsRes, tasksRes, membersRes, clientsRes] = await Promise.all([
          fetch(`/api/projects?q=${encodeURIComponent(q)}`, { cache: "no-store" }),
          fetch(`/api/tasks?q=${encodeURIComponent(q)}`, { cache: "no-store" }),
          fetch("/api/members", { cache: "no-store" }),
          fetch("/api/clients", { cache: "no-store" }),
        ])

        const [projects, tasks, members, clients] = await Promise.all([
          projectsRes.json().catch(() => []),
          tasksRes.json().catch(() => []),
          membersRes.json().catch(() => []),
          clientsRes.json().catch(() => []),
        ])

        if (cancelled) return

        const projectResults: SearchResult[] = Array.isArray(projects)
          ? projects.slice(0, 4).map((project: { id: string; name: string; client_name?: string | null }) => ({
              id: `project-${project.id}`,
              type: "project",
              title: project.name,
              subtitle: project.client_name || "Internal project",
              href: `/projects/${project.id}`,
            }))
          : []

        const taskResults: SearchResult[] = Array.isArray(tasks)
          ? tasks.slice(0, 4).map((task: { id: string; title: string }) => ({
              id: `task-${task.id}`,
              type: "task",
              title: task.title,
              subtitle: "Open in task workspace",
              href: `/tasks?taskId=${task.id}`,
            }))
          : []

        const memberResults: SearchResult[] = Array.isArray(members)
          ? members
              .filter((member: { name?: string; email?: string | null }) => {
                const name = (member.name || "").toLowerCase()
                const email = (member.email || "").toLowerCase()
                return name.includes(qLower) || email.includes(qLower)
              })
              .slice(0, 3)
              .map((member: { id: string; name: string; email?: string | null }) => ({
                id: `person-${member.id}`,
                type: "person",
                title: member.name,
                subtitle: member.email || "Team member",
                href: "/team",
              }))
          : []

        const clientResults: SearchResult[] = Array.isArray(clients)
          ? clients
              .filter((client: { name?: string; company?: string | null }) => {
                const name = (client.name || "").toLowerCase()
                const company = (client.company || "").toLowerCase()
                return name.includes(qLower) || company.includes(qLower)
              })
              .slice(0, 3)
              .map((client: { id: string; name: string; company?: string | null }) => ({
                id: `client-${client.id}`,
                type: "client",
                title: client.name,
                subtitle: client.company || "Client",
                href: `/projects?q=${encodeURIComponent(client.name)}`,
              }))
          : []

        setSearchResults([...projectResults, ...taskResults, ...memberResults, ...clientResults])
      } catch {
        if (!cancelled) {
          setSearchResults([])
        }
      } finally {
        if (!cancelled) {
          setSearchLoading(false)
        }
      }
    }

    void loadSearchResults()

    return () => {
      cancelled = true
    }
  }, [debouncedSearchQuery, searchExpanded])

  useEffect(() => {
    let cancelled = false

    const loadDeadlines = async () => {
      try {
        const response = await fetch("/api/projects", { cache: "no-store" })
        const data = (await response.json().catch(() => [])) as ProjectDeadline[]
        if (!response.ok || !Array.isArray(data)) {
          if (!cancelled) {
            setUpcomingDeadlines([])
            setDeadlinesLoading(false)
          }
          return
        }

        const filtered = data
          .filter((project) => Boolean(project.deadline))
          .filter((project) => {
            const status = (project.status || "").toLowerCase()
            return status !== "completed" && status !== "closed"
          })
          .sort((a, b) => {
            const aTime = a.deadline ? new Date(a.deadline).getTime() : Number.POSITIVE_INFINITY
            const bTime = b.deadline ? new Date(b.deadline).getTime() : Number.POSITIVE_INFINITY
            return aTime - bTime
          })
          .slice(0, 6)

        if (!cancelled) {
          setUpcomingDeadlines(filtered)
          setDeadlinesLoading(false)
        }
      } catch {
        if (!cancelled) {
          setUpcomingDeadlines([])
          setDeadlinesLoading(false)
        }
      }
    }

    void loadDeadlines()
    return () => {
      cancelled = true
    }
  }, [])

  const avatarUser = impersonation ? null : user
  const displayEmail = profile?.email || user?.email || ""
  const displayName = profile?.full_name || displayEmail.split("@")[0] || "User"

  return (
    <header
      role="banner"
      className="flex h-16 flex-col border-b border-border bg-card/80 backdrop-blur-xl relative z-50"
    >
      <div className="flex h-full items-center justify-between gap-3 px-4 md:px-6">
        {/* Mobile menu button - shown when sidebar mode */}
        {navStyle === "sidebar" && (
          <button
            onClick={toggleMobileMenu}
            className="p-2 rounded-lg border border-border bg-background/50 lg:hidden shrink-0 focus:outline-none focus:ring-2 focus:ring-primary"
            aria-label={mobileMenuOpen ? "Close sidebar" : "Open sidebar"}
            aria-expanded={mobileMenuOpen}
            aria-controls="sidebar-navigation"
          >
            {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        )}

        {/* Logo - shown when: not sidebar mode on desktop, OR sidebar mode with collapsed sidebar on lg+ */}
        <div className={`flex items-center gap-2 shrink-0 ${navStyle === "sidebar" && !sidebarCollapsed ? "lg:hidden" : ""}`}>
          <div
            className="h-3 w-3 rounded-sm bg-primary shadow-[0_0_15px_hsl(var(--accent))]"
            aria-hidden="true"
          />
          <span className="text-lg font-bold tracking-tight">ProjectHub</span>
        </div>

        {/* Spacer */}
        <div className="flex-1" />

        {/* Top Navigation - only show when top nav mode on desktop */}
        {navStyle === "top" && <TopNav />}

        {/* Right side - Search, Notifications, Theme, User */}
        <div className="flex items-center gap-2 md:gap-3 shrink-0">
          {/* Expandable search button - on left for mobile */}
          <div className="relative">
            {searchExpanded ? (
              <form onSubmit={handleSearch} className="flex items-center" role="search">
                <label htmlFor="header-search-input" className="sr-only">Search projects</label>
                <input
                  id="header-search-input"
                  ref={searchInputRef}
                  type="search"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search projects..."
                  className="h-9 w-40 sm:w-48 rounded-lg border border-input bg-background pl-3 pr-8 text-sm animate-in fade-in slide-in-from-right-2 focus:outline-none focus:ring-2 focus:ring-primary"
                />
                <button
                  type="button"
                  onClick={() => {
                    setSearchExpanded(false)
                    setSearchQuery("")
                    setDebouncedSearchQuery("")
                    setSearchResults([])
                  }}
                  className="absolute right-1 p-1.5 rounded-md text-muted-foreground hover:text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                  aria-label="Close search"
                >
                  <X className="h-4 w-4" />
                </button>
              </form>
            ) : (
              <button
                onClick={() => setSearchExpanded(true)}
                className="p-2 rounded-lg border border-border bg-background/50 hover:bg-accent/50 transition-colors focus:outline-none focus:ring-2 focus:ring-primary"
                aria-label="Open search"
                aria-expanded={false}
              >
                <Search className="h-5 w-5" aria-hidden="true" />
              </button>
            )}

            {searchExpanded && debouncedSearchQuery.length >= 2 && (
              <div className="absolute right-0 top-full mt-2 w-80 rounded-lg border border-border bg-card p-2 shadow-xl">
                {searchLoading ? (
                  <p className="px-2 py-2 text-xs text-muted-foreground">Searching...</p>
                ) : searchResults.length === 0 ? (
                  <p className="px-2 py-2 text-xs text-muted-foreground">No matches found.</p>
                ) : (
                  <div className="space-y-1">
                    {searchResults.map((result) => (
                      <button
                        key={result.id}
                        type="button"
                        onClick={() => goToSearchResult(result)}
                        className="flex w-full items-start justify-between rounded-md px-2 py-2 text-left hover:bg-accent/60"
                      >
                        <span className="min-w-0">
                          <span className="block truncate text-sm font-medium">{result.title}</span>
                          {result.subtitle && (
                            <span className="block truncate text-xs text-muted-foreground">{result.subtitle}</span>
                          )}
                        </span>
                        <span className="ml-2 shrink-0 rounded-full border border-border px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-muted-foreground">
                          {result.type}
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Mobile navigation dropdown - on right for top nav mode on tablet/mobile */}
          {navStyle === "top" && (
            <div className="relative lg:hidden" ref={navDropdownRef}>
              <button
                onClick={() => setNavDropdownOpen(!navDropdownOpen)}
                className="flex items-center gap-1 px-3 py-2 rounded-lg border border-border bg-background/50 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                aria-label="Open navigation menu"
                aria-expanded={navDropdownOpen}
                aria-haspopup="true"
              >
                <Menu className="h-4 w-4" aria-hidden="true" />
              </button>

              {navDropdownOpen && (
                <div className="absolute right-0 top-full mt-2 w-64 rounded-lg border border-border bg-card shadow-xl z-[100]">
                  <nav className="py-2">
                    {navigation.map((item) => {
                      const isActive = pathname === item.href
                      return (
                        <Link
                          key={item.name}
                          href={item.href}
                          onClick={() => setNavDropdownOpen(false)}
                          className={cn(
                            "flex items-center gap-2 px-4 py-2 text-sm transition-colors",
                            isActive
                              ? "bg-primary/10 text-primary"
                              : "text-muted-foreground hover:bg-accent/50"
                          )}
                        >
                          {item.name}
                        </Link>
                      )
                    })}
                    <div className="my-2 border-t border-border" />
                    <Link
                      href="/settings"
                      onClick={() => setNavDropdownOpen(false)}
                      className="flex items-center gap-2 px-4 py-2 text-sm text-muted-foreground hover:bg-accent/50"
                    >
                      <Settings className="h-4 w-4" />
                      Settings
                    </Link>
                    {user && (
                      <>
                         <div className="flex items-center gap-3 px-4 py-3 mt-2 border-t border-border">
                            <UserAvatar
                              profile={profile}
                              user={avatarUser}
                              sizeClass="h-9 w-9"
                              textClass="text-sm"
                            />
                           <div className="flex-1 min-w-0">
                             <p className="text-sm font-medium truncate">{displayName}</p>
                             <p className="text-xs text-muted-foreground truncate">{displayEmail}</p>
                           </div>
                        </div>
                        <button
                          onClick={() => {
                            handleSignOut()
                            setNavDropdownOpen(false)
                          }}
                          className="flex items-center gap-2 w-full px-4 py-2 text-sm text-muted-foreground hover:bg-accent/50"
                        >
                          <LogOut className="h-4 w-4" />
                          Sign Out
                        </button>
                      </>
                    )}
                  </nav>
                </div>
              )}
            </div>
          )}

          {/* Collapsed menu for sidebar mode on tablet (between lg and xl) - only when sidebar NOT collapsed */}
          {navStyle === "sidebar" && !sidebarCollapsed && (
            <div className="hidden lg:flex xl:hidden relative" ref={navDropdownRef}>
              <button
                onClick={() => setNavDropdownOpen(!navDropdownOpen)}
                className="p-2 rounded-lg border border-border bg-background/50"
              >
                <Menu className="h-5 w-5" />
              </button>

              {navDropdownOpen && (
                <div className="absolute right-0 top-full mt-2 w-48 rounded-lg border border-border bg-card shadow-xl z-[100]">
                  <nav className="py-2">
                    {navigation.map((item) => {
                      const isActive = pathname === item.href
                      return (
                        <Link
                          key={item.name}
                          href={item.href}
                          onClick={() => setNavDropdownOpen(false)}
                          className={cn(
                            "flex items-center gap-2 px-4 py-2 text-sm transition-colors",
                            isActive
                              ? "bg-primary/10 text-primary"
                              : "text-muted-foreground hover:bg-accent/50"
                          )}
                        >
                          {item.name}
                        </Link>
                      )
                    })}
                    <Link
                      href="/settings"
                      onClick={() => setNavDropdownOpen(false)}
                      className="flex items-center gap-2 px-4 py-2 text-sm text-muted-foreground hover:bg-accent/50"
                    >
                      <Settings className="h-4 w-4" />
                      Settings
                    </Link>
                    {user && (
                      <>
                        <div className="my-2 border-t border-border" />
                        <button
                          onClick={() => {
                            handleSignOut()
                            setNavDropdownOpen(false)
                          }}
                          className="flex items-center gap-2 w-full px-4 py-2 text-sm text-muted-foreground hover:bg-accent/50"
                        >
                          <LogOut className="h-4 w-4" />
                          Sign Out
                        </button>
                      </>
                    )}
                  </nav>
                </div>
              )}
            </div>
          )}

          {/* Notifications - hidden on small screens */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="relative shrink-0 hidden md:flex tooltip" data-tooltip="Notifications">
                <Bell className="h-5 w-5" />
                {upcomingDeadlines.length > 0 && (
                  <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-destructive" />
                )}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-80">
              <DropdownMenuLabel className="flex items-center gap-2">
                <CalendarDays className="h-4 w-4" />
                Upcoming deadlines
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              {deadlinesLoading ? (
                <div className="px-2 py-3 text-sm text-muted-foreground">Loading...</div>
              ) : upcomingDeadlines.length === 0 ? (
                <div className="px-2 py-3 text-sm text-muted-foreground">No active project deadlines right now.</div>
              ) : (
                upcomingDeadlines.map((project) => (
                  <DropdownMenuItem
                    key={project.id}
                    onSelect={() => router.push(`/projects/${project.id}`)}
                    className="flex items-start justify-between gap-3"
                  >
                    <span className="line-clamp-2 text-sm">{project.name}</span>
                    <span
                      className={cn(
                        "shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium",
                        getDeadlineTone(project.deadline)
                      )}
                    >
                      {formatDeadlineLabel(project.deadline)}
                    </span>
                  </DropdownMenuItem>
                ))
              )}
            </DropdownMenuContent>
          </DropdownMenu>
          
          {/* Dark mode toggle - hidden on mobile */}
          <Button variant="ghost" size="icon" onClick={toggleTheme} className="hidden md:flex shrink-0 tooltip" data-tooltip="Toggle theme">
            {theme === "dark" ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
          </Button>

          {/* Settings - only show when top nav mode and on desktop */}
          {navStyle === "top" && (
            <Link href="/settings">
              <Button variant="ghost" size="icon" className="hidden md:flex shrink-0 tooltip" data-tooltip="Settings">
                <Settings className="h-5 w-5" />
              </Button>
            </Link>
          )}

          {/* User - only show when top nav mode */}
          {loading ? (
            <div className="h-8 w-24 rounded-md bg-muted animate-pulse hidden md:block" />
          ) : user && navStyle === "top" ? (
              <div className="hidden md:flex items-center gap-2 pl-2 md:pl-3 border-l border-border shrink-0">
                <UserAvatar profile={profile} user={avatarUser} sizeClass="h-8 w-8" textClass="text-sm" />
                <div className="overflow-hidden">
                  <p className="text-sm font-medium truncate max-w-[100px] md:max-w-[150px]">{displayName}</p>
                  <p className="text-xs text-muted-foreground truncate max-w-[100px] md:max-w-[150px]">{displayEmail}</p>
                </div>
                <Button variant="ghost" size="icon" onClick={handleSignOut} className="shrink-0 tooltip" data-tooltip="Sign out">
                  <LogOut className="h-4 w-4" />
                </Button>
              </div>
          ) : null}
        </div>
      </div>
    </header>
  )
}
