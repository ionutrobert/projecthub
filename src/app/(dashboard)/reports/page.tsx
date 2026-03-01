"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import {
  AlertCircle,
  BarChart3,
  Calendar,
  CheckCircle2,
  Clock,
  Download,
  Loader2,
  TrendingUp,
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
  assignee_member_id: string | null
  project_id?: string
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

function getDaysUntil(dateStr: string | null): number | null {
  if (!dateStr) return null
  const target = new Date(dateStr)
  const now = new Date()
  now.setHours(0, 0, 0, 0)
  target.setHours(0, 0, 0, 0)
  const diff = target.getTime() - now.getTime()
  return Math.ceil(diff / (1000 * 60 * 60 * 24))
}

function formatDaysUntil(dateStr: string | null): string {
  const days = getDaysUntil(dateStr)
  if (days === null) return "No date"
  if (days < 0) return `${Math.abs(days)}d overdue`
  if (days === 0) return "Today"
  if (days === 1) return "Tomorrow"
  return `in ${days}d`
}

function getUrgencyClass(dateStr: string | null): string {
  const days = getDaysUntil(dateStr)
  if (days === null) return "text-muted-foreground"
  if (days < 0) return "text-red-600 dark:text-red-400 font-medium"
  if (days === 0) return "text-orange-600 dark:text-orange-400 font-medium"
  if (days <= 2) return "text-orange-500 dark:text-orange-400"
  if (days <= 7) return "text-amber-500 dark:text-amber-400"
  return "text-muted-foreground"
}

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
    now.setHours(0, 0, 0, 0)
    const days = timeRange === "7d" ? 7 : timeRange === "30d" ? 30 : 90
    const cutoff = new Date(now.getTime() + days * 24 * 60 * 60 * 1000)

    return projects.filter((project) => {
      if (!project.deadline) return true
      return new Date(project.deadline) <= cutoff
    })
  }, [projects, timeRange])

  const filteredTasks = useMemo(() => {
    if (timeRange === "all") return tasks

    const now = new Date()
    now.setHours(0, 0, 0, 0)
    const days = timeRange === "7d" ? 7 : timeRange === "30d" ? 30 : 90
    const cutoff = new Date(now.getTime() + days * 24 * 60 * 60 * 1000)

    return tasks.filter((task) => {
      if (!task.due_date) return true
      return new Date(task.due_date) <= cutoff
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

  const upcomingTasks = useMemo(() => {
    return [...filteredTasks]
      .filter((task) => Boolean(task.due_date) && task.status !== "done")
      .sort((a, b) => new Date(a.due_date || "").getTime() - new Date(b.due_date || "").getTime())
      .slice(0, 5)
  }, [filteredTasks])

  const overdueTasks = useMemo(() => {
    const now = new Date()
    now.setHours(0, 0, 0, 0)
    return filteredTasks.filter((task) => {
      if (!task.due_date || task.status === "done") return false
      const dueDate = new Date(task.due_date)
      dueDate.setHours(0, 0, 0, 0)
      return dueDate < now
    }).length
  }, [filteredTasks])

  const teamWorkload = useMemo(() => {
    const workload: Record<string, { total: number; todo: number; inProgress: number; done: number }> = {}
    
    members.forEach((member) => {
      workload[member.id] = { total: 0, todo: 0, inProgress: 0, done: 0 }
    })
    
    filteredTasks.forEach((task) => {
      if (task.assignee_member_id && workload[task.assignee_member_id]) {
        workload[task.assignee_member_id].total++
        if (task.status === "todo") workload[task.assignee_member_id].todo++
        else if (task.status === "in-progress") workload[task.assignee_member_id].inProgress++
        else if (task.status === "done") workload[task.assignee_member_id].done++
      }
    })
    
    const memberWorkload = members.map((member) => ({
      id: member.id,
      name: member.name,
      role: member.role,
      ...workload[member.id],
    }))
    
    return memberWorkload
      .filter((m) => m.total > 0)
      .sort((a, b) => b.total - a.total)
      .slice(0, 5)
  }, [filteredTasks, members])

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
      upcomingTasks: upcomingTasks.map(t => ({ title: t.title, dueDate: t.due_date, status: t.status, priority: t.priority })),
      teamWorkload: teamWorkload.map(m => ({ name: m.name, role: m.role, total: m.total, todo: m.todo, inProgress: m.inProgress, done: m.done })),
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
    <div className="space-y-3 sm:space-y-4 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 sm:gap-3">
        <div>
          <h1 className="text-xl font-bold tracking-tight sm:text-2xl">Reports</h1>
          <p className="text-muted-foreground text-[10px] sm:text-sm">Operational analytics from live data.</p>
        </div>
        <div className="flex gap-2">
          <div className="flex rounded-md border border-border/60">
            {(["7d", "30d", "90d", "all"] as TimeRange[]).map((range) => (
              <button
                key={range}
                onClick={() => setTimeRange(range)}
                className={`px-3 py-1 text-[10px] font-medium transition-colors sm:px-3 sm:py-1.5 sm:text-xs ${
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
            className="text-[10px] sm:text-xs"
          >
            <Download className="h-3 w-3 mr-1 sm:h-3.5 sm:w-3.5 sm:mr-1.5" />
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
          <div className="grid gap-2 sm:gap-3 grid-cols-2 sm:grid-cols-2 lg:grid-cols-2">
            <Link href="/projects" className="block">
              <Card className="glass card-hover py-2 sm:py-3 h-full cursor-pointer hover:border-primary/50 transition-colors">
                <CardHeader className="pb-0.5 sm:pb-1">
                  <CardTitle className="text-[10px] sm:text-xs font-medium text-muted-foreground flex items-center gap-1">
                    <BarChart3 className="h-2.5 w-2.5 sm:h-3 sm:w-3" /> Projects
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-0">
                  <div className="text-xl font-bold sm:text-2xl">{metrics.totalProjects}</div>
                  <p className="text-[10px] sm:text-xs text-muted-foreground">
                    {metrics.activeProjects} active
                  </p>
                </CardContent>
              </Card>
            </Link>
            <Link href="/projects?status=completed" className="block">
              <Card className="glass card-hover py-2 sm:py-3 h-full cursor-pointer hover:border-primary/50 transition-colors">
                <CardHeader className="pb-0.5 sm:pb-1">
                  <CardTitle className="text-[10px] sm:text-xs font-medium text-muted-foreground flex items-center gap-1">
                    <CheckCircle2 className="h-2.5 w-2.5 sm:h-3 sm:w-3" /> Completion
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-0">
                  <div className="text-xl font-bold sm:text-2xl">{metrics.completionRate}%</div>
                  <p className="text-[10px] sm:text-xs text-muted-foreground">
                    {metrics.completedProjects} projects
                  </p>
                </CardContent>
              </Card>
            </Link>
          </div>

          <div className="grid gap-2 sm:gap-3 grid-cols-2 md:grid-cols-3 lg:grid-cols-3">
            <Link href="/team" className="block">
              <Card className="glass card-hover py-2 sm:py-3 h-full cursor-pointer hover:border-primary/50 transition-colors">
                <CardHeader className="pb-0.5 sm:pb-1">
                  <CardTitle className="text-[10px] sm:text-xs font-medium text-muted-foreground flex items-center gap-1">
                    <Users className="h-2.5 w-2.5 sm:h-3 sm:w-3" /> Team
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-0">
                  <div className="text-xl font-bold sm:text-2xl">{members.length}</div>
                  <p className="text-[10px] sm:text-xs text-muted-foreground">
                    {busyMembers.length} roles
                  </p>
                </CardContent>
              </Card>
            </Link>
            <Link href="/clients" className="block">
              <Card className="glass card-hover py-2 sm:py-3 h-full cursor-pointer hover:border-primary/50 transition-colors">
                <CardHeader className="pb-0.5 sm:pb-1">
                  <CardTitle className="text-[10px] sm:text-xs font-medium text-muted-foreground flex items-center gap-1">
                    <Users className="h-2.5 w-2.5 sm:h-3 sm:w-3" /> Clients
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-0">
                  <div className="text-xl font-bold sm:text-2xl">{clients.length}</div>
                  <p className="text-[10px] sm:text-xs text-muted-foreground">
                    {metrics.projectsWithClients} linked
                  </p>
                </CardContent>
              </Card>
            </Link>
            <Link href="/tasks?status=in-progress" className="block col-span-2 md:col-span-1 lg:col-span-1">
              <Card className="glass card-hover py-2 sm:py-3 h-full cursor-pointer hover:border-primary/50 transition-colors">
                <CardHeader className="pb-0.5 sm:pb-1">
                  <CardTitle className="text-[10px] sm:text-xs font-medium text-muted-foreground flex items-center gap-1">
                    <Clock className="h-2.5 w-2.5 sm:h-3 sm:w-3" /> Tasks Active
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-0">
                  <div className="text-xl font-bold sm:text-2xl">{metrics.taskInProgress}</div>
                  <p className="text-[10px] sm:text-xs text-muted-foreground">
                    {metrics.taskTodo} pending
                  </p>
                </CardContent>
              </Card>
            </Link>
          </div>

          <div className="grid gap-2 sm:gap-3 md:grid-cols-2 lg:grid-cols-4">
            <Card className="glass">
              <CardHeader className="pb-1.5">
                <CardTitle className="text-[10px] sm:text-sm">Task Status</CardTitle>
              </CardHeader>
              <CardContent>
                {taskStatusData.length > 0 ? (
                  <div className="h-[150px] sm:h-[180px]">
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
                  <div className="h-[150px] sm:h-[180px] flex items-center justify-center text-muted-foreground text-[10px] sm:text-sm">
                    No data
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className="glass">
              <CardHeader className="pb-1.5">
                <CardTitle className="text-[10px] sm:text-sm">By Priority</CardTitle>
              </CardHeader>
              <CardContent>
                {taskPriorityData.length > 0 ? (
                  <div className="h-[150px] sm:h-[180px]">
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
                  <div className="h-[150px] sm:h-[180px] flex items-center justify-center text-muted-foreground text-[10px] sm:text-sm">
                    No data
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className="glass">
              <CardHeader className="pb-1.5">
                <CardTitle className="text-[10px] sm:text-sm">Projects</CardTitle>
              </CardHeader>
              <CardContent>
                {projectStatusData.length > 0 ? (
                  <div className="h-[150px] sm:h-[180px]">
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
                  <div className="h-[150px] sm:h-[180px] flex items-center justify-center text-muted-foreground text-[10px] sm:text-sm">
                    No data
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className="glass">
              <CardHeader className="pb-1.5">
                <CardTitle className="text-[10px] sm:text-sm">Task Overview</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-1.5">
                  <div className="rounded border border-border/60 p-1.5 text-center">
                    <p className="text-lg font-bold sm:text-xl">{metrics.taskTodo}</p>
                    <p className="text-[10px] text-muted-foreground">To Do</p>
                  </div>
                  <div className="rounded border border-border/60 p-1.5 text-center">
                    <p className="text-lg font-bold text-blue-500 sm:text-xl">{metrics.taskInProgress}</p>
                    <p className="text-[10px] text-muted-foreground">In Progress</p>
                  </div>
                  <div className="rounded border border-border/60 p-1.5 text-center">
                    <p className="text-lg font-bold text-green-500 sm:text-xl">{metrics.taskDone}</p>
                    <p className="text-[10px] text-muted-foreground">Done</p>
                  </div>
                  <div className="rounded border border-border/60 p-1.5 text-center">
                    <p className="text-lg font-bold text-red-500 sm:text-xl">{overdueTasks}</p>
                    <p className="text-[10px] text-muted-foreground">Overdue</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
            <Card className="glass">
              <CardHeader className="pb-1.5 flex flex-row items-center justify-between">
                <CardTitle className="text-xs flex items-center gap-1">
                  <Calendar className="h-3 w-3" /> Upcoming Deadlines
                </CardTitle>
                <Link href="/projects" className="text-[10px] text-primary hover:underline">
                  View all
                </Link>
              </CardHeader>
              <CardContent className="space-y-1.5">
                {nextDeadlines.length === 0 ? (
                  <p className="text-xs text-muted-foreground py-3 text-center">No upcoming deadlines.</p>
                ) : (
                  nextDeadlines.map((project) => (
                    <Link
                      key={project.id}
                      href={`/projects/${project.id}`}
                      className="flex items-center justify-between rounded border border-border/60 px-1.5 py-1 hover:border-primary/50 transition-colors"
                    >
                      <div className="flex items-center gap-1.5 min-w-0">
                        <Badge
                          variant={
                            project.status === "active"
                              ? "default"
                              : project.status === "completed"
                              ? "secondary"
                              : "outline"
                          }
                          className="text-[9px] px-1 py-0 capitalize shrink-0"
                        >
                          {project.status}
                        </Badge>
                        <span className="text-xs truncate">{project.name}</span>
                      </div>
                      <span className={`text-[10px] whitespace-nowrap ${getUrgencyClass(project.deadline)}`}>
                        {formatDaysUntil(project.deadline)}
                      </span>
                    </Link>
                  ))
                )}
              </CardContent>
            </Card>

            <Card className="glass">
              <CardHeader className="pb-1.5 flex flex-row items-center justify-between">
                <CardTitle className="text-xs flex items-center gap-1">
                  <Clock className="h-3 w-3" /> Tasks Due Soon
                </CardTitle>
                <Link href="/tasks" className="text-[10px] text-primary hover:underline">
                  View all
                </Link>
              </CardHeader>
              <CardContent className="space-y-1.5">
                {upcomingTasks.length === 0 ? (
                  <p className="text-xs text-muted-foreground py-3 text-center">No tasks due soon.</p>
                ) : (
                  upcomingTasks.map((task) => (
                    <Link
                      key={task.id}
                      href={`/tasks?status=in-progress`}
                      className="flex items-center justify-between rounded border border-border/60 px-1.5 py-1 hover:border-primary/50 transition-colors"
                    >
                      <div className="flex items-center gap-1.5 min-w-0">
                        <Badge
                          variant={
                            task.priority === "urgent"
                              ? "destructive"
                              : task.priority === "high"
                              ? "destructive"
                              : task.priority === "medium"
                              ? "outline"
                              : "secondary"
                          }
                          className="text-[9px] px-1 py-0 capitalize shrink-0"
                        >
                          {task.priority}
                        </Badge>
                        <span className="text-xs truncate">{task.title}</span>
                      </div>
                      <span className={`text-[10px] whitespace-nowrap ${getUrgencyClass(task.due_date)}`}>
                        {formatDaysUntil(task.due_date)}
                      </span>
                    </Link>
                  ))
                )}
              </CardContent>
            </Card>

            <Card className="glass">
              <CardHeader className="pb-1.5">
                <CardTitle className="text-xs flex items-center gap-1">
                  <Users className="h-3 w-3" /> Team Workload
                </CardTitle>
                <Link href="/team" className="text-[10px] text-primary hover:underline">
                  View all
                </Link>
              </CardHeader>
              <CardContent className="space-y-1.5">
                {teamWorkload.length === 0 ? (
                  <p className="text-xs text-muted-foreground py-3 text-center">No assigned tasks.</p>
                ) : (
                  teamWorkload.map((member) => (
                    <Link
                      key={member.id}
                      href={`/team/${member.id}`}
                      className="rounded border border-border/60 px-1.5 py-1 hover:border-primary/50 transition-colors block"
                    >
                      <div className="flex items-center justify-between mb-0.5">
                        <span className="text-xs truncate font-medium">{member.name}</span>
                        <span className="text-[10px] text-muted-foreground">{member.role}</span>
                      </div>
                      <div className="flex gap-1 text-[10px]">
                        <span className="text-gray-500">{member.todo} todo</span>
                        <span className="text-blue-500">{member.inProgress} active</span>
                        <span className="text-green-500">{member.done} done</span>
                        <span className="ml-auto font-medium">{member.total} total</span>
                      </div>
                    </Link>
                  ))
                )}
              </CardContent>
            </Card>

            <Card className="glass">
              <CardHeader className="pb-1.5">
                <CardTitle className="text-xs flex items-center gap-1">
                  <AlertCircle className="h-3 w-3 text-red-500" /> Overdue Items
                </CardTitle>
                <Link href="/tasks?filter=overdue" className="text-[10px] text-primary hover:underline">
                  View all
                </Link>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">Overdue Projects</span>
                  <span className="font-semibold text-red-500">
                    {nextDeadlines.filter(p => {
                      const days = getDaysUntil(p.deadline)
                      return days !== null && days < 0
                    }).length}
                  </span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">Overdue Tasks</span>
                  <span className="font-semibold text-red-500">{overdueTasks}</span>
                </div>
                <div className="border-t pt-1.5 mt-1.5">
                  <p className="text-[10px] text-muted-foreground mb-1.5">Needs Attention</p>
                  {overdueTasks > 0 || nextDeadlines.filter(p => {
                    const days = getDaysUntil(p.deadline)
                    return days !== null && days < 0
                  }).length > 0 ? (
                    <div className="space-y-1">
                      {nextDeadlines
                        .filter(p => {
                          const days = getDaysUntil(p.deadline)
                          return days !== null && days < 0
                        })
                        .slice(0, 2)
                        .map(p => (
                          <div key={p.id} className="text-[10px] text-red-500 truncate">
                            • {p.name} ({formatDaysUntil(p.deadline)})
                          </div>
                        ))}
                      {filteredTasks
                        .filter(t => {
                          if (!t.due_date || t.status === "done") return false
                          const days = getDaysUntil(t.due_date)
                          return days !== null && days < 0
                        })
                        .slice(0, 2)
                        .map(t => (
                          <div key={t.id} className="text-[10px] text-red-500 truncate">
                            • {t.title} ({formatDaysUntil(t.due_date)})
                          </div>
                        ))}
                    </div>
                  ) : (
                    <p className="text-[10px] text-green-500">All caught up!</p>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-2 sm:gap-3 md:grid-cols-2">
            <Card className="glass">
              <CardHeader className="pb-1.5">
                <CardTitle className="text-[10px] sm:text-sm flex items-center gap-1">
                  <TrendingUp className="h-3 w-3 sm:h-3.5 sm:w-3.5" /> Project Trends
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="flex items-center justify-between text-xs sm:text-sm">
                  <span className="text-muted-foreground">Active Projects</span>
                  <span className="font-semibold">{metrics.activeProjects}</span>
                </div>
                <div className="flex items-center justify-between text-xs sm:text-sm">
                  <span className="text-muted-foreground">On Hold</span>
                  <span className="font-semibold text-amber-500">{metrics.onHoldProjects}</span>
                </div>
                <div className="flex items-center justify-between text-xs sm:text-sm">
                  <span className="text-muted-foreground">Completed</span>
                  <span className="font-semibold text-green-500">{metrics.completedProjects}</span>
                </div>
                <div className="border-t pt-1.5 mt-1.5">
                  <div className="flex items-center justify-between text-xs sm:text-sm">
                    <span className="text-muted-foreground">Completion Rate</span>
                    <span className="font-bold text-base sm:text-lg">{metrics.completionRate}%</span>
                  </div>
                  <div className="w-full bg-secondary rounded-full h-1.5 sm:h-2 mt-0.5 sm:mt-1">
                    <div
                      className="bg-green-500 h-1.5 sm:h-2 rounded-full transition-all"
                      style={{ width: `${metrics.completionRate}%` }}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="glass">
              <CardHeader className="pb-1.5">
                <CardTitle className="text-[10px] sm:text-sm flex items-center gap-1">
                  <AlertCircle className="h-3 w-3 sm:h-3.5 sm:w-3.5" /> Task Health
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="flex items-center justify-between text-xs sm:text-sm">
                  <span className="text-muted-foreground">Total Tasks</span>
                  <span className="font-semibold">{filteredTasks.length}</span>
                </div>
                <div className="flex items-center justify-between text-xs sm:text-sm">
                  <span className="text-muted-foreground">Overdue</span>
                  <span className="font-semibold text-red-500">{overdueTasks}</span>
                </div>
                <div className="flex items-center justify-between text-xs sm:text-sm">
                  <span className="text-muted-foreground">In Progress</span>
                  <span className="font-semibold text-blue-500">{metrics.taskInProgress}</span>
                </div>
                <div className="border-t pt-1.5 mt-1.5">
                  <div className="flex items-center justify-between text-xs sm:text-sm">
                    <span className="text-muted-foreground">Task Completion</span>
                    <span className="font-bold text-base sm:text-lg">{metrics.taskCompletion}%</span>
                  </div>
                  <div className="w-full bg-secondary rounded-full h-1.5 sm:h-2 mt-0.5 sm:mt-1">
                    <div
                      className="bg-blue-500 h-1.5 sm:h-2 rounded-full transition-all"
                      style={{ width: `${metrics.taskCompletion}%` }}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </div>
  )
}
