"use client"

import { useEffect, useState } from "react"
import { createClient } from "@/lib/supabase"
import { useUser } from "@/components/user-provider"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { FolderKanban, Plus, Pencil, Trash2, X, Loader2, Code, Zap, Globe, Database, Shield, Briefcase, Mail, Settings, Users } from "lucide-react"

interface Project {
  id: string
  name: string
  status: "active" | "on-hold" | "completed"
  deadline: string | null
  budget: number | null
  description: string | null
  member_id: string | null
  created_by: string | null
  created_at: string
  color?: string
  icon?: string
  members?: {
    id: string
    name: string
    email: string
    role: string
  }
}

const ICON_MAP: Record<string, any> = {
  FolderKanban, Code, Zap, Globe, Database, Shield, Briefcase, Mail, Settings, Users
}

interface Member {
  id: string
  name: string
  email: string
  role: string
}

export default function ProjectsPage() {
  const { profile, loading: userLoading } = useUser()
  const supabase = createClient()
  
  const [projects, setProjects] = useState<Project[]>([])
  const [members, setMembers] = useState<Member[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editingProject, setEditingProject] = useState<Project | null>(null)
  const [filter, setFilter] = useState<string>("all")
  const [search, setSearch] = useState("")

  const isAdmin = profile?.role === "admin"
  const canEdit = profile?.role === "admin" || profile?.role === "member"

  useEffect(() => {
    if (!userLoading) {
      fetchProjects()
      fetchMembers()
    }
  }, [userLoading, filter, search])

  const fetchProjects = async () => {
    setLoading(true)
    let url = "/api/projects"
    const params = new URLSearchParams()
    if (filter !== "all") params.set("status", filter)
    if (search) params.set("search", search)
    if (params.toString()) url += `?${params.toString()}`

    const response = await fetch(url)
    const data = await response.json()
    if (Array.isArray(data)) {
      setProjects(data)
    } else {
      setProjects([])
    }
    setLoading(false)
  }

  const fetchMembers = async () => {
    const response = await fetch("/api/members")
    const data = await response.json()
    if (Array.isArray(data)) {
      setMembers(data)
    } else {
      setMembers([])
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this project?")) return
    
    const response = await fetch(`/api/projects/${id}`, { method: "DELETE" })
    if (response.ok) {
      setProjects(projects.filter(p => p.id !== id))
    }
  }

  const getStatusStyles = (status: string) => {
    switch(status) {
      case 'active':
        return 'status-active'
      case 'on-hold':
        return 'status-on-hold'
      case 'completed':
        return 'status-completed'
      default:
        return ''
    }
  }

  if (userLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
  )
}

function ProjectsSkeleton() {
  return (
    <Card className="glass">
      <CardContent className="p-0">
        <div className="divide-y divide-border">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="flex items-center justify-between p-4">
              <div className="flex items-center gap-4">
                <div className="h-10 w-10 rounded-lg bg-muted animate-pulse" />
                <div className="space-y-2">
                  <div className="h-4 w-32 bg-muted rounded animate-pulse" />
                  <div className="h-3 w-24 bg-muted rounded animate-pulse" />
                </div>
              </div>
              <div className="flex items-center gap-4">
                <div className="h-6 w-20 bg-muted rounded-full animate-pulse" />
                <div className="h-4 w-16 bg-muted rounded animate-pulse" />
                <div className="flex gap-1">
                  <div className="h-8 w-8 bg-muted rounded animate-pulse" />
                  <div className="h-8 w-8 bg-muted rounded animate-pulse" />
                </div>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Projects</h1>
          <p className="text-muted-foreground">Manage your projects and track progress.</p>
        </div>
        {canEdit && (
          <Button onClick={() => { setEditingProject(null); setShowModal(true) }} className="gap-2">
            <Plus className="h-4 w-4" /> Add Project
          </Button>
        )}
      </div>

      {/* Filters */}
      <div className="flex gap-4">
        <input
          type="text"
          placeholder="Search projects..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="h-10 px-3 rounded-lg border border-input bg-background text-sm w-64"
        />
        <select
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          className="h-10 px-3 rounded-lg border border-input bg-background text-sm"
        >
          <option value="all">All Status</option>
          <option value="active">Active</option>
          <option value="on-hold">On Hold</option>
          <option value="completed">Completed</option>
        </select>
      </div>

      {/* Projects List */}
      {loading ? (
        <ProjectsSkeleton />
      ) : projects.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <FolderKanban className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-muted-foreground">No projects found</p>
          </CardContent>
        </Card>
      ) : (
        <Card className="glass">
          <CardContent className="p-0">
            <div className="divide-y divide-border">
              {projects.map((project) => (
                <div 
                  key={project.id}
                  className="flex items-center justify-between p-4 hover:bg-accent/20 transition-colors"
                >
                  <div className="flex items-center gap-4">
                    <div 
                      className="h-10 w-10 rounded-lg flex items-center justify-center"
                      style={{ backgroundColor: `${project.color || '#8B5CF6'}20` }}
                    >
                      {(() => {
                        const Icon = ICON_MAP[project.icon || 'FolderKanban'] || FolderKanban
                        return <Icon className="h-5 w-5" style={{ color: project.color || '#8B5CF6' }} />
                      })()}
                    </div>
                    <div>
                      <p className="font-medium">{project.name}</p>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        {project.members?.name && <span>{project.members.name}</span>}
                        {project.deadline && <span>• {project.deadline}</span>}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <span className={`px-3 py-1 rounded-full text-xs font-medium ${getStatusStyles(project.status)}`}>
                      {project.status}
                    </span>
                    <span className="text-sm font-mono w-24 text-right">
                      {project.budget ? `$${project.budget.toLocaleString()}` : "-"}
                    </span>
                    {canEdit && (
                      <div className="flex gap-1">
                        <Button 
                          variant="ghost" 
                          size="icon"
                          onClick={() => { setEditingProject(project); setShowModal(true) }}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        {isAdmin && (
                          <Button 
                            variant="ghost" 
                            size="icon"
                            onClick={() => handleDelete(project.id)}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Modal */}
      {showModal && (
        <ProjectModal
          project={editingProject}
          members={members}
          onClose={() => { setShowModal(false); setEditingProject(null) }}
          onSave={() => { setShowModal(false); fetchProjects() }}
        />
      )}
    </div>
  )
}

function ProjectModal({ 
  project, 
  members, 
  onClose, 
  onSave 
}: { 
  project: Project | null
  members: Member[]
  onClose: () => void
  onSave: () => void
}) {
  const [name, setName] = useState(project?.name || "")
  const [status, setStatus] = useState(project?.status || "active")
  const [deadline, setDeadline] = useState(project?.deadline || "")
  const [budget, setBudget] = useState(project?.budget?.toString() || "")
  const [description, setDescription] = useState(project?.description || "")
  const [memberId, setMemberId] = useState(project?.member_id || "")
  const [color, setColor] = useState(project?.color || "#8B5CF6")
  const [icon, setIcon] = useState(project?.icon || "FolderKanban")
  const [saving, setSaving] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)

    const data = {
      name,
      status,
      deadline: deadline || null,
      budget: budget ? parseFloat(budget) : null,
      description: description || null,
      member_id: memberId || null,
      color,
      icon,
    }

    const url = project ? `/api/projects/${project.id}` : "/api/projects"
    const method = project ? "PUT" : "POST"

    const response = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    })

    setSaving(false)

    if (response.ok) {
      onSave()
    } else {
      const error = await response.json()
      alert(error.error || "Something went wrong")
    }
  }

  return (
    <div className="fixed inset-0 bg-background/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <Card className="glass w-full max-w-lg">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>{project ? "Edit Project" : "New Project"}</CardTitle>
            <Button variant="ghost" size="icon" onClick={onClose}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="text-sm font-medium">Name</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full mt-1 h-10 px-3 rounded-lg border border-input bg-background text-sm"
                required
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium">Status</label>
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value as "active" | "on-hold" | "completed")}
                  className="w-full mt-1 h-10 px-3 rounded-lg border border-input bg-background text-sm"
                >
                  <option value="active">Active</option>
                  <option value="on-hold">On Hold</option>
                  <option value="completed">Completed</option>
                </select>
              </div>
              <div>
                <label className="text-sm font-medium">Deadline</label>
                <input
                  type="date"
                  value={deadline}
                  onChange={(e) => setDeadline(e.target.value)}
                  className="w-full mt-1 h-10 px-3 rounded-lg border border-input bg-background text-sm"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium">Budget ($)</label>
                <input
                  type="number"
                  value={budget}
                  onChange={(e) => setBudget(e.target.value)}
                  className="w-full mt-1 h-10 px-3 rounded-lg border border-input bg-background text-sm"
                  step="0.01"
                />
              </div>
              <div>
                <label className="text-sm font-medium">Assign Member</label>
                <select
                  value={memberId}
                  onChange={(e) => setMemberId(e.target.value)}
                  className="w-full mt-1 h-10 px-3 rounded-lg border border-input bg-background text-sm"
                >
                  <option value="">Unassigned</option>
                  {members.map((m) => (
                    <option key={m.id} value={m.id}>{m.name}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium">Color</label>
                <div className="flex items-center gap-2 mt-1">
                  <input
                    type="color"
                    value={color}
                    onChange={(e) => setColor(e.target.value)}
                    className="h-10 w-10 rounded-lg border border-input cursor-pointer"
                  />
                  <span className="text-sm text-muted-foreground">{color}</span>
                </div>
              </div>
              <div>
                <label className="text-sm font-medium">Icon</label>
                <select
                  value={icon}
                  onChange={(e) => setIcon(e.target.value)}
                  className="w-full mt-1 h-10 px-3 rounded-lg border border-input bg-background text-sm"
                >
                  {Object.keys(ICON_MAP).map((name) => (
                    <option key={name} value={name}>{name}</option>
                  ))}
                </select>
              </div>
            </div>
            <div>
              <label className="text-sm font-medium">Description</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full mt-1 h-20 px-3 py-2 rounded-lg border border-input bg-background text-sm"
              />
            </div>
            <div className="flex justify-end gap-2 pt-4">
              <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
              <Button type="submit" disabled={saving}>
                {saving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                {project ? "Save Changes" : "Create Project"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
