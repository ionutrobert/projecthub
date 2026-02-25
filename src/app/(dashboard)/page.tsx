"use client"

import { useEffect, useState } from "react"
import { createClient } from "@/lib/supabase"
import { useUser } from "@/components/user-provider"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { FolderKanban, CheckCircle2, Clock, DollarSign, TrendingUp, Loader2 } from "lucide-react"

interface Project {
  id: string
  name: string
  status: "active" | "on-hold" | "completed"
  deadline: string | null
  budget: number | null
}

export default function DashboardPage() {
  const { user, loading: userLoading } = useUser()
  const supabase = createClient()
  const [projects, setProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!userLoading) {
      fetchProjects()
    }
  }, [userLoading])

  const fetchProjects = async () => {
    setLoading(true)
    const response = await fetch("/api/projects")
    const data = await response.json()
    if (Array.isArray(data)) {
      setProjects(data)
    } else {
      setProjects([])
    }
    setLoading(false)
  }

  const totalProjects = projects.length
  const activeProjects = projects.filter(p => p.status === "active").length
  const completedProjects = projects.filter(p => p.status === "completed").length
  const totalBudget = projects.reduce((sum, p) => sum + (p.budget || 0), 0)

  const stats = [
    { title: "Total Projects", value: totalProjects.toString(), change: "+12%", icon: FolderKanban, color: "text-primary" },
    { title: "Active Projects", value: activeProjects.toString(), change: "+8%", icon: Clock, color: "text-amber-500" },
    { title: "Completed", value: completedProjects.toString(), change: "+25%", icon: CheckCircle2, color: "text-blue-500" },
    { title: "Total Budget", value: `$${totalBudget.toLocaleString()}`, change: "+18%", icon: DollarSign, color: "text-primary" },
  ]

  const recentProjects = projects.slice(0, 5)

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

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground">Welcome back! Here&apos;s your project overview.</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => (
          <Card key={stat.title} className="glass card-hover transition-smooth">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">{stat.title}</CardTitle>
              <stat.icon className={`h-5 w-5 ${stat.color}`} />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stat.value}</div>
              <div className="flex items-center gap-1 text-xs text-muted-foreground mt-1">
                <TrendingUp className={`h-3 w-3 ${stat.color}`} />
                <span className={`font-medium ${stat.color}`}>{stat.change}</span>
                <span>from last month</span>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="glass">
        <CardHeader>
          <CardTitle>Recent Projects</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin" />
            </div>
          ) : recentProjects.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">No projects yet. Create your first project!</p>
          ) : (
            <div className="space-y-3">
              {recentProjects.map((project) => (
                <div 
                  key={project.id}
                  className="flex items-center justify-between rounded-lg border border-border/50 p-4 hover:bg-accent/30 transition-smooth"
                >
                  <div className="flex items-center gap-4">
                    <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                      <FolderKanban className="h-5 w-5 text-primary" />
                    </div>
                    <div className="space-y-1">
                      <p className="text-sm font-medium">{project.name}</p>
                      <p className="text-xs text-muted-foreground font-mono">{project.id.slice(0, 8)}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-6">
                    <div className={`px-3 py-1 rounded-full text-xs font-medium font-mono ${getStatusStyles(project.status)}`}>
                      {project.status}
                    </div>
                    <div className="text-right min-w-[80px]">
                      <p className="text-sm font-medium font-mono">
                        {project.budget ? `$${project.budget.toLocaleString()}` : "-"}
                      </p>
                    </div>
                    <div className="text-right min-w-[100px]">
                      <p className="text-sm text-muted-foreground font-mono">
                        {project.deadline ? new Date(project.deadline).toLocaleDateString() : "-"}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
