"use client"

import { useEffect, useMemo, useState } from "react"
import {
  BarChart3,
  CheckCircle2,
  Clock,
  Download,
  Loader2,
  Users,
} from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts"

const COLORS = {
  todo: "#6b7280",
  "in-progress": "#3b82f6",
  done: "#22c55e",
  low: "#22c55e",
  medium: "#f59e0b",
  high: "#ef4444",
  urgent: "#dc2626",
  active: "#3b82f6",
  "on-hold": "#f59e0b",
  completed: "#22c55e",
}

const PIE_COLORS = ["#6b7280", "#3b82f6", "#22c55e"]

type Project = {
  id: string
  name: string
  status: "active" | "on-hold" | "completed"
  deadline: string | null
  budget: number | null
  client_name?: string | null
  created_at?: string
}

type Task = {
  id: string
  title: string
  status: "todo" | "in-progress" | "done"
  priority: "low" | "medium" | "high" | "urgent"
  due_date: string | null
  created_at?: string
}

type Member = {
  id: string
  name: string
  role: string
}

type Client = {
  id: string
  name: string
}

type TimeRange = "7d" | "30d" | "90d" | "all"

export default function ReportsPage() {
  const [projects, setProjects] = useState<Project[]>([])
  const [tasks, setTasks] = useState<Task[]>([])
  const [members, setMembers] = useState<Member[]>([])
  const [clients, setClients] = useState<Client[]>([])
  const [loading, setLoading] = useState(true)
  const [timeRange, setTimeRange] = useState<TimeRange>("30d")

  useEffect(() => {
    let mounted = true

    const load = async () => {
      setLoading(true)
      try {
        const [projectsRes, tasksRes, membersRes, clientsRes] = await Promise.all([
          fetch("/api/projects", { cache: "no-store" }),
          fetch("/api/tasks", { cache: "no-store" }),
          fetch("/api/members", { cache: "no-store" }),
          fetch("/api/clients", { cache: "no-store" }),
        ])

        const [projectsData, tasksData, membersData, clientsData] = await Promise.all([
          projectsRes.json(),
          tasksRes.json(),
          membersRes.json(),
          clientsRes.json(),
        ])

        if (!mounted) return

        setProjects(Array.isArray(projectsData) ? projectsData : [])
        setTasks(Array.isArray(tasksData) ? tasksData : [])
        setMembers(Array.isArray(membersData) ? membersData : [])
        setClients(Array.isArray(clientsData) ? clientsData : [])
      } catch {
        if (!mounted) return
        setProjects([])
        setTasks([])
        setMembers([])
        setClients([])
      } finally {
        if (mounted) {
          setLoading(false)
        }
      }
    }

    load()

    return () => {
      mounted = false
    }
  }, [])

  const filteredProjects = useMemo(() => {
    if (timeRange === "all") return projects

    const now = new Date()
    const days = timeRange === "7d" ? 7 : timeRange === "30d" ? 30 : 90
    const cutoff = new Date(now.getTime() - days * 24 * 60 * 60 * 1000)

    return projects.filter((project) => {
      if (!project.created_at) return true
      return new Date(project.created_at) >= cutoff
    })
  }, [projects, timeRange])

  const filteredTasks = useMemo(() => {
    if (timeRange === "all") return tasks

    const now = new Date()
    const days = timeRange === "7d" ? 7 : timeRange === "30d" ? 30 : 90
    const cutoff = new Date(now.getTime() - days * 24 * 60 * 60 * 1000)

    return tasks.filter((task) => {
      if (!task.created_at) return true
      return new Date(task.created_at) >= cutoff
    })
  }, [tasks, timeRange])

  const metrics = useMemo(() => {
    const totalProjects = filteredProjects.length
    const activeProjects = filteredProjects.filter((project) => project.status === "active").length
    const completedProjects = filteredProjects.filter((project) => project.status === "completed").length
    const onHoldProjects = filteredProjects.filter((project) => project.status === "on-hold").length
    const completionRate = totalProjects ? Math.round((completedProjects / totalProjects) * 100) : 0
    const taskInProgress = filteredTasks.filter((task) => task.status === "in-progress").length
    const taskTodo = filteredTasks.filter((task) => task.status === "todo").length
    const taskDone = filteredTasks.filter((task) => task.status === "done").length
    const taskCompletion = filteredTasks.length ? Math.round((taskDone / filteredTasks.length) * 100) : 0

    const taskByPriority = {
      low: filteredTasks.filter((task) => task.priority === "low").length,
      medium: filteredTasks.filter((task) => task.priority === "medium").length,
      high: filteredTasks.filter((task) => task.priority === "high").length,
      urgent: filteredTasks.filter((task) => task.priority === "urgent").length,
    }

    const projectByStatus = {
      active: activeProjects,
      "on-hold": onHoldProjects,
      completed: completedProjects,
    }

    const projectsWithClients = filteredProjects.filter((project) => !!project.client_name).length

    return {
      totalProjects,
      activeProjects,
      completedProjects,
      onHoldProjects,
      completionRate,
      taskInProgress,
      taskTodo,
      taskDone,
      taskCompletion,
      taskByPriority,
      projectByStatus,
      projectsWithClients,
    }
  }, [filteredProjects, filteredTasks])

  const taskStatusData = useMemo(() => [
    { name: "To Do", value: metrics.taskTodo, color: PIE_COLORS[0] },
    { name: "In Progress", value: metrics.taskInProgress, color: PIE_COLORS[1] },
    { name: "Done", value: metrics.taskDone, color: PIE_COLORS[2] },
  ].filter(d => d.value > 0), [metrics.taskTodo, metrics.taskInProgress, metrics.taskDone])

  const taskPriorityData = useMemo(() => [
    { priority: "Low", count: metrics.taskByPriority.low, fill: COLORS.low },
    { priority: "Med", count: metrics.taskByPriority.medium, fill: COLORS.medium },
    { priority: "High", count: metrics.taskByPriority.high, fill: COLORS.high },
    { priority: "Urgent", count: metrics.taskByPriority.urgent, fill: COLORS.urgent },
  ].filter(d => d.count > 0), [metrics.taskByPriority])

  const projectStatusData = useMemo(() => [
    { status: "Active", count: metrics.projectByStatus.active, fill: COLORS.active },
    { status: "On Hold", count: metrics.projectByStatus["on-hold"], fill: COLORS["on-hold"] },
    { status: "Done", count: metrics.projectByStatus.completed, fill: COLORS.completed },
  ].filter(d => d.count > 0), [metrics.projectByStatus])

  const nextDeadlines = useMemo(() => {
    return [...filteredProjects]
      .filter((project) => Boolean(project.deadline))
      .sort((a, b) => new Date(a.deadline || "").getTime() - new Date(b.deadline || "").getTime())
      .slice(0, 5)
  }, [filteredProjects])

  const overdueTasks = useMemo(() => {
    const now = new Date()
    return filteredTasks.filter((task) => {
      if (!task.due_date || task.status === "done") return false
      return new Date(task.due_date) < now
    }).length
  }, [filteredTasks])

  const busyMembers = useMemo(() => {
    const roleCount = members.reduce<Record<string, number>>((acc, member) => {
      const key = member.role || "unknown"
      acc[key] = (acc[key] || 0) + 1
      return acc
    }, {})

    return Object.entries(roleCount)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
  }, [members])

  const handleExport = () => {
    const data = {
      generatedAt: new Date().toISOString(),
      timeRange,
      summary: {
        totalProjects: metrics.totalProjects,
        activeProjects: metrics.activeProjects,
        completedProjects: metrics.completedProjects,
        projectCompletionRate: metrics.completionRate,
        totalTasks: filteredTasks.length,
        tasksInProgress: metrics.taskInProgress,
        tasksDone: metrics.taskDone,
        taskCompletionRate: metrics.taskCompletion,
        overdueTasks,
        teamMembers: members.length,
      },
      tasksByStatus: {
        todo: metrics.taskTodo,
        inProgress: metrics.taskInProgress,
        done: metrics.taskDone,
      },
      tasksByPriority: metrics.taskByPriority,
      projectsByStatus: metrics.projectByStatus,
      upcomingDeadlines: nextDeadlines.map(p => ({ name: p.name, deadline: p.deadline, status: p.status })),
      teamRoles: Object.fromEntries(busyMembers),
    }

    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `projecthub-report-${timeRange}-${new Date().toISOString().split("T")[0]}.json`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  return (
    <div className="space-y-4 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Reports</h1>
          <p className="text-muted-foreground text-sm">Operational analytics from live data.</p>
        </div>
        <div className="flex gap-2">
          <div className="flex rounded-md border border-border/60">
            {(["7d", "30d", "90d", "all"] as TimeRange[]).map((range) => (
              <button
                key={range}
                onClick={() => setTimeRange(range)}
                className={`px-3 py-1.5 text-xs font-medium transition-colors ${
                  timeRange === range
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground"
                } ${range === "7d" ? "rounded-l-md" : ""} ${range === "all" ? "rounded-r-md" : ""}`}
              >
                {range === "7d" ? "7D" : range === "30d" ? "30D" : range === "90d" ? "90D" : "All"}
              </button>
            ))}
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={handleExport}
          >
            <Download className="h-3.5 w-3.5 mr-1.5" />
            Export
          </Button>
        </div>
      </div>

      {loading ? (
        <Card>
          <CardContent className="flex items-center justify-center py-8">
            <Loader2 className="h-5 w-5 animate-spin" />
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="grid gap-3 grid-cols-2 lg:grid-cols-5">
            <Card className="glass card-hover py-3">
              <CardHeader className="pb-1">
                <CardTitle className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                  <BarChart3 className="h-3 w-3" /> Projects
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="text-2xl font-bold">{metrics.totalProjects}</div>
                <p className="text-xs text-muted-foreground">
                  {metrics.activeProjects} active
                </p>
              </CardContent>
            </Card>
            <Card className="glass card-hover py-3">
              <CardHeader className="pb-1">
                <CardTitle className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                  <Clock className="h-3 w-3" /> In Progress
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="text-2xl font-bold">{metrics.taskInProgress}</div>
                <p className="text-xs text-muted-foreground">
                  {metrics.taskCompletion}% done
                </p>
              </CardContent>
            </Card>
            <Card className="glass card-hover py-3">
              <CardHeader className="pb-1">
                <CardTitle className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                  <CheckCircle2 className="h-3 w-3" /> Completed
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="text-2xl font-bold">{metrics.completionRate}%</div>
                <p className="text-xs text-muted-foreground">
                  {metrics.completedProjects} projects
                </p>
              </CardContent>
            </Card>
            <Card className="glass card-hover py-3">
              <CardHeader className="pb-1">
                <CardTitle className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                  <Users className="h-3 w-3" /> Team
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="text-2xl font-bold">{members.length}</div>
                <p className="text-xs text-muted-foreground">
                  {busyMembers.length} roles
                </p>
              </CardContent>
            </Card>
            <Card className="glass card-hover py-3">
              <CardHeader className="pb-1">
                <CardTitle className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                  <Users className="h-3 w-3" /> Clients
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="text-2xl font-bold">{clients.length}</div>
                <p className="text-xs text-muted-foreground">
                  {metrics.projectsWithClients} projects linked
                </p>
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
            <Card className="glass">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Task Status</CardTitle>
              </CardHeader>
              <CardContent>
                {taskStatusData.length > 0 ? (
                  <div className="h-[180px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={taskStatusData}
                          cx="50%"
                          cy="50%"
                          innerRadius={40}
                          outerRadius={60}
                          paddingAngle={5}
                          dataKey="value"
                          label={({ percent }) => `${((percent ?? 0) * 100).toFixed(0)}%`}
                          labelLine={false}
                        >
                          {taskStatusData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.color} />
                          ))}
                        </Pie>
                        <Tooltip
                          contentStyle={{
                            backgroundColor: "hsl(var(--card))",
                            border: "1px solid hsl(var(--border))",
                            borderRadius: "6px",
                            fontSize: "12px",
                          }}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                ) : (
                  <div className="h-[180px] flex items-center justify-center text-muted-foreground text-sm">
                    No data
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className="glass">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">By Priority</CardTitle>
              </CardHeader>
              <CardContent>
                {taskPriorityData.length > 0 ? (
                  <div className="h-[180px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={taskPriorityData} layout="vertical">
                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border)/0.5)" />
                        <XAxis type="number" tickLine={false} axisLine={false} fontSize={10} />
                        <YAxis dataKey="priority" type="category" width={50} tickLine={false} axisLine={false} fontSize={10} />
                        <Tooltip
                          contentStyle={{
                            backgroundColor: "hsl(var(--card))",
                            border: "1px solid hsl(var(--border))",
                            borderRadius: "6px",
                            fontSize: "12px",
                          }}
                        />
                        <Bar dataKey="count" radius={[0, 3, 3, 0]}>
                          {taskPriorityData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.fill} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                ) : (
                  <div className="h-[180px] flex items-center justify-center text-muted-foreground text-sm">
                    No data
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className="glass">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Projects</CardTitle>
              </CardHeader>
              <CardContent>
                {projectStatusData.length > 0 ? (
                  <div className="h-[180px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={projectStatusData}>
                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border)/0.5)" />
                        <XAxis dataKey="status" tickLine={false} axisLine={false} fontSize={10} />
                        <YAxis tickLine={false} axisLine={false} fontSize={10} />
                        <Tooltip
                          contentStyle={{
                            backgroundColor: "hsl(var(--card))",
                            border: "1px solid hsl(var(--border))",
                            borderRadius: "6px",
                            fontSize: "12px",
                          }}
                        />
                        <Bar dataKey="count" radius={[3, 3, 0, 0]}>
                          {projectStatusData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.fill} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                ) : (
                  <div className="h-[180px] flex items-center justify-center text-muted-foreground text-sm">
                    No data
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className="glass">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Task Overview</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-2">
                  <div className="rounded border border-border/60 p-2 text-center">
                    <p className="text-xl font-bold">{metrics.taskTodo}</p>
                    <p className="text-xs text-muted-foreground">To Do</p>
                  </div>
                  <div className="rounded border border-border/60 p-2 text-center">
                    <p className="text-xl font-bold text-blue-500">{metrics.taskInProgress}</p>
                    <p className="text-xs text-muted-foreground">In Progress</p>
                  </div>
                  <div className="rounded border border-border/60 p-2 text-center">
                    <p className="text-xl font-bold text-green-500">{metrics.taskDone}</p>
                    <p className="text-xs text-muted-foreground">Done</p>
                  </div>
                  <div className="rounded border border-border/60 p-2 text-center">
                    <p className="text-xl font-bold text-red-500">{overdueTasks}</p>
                    <p className="text-xs text-muted-foreground">Overdue</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            <Card className="glass">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Upcoming Deadlines</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {nextDeadlines.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No upcoming deadlines.</p>
                ) : (
                  nextDeadlines.map((project) => (
                    <div
                      key={project.id}
                      className="flex items-center justify-between rounded border border-border/60 px-2 py-1.5"
                    >
                      <div className="flex items-center gap-2">
                        <Badge
                          variant={
                            project.status === "active"
                              ? "default"
                              : project.status === "completed"
                              ? "secondary"
                              : "outline"
                          }
                          className="text-[10px] px-1.5 py-0 capitalize"
                        >
                          {project.status}
                        </Badge>
                        <span className="text-sm truncate max-w-[120px]">{project.name}</span>
                      </div>
                      <span className="text-xs text-muted-foreground whitespace-nowrap">{project.deadline}</span>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>

            <Card className="glass">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Team Roles</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {busyMembers.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No team members yet.</p>
                ) : (
                  busyMembers.map(([role, count]) => (
                    <div
                      key={role}
                      className="flex items-center justify-between rounded border border-border/60 px-2 py-1.5"
                    >
                      <span className="text-sm capitalize truncate">{role}</span>
                      <Badge variant="outline" className="text-xs">{count}</Badge>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </div>
  )
}
