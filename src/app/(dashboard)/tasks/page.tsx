"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import {
  DndContext,
  DragOverlay,
  closestCorners,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  useDroppable,
  type DragStartEvent,
  type DragEndEvent,
  type DragOverEvent,
} from "@dnd-kit/core"
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import {
  CalendarDays,
  Check,
  ArrowUp,
  ArrowDown,
  ArrowUpDown,
  ChevronsUpDown,
  Clock3,
  ChevronLeft,
  ChevronRight,
  GripVertical,
  LayoutGrid,
  List,
  Loader2,
  MoreHorizontal,
  Pencil,
  Plus,
  SlidersHorizontal,
  Trash2,
  X,
  Calendar as CalendarIcon,
} from "lucide-react"

import { useUser } from "@/components/user-provider"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { cn } from "@/lib/utils"

type Task = {
  id: string
  project_id: string
  title: string
  description: string | null
  status: "todo" | "in-progress" | "done"
  priority: "low" | "medium" | "high" | "urgent"
  assignee_member_id: string | null
  due_date: string | null
  position?: number
}

type ViewMode = "kanban" | "list" | "timeline" | "calendar"
type TimelineBucket = "overdue" | "today" | "upcoming" | "later" | "done" | "no_due"

function isViewMode(value: string): value is ViewMode {
  return value === "kanban" || value === "list" || value === "timeline" || value === "calendar"
}

type Project = {
  id: string
  name: string
}

type Member = {
  id: string
  name: string
  user_id?: string | null
}

type ListColumnId = "task" | "project" | "status" | "priority" | "assignee" | "dueDate"

const priorityConfig = {
  low: { label: "Low", variant: "secondary" as const },
  medium: { label: "Medium", variant: "outline" as const },
  high: { label: "High", variant: "default" as const },
  urgent: { label: "Urgent", variant: "destructive" as const },
}

const statusConfig = {
  todo: { label: "Todo", color: "bg-zinc-500" },
  "in-progress": { label: "In Progress", color: "bg-blue-500" },
  done: { label: "Done", color: "bg-green-500" },
}

const columns: { id: Task["status"]; title: string }[] = [
  { id: "todo", title: "To Do" },
  { id: "in-progress", title: "In Progress" },
  { id: "done", title: "Done" },
]

function getProjectName(projects: Project[], projectId: string) {
  return projects.find((p) => p.id === projectId)?.name || "Unknown"
}

function getMemberName(members: Member[], memberId: string | null) {
  if (!memberId) return "Unassigned"
  return members.find((m) => m.id === memberId)?.name || "Unknown"
}

function isOverdue(dueDate: string | null) {
  if (!dueDate) return false
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const due = new Date(dueDate)
  return due < today
}

function formatDate(dateStr: string | null) {
  if (!dateStr) return "-"
  const date = new Date(dateStr)
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" })
}

function getDueInLabel(dueDate: string | null, status: Task["status"]) {
  if (!dueDate) {
    return { label: "No due date", bucket: "no_due" as TimelineBucket, tone: "text-muted-foreground" }
  }

  const due = new Date(dueDate)
  if (Number.isNaN(due.getTime())) {
    return { label: "Invalid due date", bucket: "no_due" as TimelineBucket, tone: "text-muted-foreground" }
  }

  const today = new Date()
  today.setHours(0, 0, 0, 0)
  due.setHours(0, 0, 0, 0)

  const diffDays = Math.round((due.getTime() - today.getTime()) / 86400000)

  if (status === "done") {
    return {
      label: diffDays >= 0 ? "Completed" : "Completed (was overdue)",
      bucket: "done" as TimelineBucket,
      tone: "text-emerald-600 dark:text-emerald-400",
    }
  }

  if (diffDays < 0) {
    return {
      label: `Overdue by ${Math.abs(diffDays)} day${Math.abs(diffDays) === 1 ? "" : "s"}`,
      bucket: "overdue" as TimelineBucket,
      tone: "text-destructive",
    }
  }

  if (diffDays === 0) {
    return { label: "Due today", bucket: "today" as TimelineBucket, tone: "text-orange-600 dark:text-orange-400" }
  }

  if (diffDays <= 7) {
    return {
      label: `Due in ${diffDays} day${diffDays === 1 ? "" : "s"}`,
      bucket: "upcoming" as TimelineBucket,
      tone: "text-blue-600 dark:text-blue-400",
    }
  }

  return {
    label: `Due in ${diffDays} days`,
    bucket: "later" as TimelineBucket,
    tone: "text-muted-foreground",
  }
}

function getDateKey(date: Date): string {
  return date.toISOString().split("T")[0]
}

interface TaskCardProps {
  task: Task
  projects: Project[]
  canEdit: boolean
  isDragging?: boolean
  onEdit: () => void
  onDelete: () => void
  onStatusChange: (status: Task["status"]) => void
}

