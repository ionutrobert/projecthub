"use client"

import { useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { ArrowLeft, ChevronDown, ChevronUp, Save } from "lucide-react"

import MemberAvatar from "@/components/member-avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

type Member = {
  id: string
  user_id?: string | null
  avatar_url?: string | null
  name: string
  email: string | null
  role: string
}

type Project = {
  id: string
  name: string
  status: string
  project_members?: Array<{
    members?:
      | {
          id?: string
        }
      | Array<{
          id?: string
        }>
      | null
  }>
}

type Task = {
  id: string
  title: string
  project_id: string
  assignee_member_id: string | null
  status: "todo" | "in-progress" | "done"
  due_date: string | null
}

type AuthActivityEvent = {
  id: string
  event_type: "login_success" | "logout" | "session_check"
  created_at: string
  country: string | null
  city: string | null
  user_agent: string | null
}

const ROLE_OPTIONS = ["admin", "member", "viewer", "developer", "designer", "pm", "accountant"]

type TeamMemberProfileClientProps = {
  initialMember: Member | null
  initialProjects: Project[]
  initialTasks: Task[]
  initialAuthEvents: AuthActivityEvent[]
  initialHasLoggedIn: boolean
  initialLastLoginAt: string | null
  initialAuthActivityMissingTable: boolean
  initialError: string | null
  isAdmin: boolean
}

export default function TeamMemberProfileClient({
  initialMember,
  initialProjects,
  initialTasks,
  initialAuthEvents,
  initialHasLoggedIn,
  initialLastLoginAt,
  initialAuthActivityMissingTable,
  initialError,
  isAdmin,
}: TeamMemberProfileClientProps) {
  const router = useRouter()

  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(initialError)
  const [member, setMember] = useState<Member | null>(initialMember)
  const [projects] = useState<Project[]>(initialProjects)
  const [tasks] = useState<Task[]>(initialTasks)
  const [authEvents] = useState<AuthActivityEvent[]>(initialAuthEvents)
  const [hasLoggedIn] = useState(initialHasLoggedIn)
  const [lastLoginAt] = useState<string | null>(initialLastLoginAt)
  const [authActivityMissingTable] = useState(initialAuthActivityMissingTable)
  const [authHistoryOpen, setAuthHistoryOpen] = useState(false)

  const [editName, setEditName] = useState(initialMember?.name || "")
  const [editEmail, setEditEmail] = useState(initialMember?.email || "")
  const [editRole, setEditRole] = useState(initialMember?.role || "viewer")

  const assignedProjects = useMemo(() => {
    if (!member) return []
    return projects.filter((project) =>
      (project.project_members || []).some((pm) => {
        if (Array.isArray(pm.members)) {
          return pm.members.some((nested) => nested?.id === member.id)
        }

        return pm.members?.id === member.id
      })
    )
  }, [member, projects])

  const assignedTasks = useMemo(() => {
    if (!member) return []
    return tasks.filter((task) => task.assignee_member_id === member.id)
  }, [member, tasks])

  const saveProfile = async () => {
    if (!member || !isAdmin || !editName.trim()) return
    setSaving(true)
    setError(null)
    try {
      const response = await fetch(`/api/members/${member.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: editName.trim(),
          email: editEmail.trim() || null,
          role: editRole,
        }),
      })
      const data = await response.json().catch(() => null)
      if (!response.ok || !data) {
        throw new Error(data?.error || "Failed to save member profile")
      }
      setMember(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save member profile")
    } finally {
      setSaving(false)
    }
  }

  if (!member) {
    return (
      <Card>
        <CardContent className="py-10 text-center text-muted-foreground">
          {error || "Member not found"}
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Button variant="outline" onClick={() => router.push("/team")}>
          <ArrowLeft className="mr-2 h-4 w-4" /> Back to Team
        </Button>
        {isAdmin && (
          <Button onClick={saveProfile} disabled={saving || !editName.trim()}>
            <Save className="mr-2 h-4 w-4" /> {saving ? "Saving..." : "Save profile"}
          </Button>
        )}
      </div>

      {error && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
          {error}
        </div>
      )}

      <Card className="glass">
        <CardHeader>
          <CardTitle className="flex items-center gap-3">
            <MemberAvatar
              name={member.name}
              email={member.email}
              userId={member.user_id || null}
              avatarUrl={member.avatar_url || null}
              sizeClass="h-10 w-10"
              textClass="text-sm"
            />
            <span>Member Profile</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-3">
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Name</label>
            <input
              value={editName}
              disabled={!isAdmin}
              onChange={(event) => setEditName(event.target.value)}
              className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm disabled:opacity-70"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Email</label>
            <input
              value={editEmail}
              disabled={!isAdmin}
              onChange={(event) => setEditEmail(event.target.value)}
              className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm disabled:opacity-70"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Role</label>
            <select
              value={editRole}
              disabled={!isAdmin}
              onChange={(event) => setEditRole(event.target.value)}
              className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm capitalize disabled:opacity-70"
            >
              {ROLE_OPTIONS.map((role) => (
                <option key={role} value={role}>
                  {role}
                </option>
              ))}
            </select>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Assigned projects</p>
            <p className="text-2xl font-semibold">{assignedProjects.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Assigned tasks</p>
            <p className="text-2xl font-semibold">{assignedTasks.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Last login</p>
            <p className="text-sm font-semibold">
              {isAdmin
                ? hasLoggedIn
                  ? lastLoginAt
                    ? new Date(lastLoginAt).toLocaleString()
                    : "Yes"
                  : "Never logged in"
                : "Admin only"}
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="glass">
          <CardHeader>
            <CardTitle className="text-base">Projects</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {assignedProjects.length === 0 ? (
              <p className="text-sm text-muted-foreground">No assigned projects.</p>
            ) : (
              assignedProjects.map((project) => (
                <div key={project.id} className="flex items-center justify-between rounded-md border border-border/70 px-3 py-2">
                  <p className="text-sm font-medium">{project.name}</p>
                  <Badge variant="outline" className="capitalize">
                    {project.status}
                  </Badge>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <Card className="glass">
          <CardHeader>
            <CardTitle className="text-base">Tasks</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {assignedTasks.length === 0 ? (
              <p className="text-sm text-muted-foreground">No assigned tasks.</p>
            ) : (
              assignedTasks.slice(0, 8).map((task) => (
                <div key={task.id} className="rounded-md border border-border/70 px-3 py-2">
                  <p className="text-sm font-medium">{task.title}</p>
                  <p className="text-xs text-muted-foreground">
                    Status: <span className="capitalize">{task.status}</span>
                    {task.due_date ? ` • Due ${task.due_date}` : ""}
                  </p>
                </div>
              ))
            )}
            {assignedTasks.length > 8 && (
              <p className="text-xs text-muted-foreground">Showing 8 of {assignedTasks.length} tasks.</p>
            )}
          </CardContent>
        </Card>
      </div>

      {isAdmin && (
        <Card className="glass">
          <CardHeader className="flex flex-row items-center justify-between gap-3 space-y-0">
            <CardTitle className="text-base">Sign-in history</CardTitle>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setAuthHistoryOpen((prev) => !prev)}
              aria-expanded={authHistoryOpen}
            >
              {authHistoryOpen ? (
                <>
                  Collapse <ChevronUp className="ml-2 h-4 w-4" />
                </>
              ) : (
                <>
                  Expand <ChevronDown className="ml-2 h-4 w-4" />
                </>
              )}
            </Button>
          </CardHeader>

          {authHistoryOpen && (
            <CardContent className="space-y-2">
              {authActivityMissingTable ? (
                <p className="text-sm text-muted-foreground">
                  Auth activity table is not set up yet. Run `sql/migrate_auth_activity.sql`.
                </p>
              ) : authEvents.length === 0 ? (
                <p className="text-sm text-muted-foreground">No sign-in events recorded for this user yet.</p>
              ) : (
                authEvents.slice(0, 20).map((event) => (
                  <div key={event.id} className="rounded-md border border-border/70 px-3 py-2">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="text-sm font-medium capitalize">{event.event_type.replace("_", " ")}</p>
                      <p className="text-xs text-muted-foreground">{new Date(event.created_at).toLocaleString()}</p>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {event.city || event.country
                        ? `Location: ${[event.city, event.country].filter(Boolean).join(", ")}`
                        : "Location unavailable"}
                    </p>
                  </div>
                ))
              )}
            </CardContent>
          )}
        </Card>
      )}
    </div>
  )
}