function TaskCard({ task, projects, canEdit, isDragging, onEdit, onDelete, onStatusChange }: TaskCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging: isSortableDragging,
  } = useSortable({ id: task.id, disabled: !canEdit })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  }

  const isCurrentlyDragging = isDragging || isSortableDragging

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "group relative rounded-lg border bg-card p-3 shadow-sm transition-all hover:shadow-md",
        isCurrentlyDragging && "opacity-50 ring-2 ring-primary ring-offset-2"
      )}
    >
      <div className="flex items-start gap-2">
        {canEdit ? (
          <button
            {...attributes}
            {...listeners}
            className="mt-0.5 cursor-grab active:cursor-grabbing opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-foreground"
            onClick={(e) => e.stopPropagation()}
          >
            <GripVertical className="h-4 w-4" />
          </button>
        ) : (
          <span className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
        )}
        
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <p className="font-medium text-sm line-clamp-2 cursor-pointer" onClick={(e) => {
              e.stopPropagation()
              onEdit()
            }}>{task.title}</p>
            <DropdownMenu>
              <DropdownMenuTrigger asChild onClick={(e: React.MouseEvent) => e.stopPropagation()}>
                <button
                  data-dropdown
                  className="opacity-0 group-hover:opacity-100 transition-opacity p-1 hover:bg-accent rounded"
                >
                  <MoreHorizontal className="h-4 w-4" />
                </button>
              </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => onEdit()}>
                    <Pencil className="mr-2 h-4 w-4" />
                    View
                  </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={() => onStatusChange("todo")}
                  className={task.status === "todo" ? "bg-accent" : ""}
                >
                  Move to To Do
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => onStatusChange("in-progress")}
                  className={task.status === "in-progress" ? "bg-accent" : ""}
                >
                  Move to In Progress
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => onStatusChange("done")}
                  className={task.status === "done" ? "bg-accent" : ""}
                >
                  Move to Done
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={() => onDelete()}
                  className="text-destructive focus:text-destructive"
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          <div className="flex flex-wrap items-center gap-1.5 mt-2">
            <Badge variant={priorityConfig[task.priority].variant} className="text-[10px] px-1.5 py-0">
              {priorityConfig[task.priority].label}
            </Badge>
            <Badge className={cn("text-[10px] px-1.5 py-0", statusConfig[task.status].color)}>
              {statusConfig[task.status].label}
            </Badge>
          </div>

          <div className="flex items-center justify-between mt-2 text-xs text-muted-foreground">
            <span className="truncate">{getProjectName(projects, task.project_id)}</span>
            {task.due_date && (
              <span className={cn(isOverdue(task.due_date) && task.status !== "done" && "text-destructive font-medium")}>
                {formatDate(task.due_date)}
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

interface KanbanColumnProps {
  id: Task["status"]
  title: string
  tasks: Task[]
  projects: Project[]
  canEdit: boolean
  onEditTask: (task: Task) => void
  onDeleteTask: (taskId: string) => void
  onStatusChange: (taskId: string, status: Task["status"]) => void
}

function KanbanColumn({ id, title, tasks, projects, canEdit, onEditTask, onDeleteTask, onStatusChange }: KanbanColumnProps) {
  const { setNodeRef, isOver } = useDroppable({ id })
  
  return (
    <div className="flex flex-col min-h-0">
      <div className="flex items-center justify-between px-3 py-2 border-b bg-muted/30 rounded-t-lg">
        <div className="flex items-center gap-2">
          <h3 className="font-semibold text-sm">{title}</h3>
          <Badge variant="secondary" className="text-xs">{tasks.length}</Badge>
        </div>
      </div>
      <div 
        ref={setNodeRef}
        className={cn(
          "flex-1 p-2 space-y-2 overflow-y-auto bg-muted/10 min-h-[200px] rounded-b-lg transition-colors",
          isOver && "bg-primary/10"
        )}
      >
        <SortableContext items={tasks.map(t => t.id)} strategy={verticalListSortingStrategy}>
          {tasks.map((task) => (
            <TaskCard
              key={task.id}
              task={task}
              projects={projects}
              canEdit={canEdit}
              onEdit={() => onEditTask(task)}
              onDelete={() => onDeleteTask(task.id)}
              onStatusChange={(status) => onStatusChange(task.id, status)}
            />
          ))}
        </SortableContext>
        {tasks.length === 0 && (
          <div className="flex items-center justify-center h-20 text-xs text-muted-foreground border-2 border-dashed rounded-lg">
            Drop tasks here
          </div>
        )}
      </div>
    </div>
  )
}

export default function TasksPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const projectQueryId = searchParams.get("projectId")
  const taskQueryId = searchParams.get("taskId")
  const { profile, loading: userLoading } = useUser()
  const canEdit = profile?.role === "admin" || profile?.role === "member"

  const [tasks, setTasks] = useState<Task[]>([])
  const [projects, setProjects] = useState<Project[]>([])
  const [members, setMembers] = useState<Member[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [projectFilter, setProjectFilter] = useState<string[]>(projectQueryId ? [projectQueryId] : [])
  const [projectFilterOpen, setProjectFilterOpen] = useState(false)
  const [priorityFilter, setPriorityFilter] = useState<string[]>(searchParams.get("priority") ? [searchParams.get("priority")!] : [])
  const [assigneeFilter, setAssigneeFilter] = useState<string[]>(searchParams.get("assigneeMemberId") ? [searchParams.get("assigneeMemberId")!] : [])
  const [assigneeFilterOpen, setAssigneeFilterOpen] = useState(false)
  const [dueFilter, setDueFilter] = useState<string[]>([])
  const [myTasksOnly, setMyTasksOnly] = useState(() => {
    if (typeof window === "undefined") return true
    const stored = sessionStorage.getItem("projecthub-tasks-my-only")
    if (stored === "true") return true
    if (stored === "false") return false
    return true
  })
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false)
  const [search, setSearch] = useState(searchParams.get("q") || "")
  const [debouncedSearch, setDebouncedSearch] = useState(searchParams.get("q") || "")
  
  const [viewMode, setViewMode] = useState<ViewMode>(() => {
    if (typeof window === "undefined") return "kanban"
    const stored = sessionStorage.getItem("projecthub-tasks-view-mode")
    return stored && isViewMode(stored) ? stored : "kanban"
  })
  const [listSortColumn, setListSortColumn] = useState<ListColumnId>("dueDate")
  const [listSortDirection, setListSortDirection] = useState<"asc" | "desc">("asc")
  const [listPage, setListPage] = useState(1)
  const [visibleListColumns, setVisibleListColumns] = useState<Record<ListColumnId, boolean>>({
    task: true,
    project: true,
    status: true,
    priority: true,
    assignee: true,
    dueDate: true,
  })
  const [calendarDate, setCalendarDate] = useState<Date>(new Date())
  const [calendarSelectedDate, setCalendarSelectedDate] = useState<Date | undefined>(new Date())
  const [timelineExtra, setTimelineExtra] = useState<{ later: Task[]; done: Task[] }>({ later: [], done: [] })
  const [timelineHasMore, setTimelineHasMore] = useState<{ later: boolean; done: boolean }>({ later: true, done: true })
  const [timelineLoadingBucket, setTimelineLoadingBucket] = useState<{ later: boolean; done: boolean }>({
    later: false,
    done: false,
  })

  const [addDialogOpen, setAddDialogOpen] = useState(false)
  const [newProjectId, setNewProjectId] = useState("")
  const [newTitle, setNewTitle] = useState("")
  const [newDescription, setNewDescription] = useState("")
  const [newPriority, setNewPriority] = useState<Task["priority"]>("medium")
  const [newAssignee, setNewAssignee] = useState("")
  const [newDueDate, setNewDueDate] = useState("")
  const [saving, setSaving] = useState(false)

  const [previewTask, setPreviewTask] = useState<Task | null>(null)
  const [editMode, setEditMode] = useState(false)
  const [editTitle, setEditTitle] = useState("")
  const [editDescription, setEditDescription] = useState("")
  const [editPriority, setEditPriority] = useState<Task["priority"]>("medium")
  const [editAssignee, setEditAssignee] = useState("")
  const [editDueDate, setEditDueDate] = useState("")
  const [editSaving, setEditSaving] = useState(false)

  const [activeId, setActiveId] = useState<string | null>(null)
  const handledTaskQueryRef = useRef<string | null>(null)

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  )

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 300)
    return () => clearTimeout(timer)
  }, [search])

  useEffect(() => {
    if (typeof window === "undefined") return
    sessionStorage.setItem("projecthub-tasks-my-only", String(myTasksOnly))
  }, [myTasksOnly])

  useEffect(() => {
    if (typeof window === "undefined") return
    sessionStorage.setItem("projecthub-tasks-view-mode", viewMode)
  }, [viewMode])

  useEffect(() => {
    if (userLoading) return
    if (profile) return

    setViewMode("kanban")
    if (typeof window !== "undefined") {
      sessionStorage.removeItem("projecthub-tasks-view-mode")
    }
  }, [profile, userLoading])

  useEffect(() => {
    if (!projectQueryId) return

    setProjectFilter((prev) => (prev.length === 1 && prev[0] === projectQueryId ? prev : [projectQueryId]))
    setMyTasksOnly(false)
  }, [projectQueryId])

  const fetchTasks = useCallback(async () => {
    const params = new URLSearchParams()
    if (projectFilter.length > 0) params.set("projectId", projectFilter.join(","))
    if (priorityFilter.length > 0) params.set("priority", priorityFilter.join(","))
    if (assigneeFilter.length > 0) params.set("assigneeMemberId", assigneeFilter.join(","))
    if (dueFilter.length > 0 && dueFilter[0] === "overdue") {
      const now = new Date()
      const yyyy = now.getFullYear()
      const mm = String(now.getMonth() + 1).padStart(2, "0")
      const dd = String(now.getDate()).padStart(2, "0")
      params.set("dueBefore", `${yyyy}-${mm}-${dd}`)
    } else if (dueFilter.length > 0 && dueFilter[0] === "due_7d") {
      const now = new Date()
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
      const in7 = new Date(now)
      in7.setDate(in7.getDate() + 7)
      const fromY = today.getFullYear()
      const fromM = String(today.getMonth() + 1).padStart(2, "0")
      const fromD = String(today.getDate()).padStart(2, "0")
      const yyyy = in7.getFullYear()
      const mm = String(in7.getMonth() + 1).padStart(2, "0")
      const dd = String(in7.getDate()).padStart(2, "0")
      params.set("dueFrom", `${fromY}-${fromM}-${fromD}`)
      params.set("dueBefore", `${yyyy}-${mm}-${dd}`)
    }
    if (debouncedSearch) params.set("q", debouncedSearch)
    if (viewMode === "timeline") params.set("timeline", "1")

    const suffix = params.toString() ? `?${params.toString()}` : ""
    const response = await fetch(`/api/tasks${suffix}`, { cache: "no-store" })
    const data = await response.json()
    if (!response.ok) {
      throw new Error(data?.error || "Failed to load tasks")
    }
    return Array.isArray(data) ? (data as Task[]) : []
  }, [projectFilter, priorityFilter, assigneeFilter, dueFilter, debouncedSearch, viewMode])

  const loadAll = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [projectsRes, membersRes, tasksData] = await Promise.all([
        fetch("/api/projects", { cache: "no-store" }),
        fetch("/api/members", { cache: "no-store" }),
        fetchTasks(),
      ])

      const [projectsData, membersData] = await Promise.all([
        projectsRes.json(),
        membersRes.json(),
      ])

      setProjects(Array.isArray(projectsData) ? projectsData : [])
      setMembers(Array.isArray(membersData) ? membersData : [])
      setTasks(tasksData)

      if (!newProjectId && Array.isArray(projectsData) && projectsData[0]?.id) {
        setNewProjectId(projectsData[0].id)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load tasks")
      setTasks([])
    } finally {
      setLoading(false)
    }
  }, [fetchTasks, newProjectId])

  useEffect(() => {
    if (!userLoading) {
      loadAll()
    }
  }, [userLoading, loadAll])

  useEffect(() => {
    if (projectFilter.length > 0) {
      setNewProjectId(projectFilter[0])
    }
  }, [projectFilter])

  useEffect(() => {
    setListPage(1)
  }, [projectFilter, priorityFilter, assigneeFilter, dueFilter, debouncedSearch, myTasksOnly, viewMode])

  const grouped = useMemo(() => {
    const currentMemberId = members.find((member) => member.user_id === profile?.id)?.id || null
    const enforceMyTasksOnly = myTasksOnly && Boolean(currentMemberId)

    const filteredTasks = tasks.filter((task) => {
      if (enforceMyTasksOnly && task.assignee_member_id !== currentMemberId) {
        return false
      }
      if (projectFilter.length > 0 && !projectFilter.includes(task.project_id)) {
        return false
      }
      if (priorityFilter.length > 0 && !priorityFilter.includes(task.priority)) {
        return false
      }
      if (assigneeFilter.length > 0 && task.assignee_member_id && !assigneeFilter.includes(task.assignee_member_id)) {
        return false
      }
      if (dueFilter.length > 0 && dueFilter[0] !== "all") {
        if (!task.due_date) return false
        const dueDate = new Date(task.due_date)
        const now = new Date()
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
        const plus7 = new Date(today)
        plus7.setDate(plus7.getDate() + 7)
        
        if (Number.isNaN(dueDate.getTime())) return false
        if (dueFilter[0] === "overdue") {
          return dueDate < today && task.status !== "done"
        }
        if (dueFilter[0] === "due_7d") {
          return dueDate >= today && dueDate <= plus7
        }
      }
      return true
    })

    const sortByPosition = (items: Task[]) =>
      [...items].sort((a, b) => (a.position || 0) - (b.position || 0))

    return {
      todo: sortByPosition(filteredTasks.filter((task) => task.status === "todo")),
      "in-progress": sortByPosition(filteredTasks.filter((task) => task.status === "in-progress")),
      done: sortByPosition(filteredTasks.filter((task) => task.status === "done")),
    }
  }, [tasks, projectFilter, priorityFilter, assigneeFilter, dueFilter, myTasksOnly, profile?.id, members])

  const hasActiveFilters =
    projectFilter.length > 0 ||
    priorityFilter.length > 0 ||
    assigneeFilter.length > 0 ||
    dueFilter.length > 0 ||
    myTasksOnly ||
    debouncedSearch.trim().length > 0

  const listTasks = useMemo(() => Object.values(grouped).flat(), [grouped])

  const timelineTasks = useMemo(() => {
    return [...listTasks].sort((a, b) => {
      if (!a.due_date && !b.due_date) return a.title.localeCompare(b.title)
      if (!a.due_date) return 1
      if (!b.due_date) return -1

      const aTs = new Date(a.due_date).getTime()
      const bTs = new Date(b.due_date).getTime()
      if (Number.isNaN(aTs) && Number.isNaN(bTs)) return a.title.localeCompare(b.title)
      if (Number.isNaN(aTs)) return 1
      if (Number.isNaN(bTs)) return -1
      return aTs - bTs
    })
  }, [listTasks])

  const timelineBaseBucketCounts = useMemo(() => {
    return timelineTasks.reduce(
      (acc, task) => {
        const dueInfo = getDueInLabel(task.due_date, task.status)
        if (dueInfo.bucket === "later") acc.later += 1
        if (dueInfo.bucket === "done") acc.done += 1
        return acc
      },
      { later: 0, done: 0 }
    )
  }, [timelineTasks])

  useEffect(() => {
    setTimelineExtra({ later: [], done: [] })
    setTimelineHasMore({
      later: timelineBaseBucketCounts.later >= 5,
      done: timelineBaseBucketCounts.done >= 5,
    })
    setTimelineLoadingBucket({ later: false, done: false })
  }, [timelineBaseBucketCounts.later, timelineBaseBucketCounts.done, viewMode])

  const loadMoreTimelineBucket = useCallback(
    async (bucket: "later" | "done") => {
      if (timelineLoadingBucket[bucket] || !timelineHasMore[bucket]) return

      setTimelineLoadingBucket((prev) => ({ ...prev, [bucket]: true }))

      try {
        const params = new URLSearchParams()
        if (projectFilter.length > 0) params.set("projectId", projectFilter.join(","))
        if (priorityFilter.length > 0) params.set("priority", priorityFilter.join(","))
        if (assigneeFilter.length > 0) params.set("assigneeMemberId", assigneeFilter.join(","))
        if (dueFilter.length > 0 && dueFilter[0] === "overdue") {
          const now = new Date()
          const yyyy = now.getFullYear()
          const mm = String(now.getMonth() + 1).padStart(2, "0")
          const dd = String(now.getDate()).padStart(2, "0")
          params.set("dueBefore", `${yyyy}-${mm}-${dd}`)
        } else if (dueFilter.length > 0 && dueFilter[0] === "due_7d") {
          const now = new Date()
          const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
          const in7 = new Date(now)
          in7.setDate(in7.getDate() + 7)
          const fromY = today.getFullYear()
          const fromM = String(today.getMonth() + 1).padStart(2, "0")
          const fromD = String(today.getDate()).padStart(2, "0")
          const yyyy = in7.getFullYear()
          const mm = String(in7.getMonth() + 1).padStart(2, "0")
          const dd = String(in7.getDate()).padStart(2, "0")
          params.set("dueFrom", `${fromY}-${fromM}-${fromD}`)
          params.set("dueBefore", `${yyyy}-${mm}-${dd}`)
        }
        if (debouncedSearch) params.set("q", debouncedSearch)

        params.set("timeline", "1")
        params.set("timelineBucket", bucket)

        const currentOffset = 5 + timelineExtra[bucket].length
        params.set("timelineOffset", String(currentOffset))
        params.set("timelineLimit", "5")

        const response = await fetch(`/api/tasks?${params.toString()}`, { cache: "no-store" })
        const data = await response.json().catch(() => null)

        if (!response.ok || !data) {
          throw new Error(data?.error || "Failed to load more timeline tasks")
        }

        const nextTasks = Array.isArray(data.tasks) ? (data.tasks as Task[]) : []
        setTimelineExtra((prev) => ({
          ...prev,
          [bucket]: [...prev[bucket], ...nextTasks],
        }))
        setTimelineHasMore((prev) => ({
          ...prev,
          [bucket]: Boolean(data.hasMore),
        }))
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load more timeline tasks")
      } finally {
        setTimelineLoadingBucket((prev) => ({ ...prev, [bucket]: false }))
      }
    },
    [
      assigneeFilter,
      debouncedSearch,
      dueFilter,
      priorityFilter,
      projectFilter,
      timelineExtra,
      timelineHasMore,
      timelineLoadingBucket,
    ]
  )

  const sortedListTasks = useMemo(() => {
    const rows = [...listTasks]

    rows.sort((a, b) => {
      const factor = listSortDirection === "asc" ? 1 : -1

      if (listSortColumn === "task") {
        return a.title.localeCompare(b.title) * factor
      }
      if (listSortColumn === "project") {
        return getProjectName(projects, a.project_id).localeCompare(getProjectName(projects, b.project_id)) * factor
      }
      if (listSortColumn === "status") {
        return a.status.localeCompare(b.status) * factor
      }
      if (listSortColumn === "priority") {
        const rank: Record<Task["priority"], number> = { low: 1, medium: 2, high: 3, urgent: 4 }
        return (rank[a.priority] - rank[b.priority]) * factor
      }
      if (listSortColumn === "assignee") {
        return getMemberName(members, a.assignee_member_id).localeCompare(getMemberName(members, b.assignee_member_id)) * factor
      }

      const aTime = a.due_date ? new Date(a.due_date).getTime() : Number.POSITIVE_INFINITY
      const bTime = b.due_date ? new Date(b.due_date).getTime() : Number.POSITIVE_INFINITY
      return (aTime - bTime) * factor
    })

    return rows
  }, [listSortColumn, listSortDirection, listTasks, members, projects])

  const totalListPages = Math.max(1, Math.ceil(sortedListTasks.length / 12))

  const pagedListTasks = useMemo(() => {
    const start = (listPage - 1) * 12
    return sortedListTasks.slice(start, start + 12)
  }, [listPage, sortedListTasks])

  useEffect(() => {
    if (listPage > totalListPages) {
      setListPage(totalListPages)
    }
  }, [listPage, totalListPages])

  const addTask = async () => {
    if (!canEdit || !newProjectId || !newTitle.trim()) return
    setSaving(true)
    setError(null)
    try {
      const response = await fetch("/api/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          project_id: newProjectId,
          title: newTitle.trim(),
          description: newDescription.trim() || null,
          priority: newPriority,
          assignee_member_id: newAssignee || null,
          due_date: newDueDate || null,
        }),
      })
      const data = await response.json()
      if (!response.ok) {
        setError(data?.error || "Failed to create task")
        return
      }
      setTasks((prev) => [...prev, data])
      setNewTitle("")
      setNewDescription("")
      setNewPriority("medium")
      setNewAssignee("")
      setNewDueDate("")
      setAddDialogOpen(false)
    } catch {
      setError("Failed to create task")
    } finally {
      setSaving(false)
    }
  }

  const updateTask = async (taskId: string, payload: Partial<Task>) => {
    const previous = tasks
    setTasks((prev) => prev.map((task) => (task.id === taskId ? { ...task, ...payload } : task)))
    const response = await fetch(`/api/tasks/${taskId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    })
    if (!response.ok) {
      setTasks(previous)
      const data = await response.json().catch(() => ({}))
      setError(data?.error || "Failed to update task")
    }
  }

  const reorderTasks = async (updates: Array<{ id: string; status: Task["status"]; position: number }>) => {
    const response = await fetch("/api/tasks/reorder", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ updates }),
    })

    if (!response.ok) {
      const data = await response.json().catch(() => ({}))
      throw new Error(data?.error || "Failed to persist task ordering")
    }
  }

  const removeTask = async (taskId: string) => {
    const previous = tasks
    setTasks((prev) => prev.filter((task) => task.id !== taskId))
    const response = await fetch(`/api/tasks/${taskId}`, { method: "DELETE" })
    if (!response.ok) {
      setTasks(previous)
      const data = await response.json().catch(() => ({}))
      setError(data?.error || "Failed to delete task")
    }
    setPreviewTask(null)
  }

  const handleDragStart = (event: DragStartEvent) => {
    if (!canEdit) return
    setActiveId(event.active.id as string)
  }

  const handleDragOver = (event: DragOverEvent) => {
    if (!canEdit) return
    void event
  }

  const handleDragEnd = async (event: DragEndEvent) => {
    if (!canEdit) {
      setActiveId(null)
      return
    }

    const { active, over } = event
    setActiveId(null)

    if (!over) return

    const activeId = active.id as string
    const overId = over.id as string

    if (activeId === overId) return

    const activeTask = tasks.find((t) => t.id === activeId)
    const overTask = tasks.find((t) => t.id === overId)
    const overColumn = columns.find((col) => col.id === overId)

    if (!activeTask) return

    const destinationStatus: Task["status"] =
      overColumn?.id || overTask?.status || activeTask.status

    const lanes: Record<Task["status"], Task[]> = {
      todo: tasks.filter((task) => task.status === "todo").sort((a, b) => (a.position || 0) - (b.position || 0)),
      "in-progress": tasks
        .filter((task) => task.status === "in-progress")
        .sort((a, b) => (a.position || 0) - (b.position || 0)),
      done: tasks.filter((task) => task.status === "done").sort((a, b) => (a.position || 0) - (b.position || 0)),
    }

    // Remove the active card from all lanes first to avoid duplicates.
    for (const lane of columns.map((col) => col.id)) {
      lanes[lane] = lanes[lane].filter((task) => task.id !== activeId)
    }

    const sourceStatus = activeTask.status
    const originalDestinationLane = tasks
      .filter((task) => task.status === destinationStatus)
      .sort((a, b) => (a.position || 0) - (b.position || 0))

    const destinationLane = [...lanes[destinationStatus]]
    if (overTask) {
      const overIndex = destinationLane.findIndex((task) => task.id === overTask.id)
      if (overIndex >= 0) {
        let insertIndex = overIndex

        if (sourceStatus === destinationStatus) {
          const sourceOriginalIndex = originalDestinationLane.findIndex((task) => task.id === activeId)
          const overOriginalIndex = originalDestinationLane.findIndex((task) => task.id === overTask.id)

          if (sourceOriginalIndex !== -1 && overOriginalIndex !== -1 && sourceOriginalIndex < overOriginalIndex) {
            insertIndex = overIndex + 1
          }
        }

        destinationLane.splice(insertIndex, 0, { ...activeTask, status: destinationStatus })
      } else {
        destinationLane.push({ ...activeTask, status: destinationStatus })
      }
    } else {
      destinationLane.push({ ...activeTask, status: destinationStatus })
    }
    lanes[destinationStatus] = destinationLane

    const laneUpdates = new Map<string, Partial<Task>>()
    for (const lane of columns.map((col) => col.id)) {
      lanes[lane].forEach((task, index) => {
        laneUpdates.set(task.id, {
          status: lane,
          position: index + 1,
        })
      })
    }

    const nextTasks = tasks.map((task) => {
      const update = laneUpdates.get(task.id)
      if (!update) return task
      return {
        ...task,
        status: update.status ?? task.status,
        position: update.position ?? task.position,
      }
    })

    setTasks(nextTasks)

    const changedTasks = nextTasks.filter((task) => {
      const previousTask = tasks.find((prev) => prev.id === task.id)
      if (!previousTask) return false

      const statusChanged = previousTask.status !== task.status
      const previousPosition = previousTask.position ?? 0
      const nextPosition = task.position ?? 0
      return statusChanged || previousPosition !== nextPosition
    })

    if (changedTasks.length === 0) {
      return
    }

    try {
      await reorderTasks(
        changedTasks.map((task) => ({
          id: task.id,
          status: task.status,
          position: task.position || 1,
        }))
      )
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to persist task ordering")
      await loadAll()
      return
    }
  }

  const openEditDialog = (task: Task) => {
    setPreviewTask(task)
    setEditMode(false)
    setEditTitle(task.title)
    setEditDescription(task.description || "")
    setEditPriority(task.priority)
    setEditAssignee(task.assignee_member_id || "")
    setEditDueDate(task.due_date || "")
  }

  const closePreviewDialog = useCallback(() => {
    setPreviewTask(null)
    setEditMode(false)

    if (!taskQueryId) return

    const params = new URLSearchParams(searchParams.toString())
    params.delete("taskId")
    const nextQuery = params.toString()
    router.replace(nextQuery ? `/tasks?${nextQuery}` : "/tasks", { scroll: false })
  }, [router, searchParams, taskQueryId])

  const saveEdit = async () => {
    if (!previewTask || !editTitle.trim()) return
    setEditSaving(true)
    await updateTask(previewTask.id, {
      title: editTitle.trim(),
      description: editDescription.trim() || null,
      priority: editPriority,
      assignee_member_id: editAssignee || null,
      due_date: editDueDate || null,
    })
    setPreviewTask((prev) => prev ? { ...prev, title: editTitle.trim(), description: editDescription.trim() || null, priority: editPriority, assignee_member_id: editAssignee || null, due_date: editDueDate || null } : null)
    setEditSaving(false)
    setEditMode(false)
  }

  useEffect(() => {
    if (!taskQueryId || tasks.length === 0) return
    if (handledTaskQueryRef.current === taskQueryId) return
    const match = tasks.find((task) => task.id === taskQueryId)
    if (match) {
      openEditDialog(match)
      handledTaskQueryRef.current = taskQueryId
    }
  }, [taskQueryId, tasks])

  useEffect(() => {
    if (!taskQueryId) {
      handledTaskQueryRef.current = null
    }
  }, [taskQueryId])

  const activeTask = useMemo(
    () => tasks.find((t) => t.id === activeId) || null,
    [tasks, activeId]
  )

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-start justify-between gap-3 sm:items-center sm:gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Tasks</h1>
          <p className="text-muted-foreground text-sm sm:text-base">Manage tasks across all projects.</p>

          <div className="mt-3 flex w-full items-center gap-1 rounded-md border p-0.5 sm:hidden">
            <Button
              variant={viewMode === "kanban" ? "default" : "ghost"}
              size="sm"
              onClick={() => setViewMode("kanban")}
              className={cn("h-8 flex-1 gap-1.5", viewMode !== "kanban" && "text-muted-foreground")}
            >
              <LayoutGrid className="h-4 w-4" />
              <span>Kanban</span>
            </Button>
            <Button
              variant={viewMode === "list" ? "default" : "ghost"}
              size="sm"
              onClick={() => setViewMode("list")}
              className={cn("h-8 flex-1 gap-1.5", viewMode !== "list" && "text-muted-foreground")}
            >
              <List className="h-4 w-4" />
              <span>List</span>
            </Button>
            <Button
              variant={viewMode === "timeline" ? "default" : "ghost"}
              size="sm"
              onClick={() => setViewMode("timeline")}
              className={cn("h-8 flex-1 gap-1.5", viewMode !== "timeline" && "text-muted-foreground")}
            >
              <Clock3 className="h-4 w-4" />
              <span>Timeline</span>
            </Button>
            <Button
              variant={viewMode === "calendar" ? "default" : "ghost"}
              size="sm"
              onClick={() => setViewMode("calendar")}
              className={cn("h-8 flex-1 gap-1.5", viewMode !== "calendar" && "text-muted-foreground")}
            >
              <CalendarDays className="h-4 w-4" />
              <span>Calendar</span>
            </Button>
          </div>
        </div>
        
        <div className="flex shrink-0 flex-col items-end gap-2">
          {canEdit && (
            <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
              <DialogTrigger asChild>
                <Button className="w-fit shrink-0">
                  <Plus className="mr-2 h-4 w-4" />
                  Add Task
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Create New Task</DialogTitle>
                  <DialogDescription>
                    Add a new task to your project.
                  </DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                  <div className="grid gap-2">
                    <label htmlFor="task-title" className="text-sm font-medium">Title</label>
                    <input
                      id="task-title"
                      value={newTitle}
                      onChange={(e) => setNewTitle(e.target.value)}
                      placeholder="Enter task title"
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    />
                  </div>
                  <div className="grid gap-2">
                    <label htmlFor="task-description" className="text-sm font-medium">Description</label>
                    <textarea
                      id="task-description"
                      value={newDescription}
                      onChange={(e) => setNewDescription(e.target.value)}
                      placeholder="Enter task description (optional)"
                      rows={3}
                      className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    />
                  </div>
                  <div className="grid gap-2">
                    <label htmlFor="task-project" className="text-sm font-medium">Project</label>
                    <select
                      id="task-project"
                      value={newProjectId}
                      onChange={(e) => setNewProjectId(e.target.value)}
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    >
                      {projects.map((project) => (
                        <option key={project.id} value={project.id}>
                          {project.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="grid gap-2">
                      <label htmlFor="task-priority" className="text-sm font-medium">Priority</label>
                      <select
                        id="task-priority"
                        value={newPriority}
                        onChange={(e) => setNewPriority(e.target.value as Task["priority"])}
                        className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                      >
                        <option value="low">Low</option>
                        <option value="medium">Medium</option>
                        <option value="high">High</option>
                        <option value="urgent">Urgent</option>
                      </select>
                    </div>
                    <div className="grid gap-2">
                      <label htmlFor="task-assignee" className="text-sm font-medium">Assignee</label>
                      <select
                        id="task-assignee"
                        value={newAssignee}
                        onChange={(e) => setNewAssignee(e.target.value)}
                        className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                      >
                        <option value="">Unassigned</option>
                        {members.map((member) => (
                          <option key={member.id} value={member.id}>
                            {member.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <div className="grid gap-2">
                    <label htmlFor="task-due" className="text-sm font-medium">Due Date</label>
                    <input
                      id="task-due"
                      type="date"
                      value={newDueDate}
                      onChange={(e) => setNewDueDate(e.target.value)}
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setAddDialogOpen(false)}>
                    Cancel
                  </Button>
                  <Button onClick={addTask} disabled={saving || !newTitle.trim() || !newProjectId}>
                    {saving ? "Creating..." : "Create Task"}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          )}
          
          <div className="hidden w-full items-center gap-1 rounded-md border p-0.5 sm:flex sm:w-auto">
            <Button
              variant={viewMode === "kanban" ? "default" : "ghost"}
              size="sm"
              onClick={() => setViewMode("kanban")}
              className={cn("gap-2 h-8", viewMode !== "kanban" && "text-muted-foreground")}
            >
              <LayoutGrid className="h-4 w-4" />
              <span className="hidden sm:inline">Kanban</span>
            </Button>
            <Button
              variant={viewMode === "list" ? "default" : "ghost"}
              size="sm"
              onClick={() => setViewMode("list")}
              className={cn("gap-2 h-8", viewMode !== "list" && "text-muted-foreground")}
            >
              <List className="h-4 w-4" />
              <span className="hidden sm:inline">List</span>
            </Button>
            <Button
              variant={viewMode === "timeline" ? "default" : "ghost"}
              size="sm"
              onClick={() => setViewMode("timeline")}
              className={cn("gap-2 h-8", viewMode !== "timeline" && "text-muted-foreground")}
            >
              <Clock3 className="h-4 w-4" />
              <span className="hidden sm:inline">Timeline</span>
            </Button>
            <Button
              variant={viewMode === "calendar" ? "default" : "ghost"}
              size="sm"
              onClick={() => setViewMode("calendar")}
              className={cn("gap-2 h-8", viewMode !== "calendar" && "text-muted-foreground")}
            >
              <CalendarDays className="h-4 w-4" />
              <span className="hidden sm:inline">Calendar</span>
            </Button>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="space-y-3">
        <div className="lg:hidden">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="w-full justify-center"
            onClick={() => setMobileFiltersOpen((prev) => !prev)}
          >
            <SlidersHorizontal className="mr-2 h-4 w-4" />
            {mobileFiltersOpen ? "Hide Filters" : "Show Filters"}
          </Button>
        </div>

        <div
          className={cn(
            "flex-col gap-3",
            mobileFiltersOpen ? "flex" : "hidden",
            "lg:flex lg:flex-row lg:flex-wrap lg:items-center",
          )}
        >
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search tasks..."
            className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm lg:w-56"
          />
          
          <label 
            className={cn(
              "flex items-center gap-2 text-sm cursor-pointer px-3 py-2 rounded-lg border transition-all",
              myTasksOnly 
                ? "bg-primary/10 border-primary/30 text-primary-foreground" 
                : "hover:bg-accent/50 border-border"
            )}
          >
            <Checkbox
              id="my-tasks"
              checked={myTasksOnly}
              onCheckedChange={(checked) => setMyTasksOnly(checked === true)}
            />
            <span className={cn("font-medium", myTasksOnly && "text-primary")}>My tasks</span>
          </label>

          <Popover open={projectFilterOpen} onOpenChange={setProjectFilterOpen}>
            <PopoverTrigger asChild>
              <Button
                type="button"
                variant="outline"
                role="combobox"
                aria-expanded={projectFilterOpen}
                className="h-10 w-full justify-between rounded-lg px-3 text-sm font-normal lg:w-[220px]"
              >
                <span className="truncate">
                  {projectFilter[0]
                    ? projects.find((project) => project.id === projectFilter[0])?.name || "Project"
                    : "All Projects"}
                </span>
                <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
              <Command className="[&_[data-slot=command-input-wrapper]]:focus-within:ring-0 [&_[data-slot=command-input-wrapper]]:focus-within:ring-offset-0 [&_[data-slot=command-input-wrapper]]:focus-within:outline-none [&_[data-slot=command-input-wrapper]]:focus-within:border-b">
                <CommandInput
                  placeholder="Search projects..."
                  className="no-global-focus-ring h-10 border-0 outline-none ring-0 focus:outline-none focus:ring-0 focus-visible:outline-none focus-visible:ring-0"
                />
                <CommandList>
                  <CommandEmpty>No project found.</CommandEmpty>
                  <CommandGroup>
                    <CommandItem
                      value="__all_projects__"
                      onSelect={() => {
                        setProjectFilter([])
                        setProjectFilterOpen(false)
                      }}
                    >
                      <Check className={cn("mr-2 h-4 w-4", projectFilter.length === 0 ? "opacity-100" : "opacity-0")} />
                      All Projects
                    </CommandItem>
                    {projects.map((project) => (
                      <CommandItem
                        key={project.id}
                        value={`${project.name} ${project.id}`}
                        onSelect={() => {
                          setProjectFilter([project.id])
                          setProjectFilterOpen(false)
                        }}
                      >
                        <Check
                          className={cn(
                            "mr-2 h-4 w-4",
                            projectFilter[0] === project.id ? "opacity-100" : "opacity-0"
                          )}
                        />
                        {project.name}
                      </CommandItem>
                    ))}
                  </CommandGroup>
                </CommandList>
              </Command>
            </PopoverContent>
          </Popover>
          
          <select
            value={priorityFilter[0] || ""}
            onChange={(e) => setPriorityFilter(e.target.value ? [e.target.value] : [])}
            className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm lg:w-auto"
          >
            <option value="">All Priorities</option>
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="high">High</option>
            <option value="urgent">Urgent</option>
          </select>

          <Popover open={assigneeFilterOpen} onOpenChange={setAssigneeFilterOpen}>
            <PopoverTrigger asChild>
              <Button
                type="button"
                variant="outline"
                role="combobox"
                aria-expanded={assigneeFilterOpen}
                className="h-10 w-full justify-between rounded-lg px-3 text-sm font-normal lg:w-[240px]"
              >
                <span className="truncate">
                  {assigneeFilter.length === 0
                    ? "Filter by assignee"
                    : `${assigneeFilter.length} assignee${assigneeFilter.length > 1 ? "s" : ""} selected`}
                </span>
                <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
              <Command>
                <CommandInput
                  placeholder="Search assignees..."
                  className="no-global-focus-ring h-10 border-0 outline-none ring-0 focus:outline-none focus:ring-0 focus-visible:outline-none focus-visible:ring-0"
                />
                <CommandList className="max-h-[240px]">
                  <CommandEmpty>No assignee found.</CommandEmpty>
                  <CommandGroup>
                    {members.map((member) => {
                      const checked = assigneeFilter.includes(member.id)
                      return (
                        <CommandItem
                          key={member.id}
                          value={`${member.name} ${member.id}`}
                          onSelect={() => {
                            setAssigneeFilter((prev) =>
                              prev.includes(member.id)
                                ? prev.filter((id) => id !== member.id)
                                : [...prev, member.id]
                            )
                          }}
                        >
                          <Check className={cn("mr-2 h-4 w-4", checked ? "opacity-100" : "opacity-0")} />
                          <span className="truncate">{member.name}</span>
                        </CommandItem>
                      )
                    })}
                    {assigneeFilter.length > 0 && (
                      <CommandItem
                        value="__clear_assignees__"
                        onSelect={() => setAssigneeFilter([])}
                        className="text-muted-foreground"
                      >
                        Clear selection
                      </CommandItem>
                    )}
                  </CommandGroup>
                </CommandList>
              </Command>
            </PopoverContent>
          </Popover>
          
          <select
            value={dueFilter[0] || "all"}
            onChange={(e) => setDueFilter(e.target.value === "all" ? [] : [e.target.value])}
            className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm lg:w-auto"
          >
            <option value="all">All Dates</option>
            <option value="due_7d">Due in 7 days</option>
            <option value="overdue">Overdue</option>
          </select>
        </div>
      </div>

      {/* Active Filter Badges */}
      {hasActiveFilters && (
        <div className="flex flex-wrap items-center gap-2">
          {projectFilter.map(id => {
            const project = projects.find(p => p.id === id)
            return project ? (
              <button
                key={id}
                type="button"
                onClick={() => setProjectFilter(projectFilter.filter(p => p !== id))}
                className="inline-flex items-center gap-1 rounded-full border border-border bg-background px-3 py-1 text-xs"
              >
                Project: {project.name}
                <X className="h-3 w-3" />
              </button>
            ) : null
          })}
          {priorityFilter.map(p => (
            <button
              key={p}
              type="button"
              onClick={() => setPriorityFilter(priorityFilter.filter(x => x !== p))}
              className="inline-flex items-center gap-1 rounded-full border border-border bg-background px-3 py-1 text-xs capitalize"
            >
              Priority: {p}
              <X className="h-3 w-3" />
            </button>
          ))}
          {assigneeFilter.map(id => {
            const member = members.find(m => m.id === id)
            return member ? (
              <button
                key={id}
                type="button"
                onClick={() => setAssigneeFilter(assigneeFilter.filter(a => a !== id))}
                className="inline-flex items-center gap-1 rounded-full border border-border bg-background px-3 py-1 text-xs"
              >
                {member.name}
                <X className="h-3 w-3" />
              </button>
            ) : null
          })}
          {dueFilter.map(d => (
            <button
              key={d}
              type="button"
              onClick={() => setDueFilter(dueFilter.filter(x => x !== d))}
              className="inline-flex items-center gap-1 rounded-full border border-border bg-background px-3 py-1 text-xs"
            >
              {d === "due_7d" ? "Due in 7 days" : d}
              <X className="h-3 w-3" />
            </button>
          ))}
          {myTasksOnly && (
            <button
              type="button"
              onClick={() => setMyTasksOnly(false)}
              className="inline-flex items-center gap-1 rounded-full border border-border bg-background px-3 py-1 text-xs"
            >
              My tasks
              <X className="h-3 w-3" />
            </button>
          )}
          {debouncedSearch.trim() && (
            <button
              type="button"
              onClick={() => {
                setSearch("")
                setDebouncedSearch("")
              }}
              className="inline-flex items-center gap-1 rounded-full border border-border bg-background px-3 py-1 text-xs"
            >
              Search: {debouncedSearch}
              <X className="h-3 w-3" />
            </button>
          )}
          
          <button
            type="button"
            onClick={() => {
              setProjectFilter([])
              setPriorityFilter([])
              setAssigneeFilter([])
              setDueFilter([])
              setMyTasksOnly(true)
              setSearch("")
              setDebouncedSearch("")
            }}
            className="text-xs text-muted-foreground hover:text-foreground"
          >
            Clear all
          </button>
        </div>
      )}

      {error && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
          {error}
        </div>
      )}

      {myTasksOnly && !loading && Object.values(grouped).flat().length > 0 && (
        <div className="rounded-lg border border-primary/20 bg-primary/5 px-4 py-2.5 text-sm flex items-center gap-2">
          <span className="text-primary font-medium">Viewing your tasks</span>
          {projectFilter.length > 0 && (
            <span className="text-muted-foreground">
              in <span className="font-medium">{projects.find(p => p.id === projectFilter[0])?.name || "selected project"}</span>
            </span>
          )}
          <span className="text-muted-foreground">•</span>
          <span className="text-muted-foreground">{Object.values(grouped).flat().length} task{Object.values(grouped).flat().length !== 1 ? "s" : ""} assigned to you</span>
        </div>
      )}

      {loading ? (
        <Card>
          <CardContent className="flex items-center justify-center py-10">
            <Loader2 className="h-6 w-6 animate-spin" />
          </CardContent>
        </Card>
      ) : Object.values(grouped).flat().length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center gap-3 py-10 text-muted-foreground">
            {myTasksOnly ? (
              <>
                <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
                  <LayoutGrid className="h-8 w-8 text-primary" />
                </div>
                <p className="font-medium text-foreground">No tasks assigned to you</p>
                <p className="text-sm text-center max-w-xs">
                  {projectFilter.length > 0 
                    ? "You don't have any tasks in this project yet. Try unchecking 'My tasks' or select a different project."
                    : "You don't have any tasks assigned yet. Try unchecking 'My tasks' to see all tasks."}
                </p>
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={() => setMyTasksOnly(false)}
                  className="mt-1"
                >
                  View all tasks instead
                </Button>
              </>
            ) : (
              <>
                <LayoutGrid className="h-10 w-10" />
                <p>No tasks found.</p>
                {canEdit && (
                  <Button onClick={() => setAddDialogOpen(true)} className="mt-2">
                    <Plus className="mr-2 h-4 w-4" />
                    Create your first task
                  </Button>
                )}
              </>
            )}
          </CardContent>
        </Card>
      ) : viewMode === "kanban" ? (
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground px-2">
            Drag and drop tasks between columns to update their status. Use the handle on the left to reorder.
          </p>
          <DndContext
            sensors={sensors}
            collisionDetection={closestCorners}
            onDragStart={handleDragStart}
            onDragOver={handleDragOver}
            onDragEnd={handleDragEnd}
          >
            <div className="grid gap-4 lg:grid-cols-3">
              {columns.map((column) => (
                <KanbanColumn
                  key={column.id}
                  id={column.id}
                  title={column.title}
                  tasks={grouped[column.id]}
                  projects={projects}
                  canEdit={canEdit}
                  onEditTask={openEditDialog}
                  onDeleteTask={removeTask}
                  onStatusChange={(taskId, status) => updateTask(taskId, { status })}
                />
              ))}
            </div>
            <DragOverlay>
              {activeTask && (
                <div className="rounded-lg border bg-card p-3 shadow-lg opacity-90 rotate-3">
                  <p className="font-medium text-sm">{activeTask.title}</p>
                </div>
              )}
            </DragOverlay>
          </DndContext>
        </div>
      ) : viewMode === "list" ? (
        <Card className="glass">
          <CardHeader className="flex flex-col gap-2 border-b border-border/60 py-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle className="text-base">Tasks table</CardTitle>
              <p className="text-xs text-muted-foreground">Sorted, filter-aware list for quick scanning.</p>
            </div>
            <div className="hidden xl:flex items-center gap-2">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm">
                    View columns
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  {([
                    ["task", "Task"],
                    ["project", "Project"],
                    ["status", "Status"],
                    ["priority", "Priority"],
                    ["assignee", "Assignee"],
                    ["dueDate", "Due date"],
                  ] as [ListColumnId, string][]).map(([id, label]) => (
                    <DropdownMenuItem
                      key={id}
                      onClick={(event) => {
                        event.preventDefault()
                        setVisibleListColumns((prev) => ({ ...prev, [id]: !prev[id] }))
                      }}
                    >
                      <span className="mr-2 text-xs">{visibleListColumns[id] ? "✓" : "•"}</span>
                      {label}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <div className="space-y-2 p-3 sm:hidden">
              {pagedListTasks.map((task) => (
                <button
                  key={task.id}
                  type="button"
                  className="w-full rounded-lg border border-border/70 bg-card p-3 text-left transition-colors hover:bg-accent/40"
                  onClick={() => openEditDialog(task)}
                >
                  <div className="flex items-start justify-between gap-2">
                    <p className="min-w-0 text-sm font-medium leading-snug line-clamp-2">{task.title}</p>
                    <span className={cn("shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-medium", getDueInLabel(task.due_date, task.status).tone)}>
                      {formatDate(task.due_date)}
                    </span>
                  </div>
                  <p className="mt-1 truncate text-xs text-muted-foreground">{getProjectName(projects, task.project_id)}</p>
                  <div className="mt-2 flex flex-wrap items-center gap-1.5">
                    <Badge className={cn("text-[11px]", statusConfig[task.status].color)}>
                      {statusConfig[task.status].label}
                    </Badge>
                    <Badge variant={priorityConfig[task.priority].variant} className="text-[11px]">
                      {priorityConfig[task.priority].label}
                    </Badge>
                    <Badge variant="outline" className="text-[11px]">
                      {getMemberName(members, task.assignee_member_id)}
                    </Badge>
                  </div>
                </button>
              ))}
            </div>

            <div className="hidden sm:block">
              <Table>
                <TableHeader>
                  <TableRow>
                    {visibleListColumns.task && (
                      <TableHead className="w-[320px]">
                        <button
                          type="button"
                          className="inline-flex items-center gap-1 transition-colors hover:text-foreground"
                          onClick={() => {
                            setListSortColumn("task")
                            setListSortDirection((prev) => (listSortColumn === "task" && prev === "asc" ? "desc" : "asc"))
                          }}
                        >
                          Task
                          {listSortColumn === "task" ? (
                            listSortDirection === "asc" ? <ArrowUp className="h-3.5 w-3.5" /> : <ArrowDown className="h-3.5 w-3.5" />
                          ) : (
                            <ArrowUpDown className="h-3.5 w-3.5 opacity-50" />
                          )}
                        </button>
                      </TableHead>
                    )}
                    {visibleListColumns.project && (
                      <TableHead>
                        <button
                          type="button"
                          className="inline-flex items-center gap-1 transition-colors hover:text-foreground"
                          onClick={() => {
                            setListSortColumn("project")
                            setListSortDirection((prev) => (listSortColumn === "project" && prev === "asc" ? "desc" : "asc"))
                          }}
                        >
                          Project
                          {listSortColumn === "project" ? (
                            listSortDirection === "asc" ? <ArrowUp className="h-3.5 w-3.5" /> : <ArrowDown className="h-3.5 w-3.5" />
                          ) : (
                            <ArrowUpDown className="h-3.5 w-3.5 opacity-50" />
                          )}
                        </button>
                      </TableHead>
                    )}
                    {visibleListColumns.status && (
                      <TableHead>
                        <button
                          type="button"
                          className="inline-flex items-center gap-1 transition-colors hover:text-foreground"
                          onClick={() => {
                            setListSortColumn("status")
                            setListSortDirection((prev) => (listSortColumn === "status" && prev === "asc" ? "desc" : "asc"))
                          }}
                        >
                          Status
                          {listSortColumn === "status" ? (
                            listSortDirection === "asc" ? <ArrowUp className="h-3.5 w-3.5" /> : <ArrowDown className="h-3.5 w-3.5" />
                          ) : (
                            <ArrowUpDown className="h-3.5 w-3.5 opacity-50" />
                          )}
                        </button>
                      </TableHead>
                    )}
                    {visibleListColumns.priority && (
                      <TableHead>
                        <button
                          type="button"
                          className="inline-flex items-center gap-1 transition-colors hover:text-foreground"
                          onClick={() => {
                            setListSortColumn("priority")
                            setListSortDirection((prev) => (listSortColumn === "priority" && prev === "asc" ? "desc" : "asc"))
                          }}
                        >
                          Priority
                          {listSortColumn === "priority" ? (
                            listSortDirection === "asc" ? <ArrowUp className="h-3.5 w-3.5" /> : <ArrowDown className="h-3.5 w-3.5" />
                          ) : (
                            <ArrowUpDown className="h-3.5 w-3.5 opacity-50" />
                          )}
                        </button>
                      </TableHead>
                    )}
                    {visibleListColumns.assignee && (
                      <TableHead>
                        <button
                          type="button"
                          className="inline-flex items-center gap-1 transition-colors hover:text-foreground"
                          onClick={() => {
                            setListSortColumn("assignee")
                            setListSortDirection((prev) => (listSortColumn === "assignee" && prev === "asc" ? "desc" : "asc"))
                          }}
                        >
                          Assignee
                          {listSortColumn === "assignee" ? (
                            listSortDirection === "asc" ? <ArrowUp className="h-3.5 w-3.5" /> : <ArrowDown className="h-3.5 w-3.5" />
                          ) : (
                            <ArrowUpDown className="h-3.5 w-3.5 opacity-50" />
                          )}
                        </button>
                      </TableHead>
                    )}
                    {visibleListColumns.dueDate && (
                      <TableHead>
                        <button
                          type="button"
                          className="inline-flex items-center gap-1 transition-colors hover:text-foreground"
                          onClick={() => {
                            setListSortColumn("dueDate")
                            setListSortDirection((prev) => (listSortColumn === "dueDate" && prev === "asc" ? "desc" : "asc"))
                          }}
                        >
                          Due Date
                          {listSortColumn === "dueDate" ? (
                            listSortDirection === "asc" ? <ArrowUp className="h-3.5 w-3.5" /> : <ArrowDown className="h-3.5 w-3.5" />
                          ) : (
                            <ArrowUpDown className="h-3.5 w-3.5 opacity-50" />
                          )}
                        </button>
                      </TableHead>
                    )}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pagedListTasks.map((task) => {
                    const dueInfo = getDueInLabel(task.due_date, task.status)
                    return (
                      <TableRow
                        key={task.id}
                        className="cursor-pointer"
                        onClick={() => openEditDialog(task)}
                      >
                        {visibleListColumns.task && <TableCell className="font-medium">{task.title}</TableCell>}
                        {visibleListColumns.project && (
                          <TableCell>
                            <span className="block truncate text-xs text-muted-foreground">
                              {getProjectName(projects, task.project_id)}
                            </span>
                          </TableCell>
                        )}
                        {visibleListColumns.status && (
                          <TableCell>
                            <Badge className={cn("px-1.5 py-0 text-[10px]", statusConfig[task.status].color)}>
                              {statusConfig[task.status].label}
                            </Badge>
                          </TableCell>
                        )}
                        {visibleListColumns.priority && (
                          <TableCell>
                            <Badge variant={priorityConfig[task.priority].variant} className="text-xs">
                              {priorityConfig[task.priority].label}
                            </Badge>
                          </TableCell>
                        )}
                        {visibleListColumns.assignee && (
                          <TableCell>
                            <span className="block truncate text-xs text-muted-foreground">
                              {getMemberName(members, task.assignee_member_id)}
                            </span>
                          </TableCell>
                        )}
                        {visibleListColumns.dueDate && (
                          <TableCell>
                            <div className="space-y-0.5 text-[11px] leading-tight">
                              <span className={cn("block", isOverdue(task.due_date) && task.status !== "done" && "text-destructive font-medium")}>
                                {formatDate(task.due_date)}
                              </span>
                              <span className={cn("block text-[10px]", dueInfo.tone)}>
                                {dueInfo.label}
                              </span>
                            </div>
                          </TableCell>
                        )}
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </div>

            <div className="flex items-center justify-between border-t border-border/60 p-3 text-sm">
              <p className="text-muted-foreground">
                Page {listPage} of {totalListPages}
              </p>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" disabled={listPage <= 1} onClick={() => setListPage((p) => p - 1)}>
                  Previous
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={listPage >= totalListPages}
                  onClick={() => setListPage((p) => p + 1)}
                >
                  Next
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      ) : viewMode === "timeline" ? (
        <Card className="glass">
          <CardHeader>
            <CardTitle className="text-base">Task timeline</CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            {(() => {
              const bucketOrder: TimelineBucket[] = ["overdue", "today", "upcoming", "later", "done", "no_due"]
              const bucketLabel: Record<TimelineBucket, string> = {
                overdue: "Overdue",
                today: "Due Today",
                upcoming: "Due in 1-7 Days",
                later: "Later",
                done: "Completed",
                no_due: "No Due Date",
              }

              const bucketed = timelineTasks.reduce<Record<TimelineBucket, Task[]>>(
                (acc, task) => {
                  const dueInfo = getDueInLabel(task.due_date, task.status)
                  acc[dueInfo.bucket].push(task)
                  return acc
                },
                {
                  overdue: [],
                  today: [],
                  upcoming: [],
                  later: [],
                  done: [],
                  no_due: [],
                }
              )

              if (timelineTasks.length === 0) {
                return <p className="text-sm text-muted-foreground">No tasks available for timeline view.</p>
              }

              return bucketOrder.map((bucket) => {
                const baseTasksInBucket = bucketed[bucket]
                const extraTasks = bucket === "later" ? timelineExtra.later : bucket === "done" ? timelineExtra.done : []
                const tasksInBucket = [...baseTasksInBucket, ...extraTasks]
                if (tasksInBucket.length === 0) return null

                const visibleTasks = tasksInBucket
                const canLoadMore = (bucket === "later" || bucket === "done") && timelineHasMore[bucket]
                const isLoadingMore = bucket === "later" || bucket === "done" ? timelineLoadingBucket[bucket] : false

                return (
                  <div key={bucket} className="space-y-2">
                    <div className="flex items-center justify-between">
                      <h3 className="text-sm font-semibold">{bucketLabel[bucket]}</h3>
                      <Badge variant="outline" className="text-xs">
                        {visibleTasks.length}
                      </Badge>
                    </div>
                    <div className="relative pl-4">
                      <div className="absolute bottom-2 left-1 top-2 w-px bg-border/70" aria-hidden="true" />
                      <div className="space-y-2">
                      {visibleTasks.map((task) => {
                        const dueInfo = getDueInLabel(task.due_date, task.status)
                        return (
                          <div key={task.id} className="relative pl-4">
                            <span
                              className={cn(
                                "absolute left-[-6px] top-3 h-3 w-3 rounded-full border-2 border-background",
                                dueInfo.bucket === "overdue" && "bg-destructive",
                                dueInfo.bucket === "today" && "bg-orange-500",
                                dueInfo.bucket === "upcoming" && "bg-blue-500",
                                dueInfo.bucket === "later" && "bg-muted-foreground",
                                dueInfo.bucket === "done" && "bg-emerald-500",
                                dueInfo.bucket === "no_due" && "bg-zinc-400"
                              )}
                              aria-hidden="true"
                            />
                            <button
                              type="button"
                              onClick={() => openEditDialog(task)}
                              className="w-full rounded-lg border border-border/70 bg-card px-3 py-2 text-left transition-colors hover:bg-accent/40"
                            >
                              <div className="flex flex-wrap items-center justify-between gap-2">
                                <p className={cn("text-sm font-medium", task.status === "done" && "line-through text-muted-foreground")}>
                                  {task.title}
                                </p>
                                <Badge variant={priorityConfig[task.priority].variant} className="text-[11px]">
                                  {priorityConfig[task.priority].label}
                                </Badge>
                              </div>
                              <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                                <span>{getProjectName(projects, task.project_id)}</span>
                                <span>•</span>
                                <span>{getMemberName(members, task.assignee_member_id)}</span>
                                <span>•</span>
                                <span className={cn(dueInfo.tone)}>{dueInfo.label}</span>
                              </div>
                            </button>
                          </div>
                        )
                      })}
                      </div>
                      {(bucket === "later" || bucket === "done") && (
                        <div className="pt-2 pl-4">
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            disabled={!canLoadMore || isLoadingMore}
                            onClick={() => loadMoreTimelineBucket(bucket)}
                          >
                            {isLoadingMore ? "Loading..." : canLoadMore ? "Load 5 more" : "No more tasks"}
                          </Button>
                        </div>
                      )}
                    </div>
                  </div>
                )
              })
            })()}
          </CardContent>
        </Card>
      ) : viewMode === "calendar" ? (
        <div className="space-y-6">
          {/* Calendar Header */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="icon"
                onClick={() => {
                  const newDate = new Date(calendarDate)
                  newDate.setMonth(newDate.getMonth() - 1)
                  setCalendarDate(newDate)
                  setCalendarSelectedDate(newDate)
                }}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <h2 className="text-xl font-semibold min-w-[180px] text-center">
                {calendarDate.toLocaleDateString("en-US", { month: "long", year: "numeric" })}
              </h2>
              <Button
                variant="outline"
                size="icon"
                onClick={() => {
                  const newDate = new Date(calendarDate)
                  newDate.setMonth(newDate.getMonth() + 1)
                  setCalendarDate(newDate)
                  setCalendarSelectedDate(newDate)
                }}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                const today = new Date()
                setCalendarDate(today)
                setCalendarSelectedDate(today)
              }}
            >
              Today
            </Button>
          </div>

          <div className="grid gap-4 xl:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)] xl:items-start">
          {/* Calendar Grid */}
          <Card className="overflow-hidden">
            <CardContent className="p-0">
              {/* Day Headers */}
              <div className="grid grid-cols-7 border-b bg-muted/30">
                {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => (
                  <div
                    key={day}
                    className="py-3 text-center text-sm font-medium text-muted-foreground"
                  >
                    {day}
                  </div>
                ))}
              </div>

              {/* Calendar Days */}
              <div className="grid grid-cols-7">
                {(() => {
                  const year = calendarDate.getFullYear()
                  const month = calendarDate.getMonth()
                  const firstDay = new Date(year, month, 1)
                  const lastDay = new Date(year, month + 1, 0)
                  const startPadding = firstDay.getDay()
                  const totalDays = lastDay.getDate()
                  
                  const allTasks = Object.values(grouped).flat()
                  const today = new Date()
                  today.setHours(0, 0, 0, 0)
                  
                  const days = []
                  
                  // Previous month padding
                  for (let i = 0; i < startPadding; i++) {
                    const prevDate = new Date(year, month, -startPadding + i + 1)
                    days.push(
                      <div
                        key={`prev-${i}`}
                        className="min-h-[100px] border-b border-r p-2 bg-muted/10 opacity-50"
                      >
                        <span className="text-sm text-muted-foreground">{prevDate.getDate()}</span>
                      </div>
                    )
                  }
                  
                  // Current month days
                  for (let day = 1; day <= totalDays; day++) {
                    const date = new Date(year, month, day)
                    const dateKey = getDateKey(date)
                    const dayTasks = allTasks.filter(t => t.due_date && getDateKey(new Date(t.due_date)) === dateKey)
                    const isToday = date.toDateString() === today.toDateString()
                    const isSelected = calendarSelectedDate && date.toDateString() === calendarSelectedDate.toDateString()
                    
                    days.push(
                      <div
                        key={day}
                        onClick={() => setCalendarSelectedDate(date)}
                        className={cn(
                          "min-h-[100px] border-b border-r p-2 cursor-pointer transition-colors hover:bg-accent/50",
                          isSelected && "bg-primary/10",
                          isToday && "bg-primary/5"
                        )}
                      >
                        <div className="flex items-center justify-between">
                          <span className={cn(
                            "text-sm font-medium",
                            isToday && "bg-primary text-primary-foreground rounded-full w-7 h-7 flex items-center justify-center"
                          )}>
                            {day}
                          </span>
                          {dayTasks.length > 0 && (
                            <Badge variant="secondary" className="text-[10px] h-5 px-1.5">
                              {dayTasks.length}
                            </Badge>
                          )}
                        </div>
                        <div className="mt-1 space-y-1">
                          {dayTasks.slice(0, 3).map((task) => (
                            <div
                              key={task.id}
                              className={cn(
                                "text-[10px] px-1.5 py-0.5 rounded truncate cursor-pointer hover:opacity-80",
                                task.priority === "urgent" && "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
                                task.priority === "high" && "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400",
                                task.priority === "medium" && "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
                                task.priority === "low" && "bg-gray-100 text-gray-700 dark:bg-gray-900/30 dark:text-gray-400"
                              )}
                              onClick={(e) => {
                                e.stopPropagation()
                                openEditDialog(task)
                              }}
                            >
                              {task.title}
                            </div>
                          ))}
                          {dayTasks.length > 3 && (
                            <div className="text-[10px] text-muted-foreground pl-1">
                              +{dayTasks.length - 3} more
                            </div>
                          )}
                        </div>
                      </div>
                    )
                  }
                  
                  // Next month padding
                  const remaining = 7 - ((startPadding + totalDays) % 7)
                  if (remaining < 7) {
                    for (let i = 1; i <= remaining; i++) {
                      days.push(
                        <div
                          key={`next-${i}`}
                          className="min-h-[100px] border-b border-r p-2 bg-muted/10 opacity-50"
                        >
                          <span className="text-sm text-muted-foreground">{i}</span>
                        </div>
                      )
                    }
                  }
                  
                  return days
                })()}
              </div>
            </CardContent>
          </Card>

          {/* Selected Date Tasks */}
          {calendarSelectedDate && (
            <Card className="xl:max-h-[740px] xl:overflow-auto">
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <CalendarIcon className="h-4 w-4" />
                  {calendarSelectedDate.toLocaleDateString("en-US", { 
                    weekday: "long", 
                    month: "long", 
                    day: "numeric",
                    year: "numeric"
                  })}
                </CardTitle>
              </CardHeader>
              <CardContent>
                {(() => {
                  const selectedTasks = Object.values(grouped).flat().filter(
                    task => task.due_date && getDateKey(new Date(task.due_date)) === getDateKey(calendarSelectedDate)
                  )
                  
                  if (selectedTasks.length === 0) {
                    return (
                      <div className="text-center py-8">
                        <div className="w-12 h-12 rounded-full bg-muted mx-auto flex items-center justify-center mb-3">
                          <CalendarIcon className="h-6 w-6 text-muted-foreground" />
                        </div>
                        <p className="text-muted-foreground">No tasks due on this date</p>
                        {canEdit && (
                          <Button
                            variant="outline"
                            size="sm"
                            className="mt-3"
                            onClick={() => setAddDialogOpen(true)}
                          >
                            <Plus className="h-4 w-4 mr-2" />
                            Add Task
                          </Button>
                        )}
                      </div>
                    )
                  }
                  
                  return (
                    <div className="space-y-2">
                      {selectedTasks.map((task) => (
                        <div
                          key={task.id}
                          className="flex items-center gap-3 p-3 rounded-lg border hover:bg-accent/50 cursor-pointer transition-colors"
                          onClick={() => openEditDialog(task)}
                        >
                          <Checkbox
                            checked={task.status === "done"}
                            onCheckedChange={(checked) => {
                              updateTask(task.id, { status: checked ? "done" : "todo" })
                            }}
                          />
                          <div className={cn(
                            "w-2 h-2 rounded-full shrink-0",
                            task.priority === "urgent" && "bg-red-500",
                            task.priority === "high" && "bg-orange-500",
                            task.priority === "medium" && "bg-blue-500",
                            task.priority === "low" && "bg-gray-400"
                          )} />
                          <div className="flex-1 min-w-0">
                            <p className={cn(
                              "font-medium text-sm truncate",
                              task.status === "done" && "line-through text-muted-foreground"
                            )}>
                              {task.title}
                            </p>
                            <div className="flex items-center gap-2 mt-1">
                              <Badge variant="outline" className="text-[10px]">
                                {getProjectName(projects, task.project_id)}
                              </Badge>
                              <Badge className={cn("text-[10px]", statusConfig[task.status].color)}>
                                {statusConfig[task.status].label}
                              </Badge>
                            </div>
                          </div>
                          <div className="text-right shrink-0">
                            <Badge variant={priorityConfig[task.priority].variant} className="text-[10px]">
                              {priorityConfig[task.priority].label}
                            </Badge>
                            {task.assignee_member_id && (
                              <p className="text-[10px] text-muted-foreground mt-1">
                                {getMemberName(members, task.assignee_member_id)}
                              </p>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )
                })()}
              </CardContent>
            </Card>
          )}
          </div>
        </div>
      ) : null
      }
      
      <Dialog open={!!previewTask} onOpenChange={(open: boolean) => !open && closePreviewDialog()}>
        <DialogContent className="max-w-lg">
          {previewTask && (
            <>
              <DialogHeader>
                <DialogTitle>{editMode ? "Edit Task" : "Task Details"}</DialogTitle>
              </DialogHeader>
              {editMode ? (
                <div className="grid gap-4 py-4">
                  <div className="grid gap-2">
                    <label className="text-sm font-medium">Title</label>
                    <input
                      value={editTitle}
                      onChange={(e) => setEditTitle(e.target.value)}
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    />
                  </div>
                  <div className="grid gap-2">
                    <label className="text-sm font-medium">Description</label>
                    <textarea
                      value={editDescription}
                      onChange={(e) => setEditDescription(e.target.value)}
                      rows={3}
                      className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="grid gap-2">
                      <label className="text-sm font-medium">Priority</label>
                      <select
                        value={editPriority}
                        onChange={(e) => setEditPriority(e.target.value as Task["priority"])}
                        className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                      >
                        <option value="low">Low</option>
                        <option value="medium">Medium</option>
                        <option value="high">High</option>
                        <option value="urgent">Urgent</option>
                      </select>
                    </div>
                    <div className="grid gap-2">
                      <label className="text-sm font-medium">Assignee</label>
                      <select
                        value={editAssignee}
                        onChange={(e) => setEditAssignee(e.target.value)}
                        className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                      >
                        <option value="">Unassigned</option>
                        {members.map((member) => (
                          <option key={member.id} value={member.id}>
                            {member.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <div className="grid gap-2">
                    <label className="text-sm font-medium">Due Date</label>
                    <input
                      type="date"
                      value={editDueDate}
                      onChange={(e) => setEditDueDate(e.target.value)}
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    />
                  </div>
                  <div className="mt-4 flex w-full items-center justify-between">
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-8 w-8 border-destructive/40 text-destructive hover:bg-destructive/10 hover:text-destructive"
                      title="Delete task"
                      aria-label="Delete task"
                      onClick={() => {
                        if (!previewTask) return
                        if (!confirm("Delete this task? This action cannot be undone.")) return
                        removeTask(previewTask.id)
                      }}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                    <div className="flex items-center gap-2">
                      <Button variant="outline" onClick={() => setEditMode(false)}>
                        Cancel
                      </Button>
                      <Button onClick={saveEdit} disabled={editSaving || !editTitle.trim()}>
                        {editSaving ? "Saving..." : "Save Changes"}
                      </Button>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <div>
                    <h3 className="text-lg font-semibold">{previewTask.title}</h3>
                    {previewTask.description && (
                      <p className="text-sm text-muted-foreground mt-1">{previewTask.description}</p>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Badge variant={priorityConfig[previewTask.priority].variant}>
                      {priorityConfig[previewTask.priority].label}
                    </Badge>
                    <Badge className={statusConfig[previewTask.status].color}>
                      {statusConfig[previewTask.status].label}
                    </Badge>
                  </div>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <p className="text-muted-foreground">Project</p>
                      <p className="font-medium">{getProjectName(projects, previewTask.project_id)}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Assignee</p>
                      <p className="font-medium">{getMemberName(members, previewTask.assignee_member_id)}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Due Date</p>
                      <p className={cn("font-medium", isOverdue(previewTask.due_date) && previewTask.status !== "done" && "text-destructive")}>
                        {formatDate(previewTask.due_date)}
                      </p>
                    </div>
                  </div>
                  {canEdit && (
                    <DialogFooter className="justify-end">
                      <Button onClick={() => setEditMode(true)}>
                        <Pencil className="mr-2 h-4 w-4" />
                        Edit task details
                      </Button>
                    </DialogFooter>
                  )}
                </div>
              )}
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
