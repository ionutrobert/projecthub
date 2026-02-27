"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { type DateRange } from "react-day-picker";
import { ActivityIcon, Check, ChevronsUpDown, CircleHelp, ListTodo, Users } from "lucide-react";

import MemberAvatar from "@/components/member-avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { DateRangePicker } from "@/components/ui/date-range-picker";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { renderMarkdownHtml } from "@/lib/markdown";

type ProjectStatus = "active" | "in-progress" | "on-hold" | "completed" | "closed";

type Member = {
  id: string;
  user_id?: string | null;
  name: string;
  email?: string | null;
  role?: string | null;
  avatar_url?: string | null;
};

type Project = {
  id: string;
  name: string;
  status: ProjectStatus;
  client_name?: string | null;
  deadline: string | null;
  budget: number | null;
  labels?: string[] | null;
  description?: string | null;
  created_by?: string | null;
  created_at?: string;
  start_date?: string | null;
  color?: string;
  icon?: string;
  project_members?: Array<{
    members?: {
      id?: string | null;
      name?: string | null;
      email?: string | null;
      user_id?: string | null;
      avatar_url?: string | null;
    } | null;
  }>;
  task_count?: number;
};

type ProjectTaskPreview = {
  id: string;
  title: string;
  status: "todo" | "in-progress" | "done";
  priority: "low" | "medium" | "high" | "urgent";
  description?: string | null;
  due_date: string | null;
  assignee_member_id?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
};

type ActivityItem = {
  id: string;
  date: Date;
  title: string;
  detail: string;
  tone: "neutral" | "success" | "warn";
};

type ActivityApiItem = {
  id: string;
  timestamp: string;
  title: string;
  detail: string;
  tone: "neutral" | "success" | "warn";
};

type ClientOption = {
  id: string;
  name: string;
};

const PROJECT_STATUS_BADGE_CLASS: Record<ProjectStatus, string> = {
  active: "bg-emerald-500/15 text-emerald-200 border-emerald-500/40",
  "in-progress": "bg-blue-500/15 text-blue-200 border-blue-500/40",
  "on-hold": "bg-amber-500/15 text-amber-200 border-amber-500/40",
  completed: "bg-violet-500/15 text-violet-200 border-violet-500/40",
  closed: "bg-zinc-500/15 text-zinc-200 border-zinc-500/40",
};

const PROJECT_PREVIEW_TASK_STATUS_LABEL: Record<ProjectTaskPreview["status"], string> = {
  todo: "To Do",
  "in-progress": "In Progress",
  done: "Done",
};

const PROJECT_PREVIEW_TASK_STATUS_CLASS: Record<ProjectTaskPreview["status"], string> = {
  todo: "bg-zinc-500/15 text-zinc-200 border-zinc-500/40",
  "in-progress": "bg-blue-500/15 text-blue-200 border-blue-500/40",
  done: "bg-emerald-500/15 text-emerald-200 border-emerald-500/40",
};

function parseIsoDate(value: string): Date | undefined {
  if (!value) return undefined;
  const parsed = new Date(`${value}T00:00:00`);
  return Number.isNaN(parsed.getTime()) ? undefined : parsed;
}

function serializeIsoDate(value: Date | undefined): string {
  if (!value) return "";
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const day = String(value.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatDateLabel(value?: string | null) {
  if (!value) return "-";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

function toDateOrNull(value?: string | null) {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function getTimelineProgress(startDate?: string | null, deadline?: string | null) {
  if (!startDate || !deadline) return { hasTimeline: false, progress: 0 };
  const start = new Date(startDate);
  const end = new Date(deadline);
  const now = new Date();
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end <= start) {
    return { hasTimeline: false, progress: 0 };
  }
  const totalMs = end.getTime() - start.getTime();
  const elapsedMs = Math.min(Math.max(now.getTime() - start.getTime(), 0), totalMs);
  const progress = Math.round((elapsedMs / totalMs) * 100);
  return { hasTimeline: true, progress };
}

type Props<TProject extends Project = Project> = {
  project: TProject | null;
  canEdit: boolean;
  availableMembers: Member[];
  onClose: () => void;
  onProjectUpdated: (project: TProject) => void;
  onOpenProjectPage: (projectId: string) => void;
};

const getClientDisplayName = (clientName?: string | null) => {
  const normalized = clientName?.trim();
  return normalized ? normalized : "Internal project";
};

export default function ProjectPreviewModal<TProject extends Project>({
  project,
  canEdit,
  availableMembers,
  onClose,
  onProjectUpdated,
  onOpenProjectPage,
}: Props<TProject>) {
  const router = useRouter();

  const [tasksLoading, setTasksLoading] = useState(false);
  const [projectTasks, setProjectTasks] = useState<ProjectTaskPreview[]>([]);
  const [tasksVisibleCount, setTasksVisibleCount] = useState(5);
  const [activitiesVisibleCount, setActivitiesVisibleCount] = useState(5);
  const [projectActivities, setProjectActivities] = useState<ActivityItem[]>([]);
  const [activitiesLoading, setActivitiesLoading] = useState(false);
  const [activitiesHasMore, setActivitiesHasMore] = useState(false);
  const [activitiesSource, setActivitiesSource] = useState<"project_activities" | "derived">("derived");

  const [aboutEditMode, setAboutEditMode] = useState(false);
  const [membersEditMode, setMembersEditMode] = useState(false);
  const [savingAbout, setSavingAbout] = useState(false);
  const [savingMembers, setSavingMembers] = useState(false);

  const [quickEditName, setQuickEditName] = useState("");
  const [quickEditStatus, setQuickEditStatus] = useState<ProjectStatus>("active");
  const [quickEditStartDate, setQuickEditStartDate] = useState("");
  const [quickEditDeadline, setQuickEditDeadline] = useState("");
  const [quickEditBudget, setQuickEditBudget] = useState("");
  const [quickEditClient, setQuickEditClient] = useState("");
  const [quickEditDescription, setQuickEditDescription] = useState("");
  const [quickEditMemberIds, setQuickEditMemberIds] = useState<string[]>([]);
  const [quickEditLabels, setQuickEditLabels] = useState<string[]>([]);
  const [quickEditLabelInput, setQuickEditLabelInput] = useState("");
  const [aboutDescriptionExpanded, setAboutDescriptionExpanded] = useState(false);
  const [isMobileViewport, setIsMobileViewport] = useState(false);
  const [clientPickerOpen, setClientPickerOpen] = useState(false);
  const [clients, setClients] = useState<ClientOption[]>([]);

  useEffect(() => {
    const updateViewportFlag = () => {
      setIsMobileViewport(window.innerWidth < 640);
    };

    updateViewportFlag();
    window.addEventListener("resize", updateViewportFlag);

    return () => {
      window.removeEventListener("resize", updateViewportFlag);
    };
  }, []);

  const getMemberName = (memberId?: string | null) => {
    if (!memberId) return "Unassigned";
    const match = availableMembers.find((member) => member.id === memberId);
    return match?.name || "Unassigned";
  };

  useEffect(() => {
    if (!project) return;

    setAboutEditMode(false);
    setMembersEditMode(false);
    setTasksVisibleCount(5);
    setActivitiesVisibleCount(5);

    setQuickEditName(project.name || "");
    setQuickEditStatus(project.status || "active");
    setQuickEditStartDate(project.start_date || "");
    setQuickEditDeadline(project.deadline || "");
    setQuickEditBudget(typeof project.budget === "number" ? String(project.budget) : "");
    setQuickEditClient(project.client_name || "");
    setQuickEditDescription(project.description || "");
    setQuickEditMemberIds((project.project_members || []).map((pm) => pm.members?.id).filter((id): id is string => Boolean(id)));
    setQuickEditLabels(project.labels || []);
    setQuickEditLabelInput("");
    setAboutDescriptionExpanded(false);
    setProjectActivities([]);
    setActivitiesHasMore(false);
    setActivitiesSource("derived");

    setTasksLoading(true);
    const loadTasks = async () => {
      try {
        const response = await fetch(`/api/tasks?projectId=${project.id}`, { cache: "no-store" });
        const data = await response.json().catch(() => []);
        if (response.ok && Array.isArray(data)) {
          setProjectTasks(data);
        } else {
          setProjectTasks([]);
        }
      } catch {
        setProjectTasks([]);
      } finally {
        setTasksLoading(false);
      }
    };

    const loadActivities = async () => {
      setActivitiesLoading(true);
      try {
        const response = await fetch(`/api/projects/${project.id}/activities?offset=0&limit=5`, { cache: "no-store" });
        const payload = await response.json().catch(() => null);
        if (!response.ok || !payload || !Array.isArray(payload.activities)) {
          setProjectActivities([]);
          setActivitiesHasMore(false);
          return;
        }

        const mapped = (payload.activities as ActivityApiItem[])
          .map((item) => {
            const parsed = new Date(item.timestamp);
            if (Number.isNaN(parsed.getTime())) return null;
            return {
              id: item.id,
              date: parsed,
              title: item.title,
              detail: item.detail,
              tone: item.tone,
            } satisfies ActivityItem;
          })
          .filter((item): item is ActivityItem => Boolean(item));

        setProjectActivities(mapped);
        setActivitiesHasMore(Boolean(payload.hasMore));
        setActivitiesSource(payload.source === "project_activities" ? "project_activities" : "derived");
      } catch {
        setProjectActivities([]);
        setActivitiesHasMore(false);
      } finally {
        setActivitiesLoading(false);
      }
    };

    void loadTasks();
    void loadActivities();

    const loadClients = async () => {
      try {
        const response = await fetch("/api/clients", { cache: "no-store" });
        const payload = await response.json().catch(() => null);
        if (!response.ok || !Array.isArray(payload)) {
          setClients([]);
          return;
        }

        const mapped = payload
          .filter((item): item is { id: string; name: string } => Boolean(item?.id && item?.name))
          .map((item) => ({ id: item.id, name: item.name }));

        setClients(mapped);
      } catch {
        setClients([]);
      }
    };

    void loadClients();
  }, [project]);

  const sortedTaskTimeline = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    return [...projectTasks].sort((a, b) => {
      const aDue = toDateOrNull(a.due_date);
      const bDue = toDateOrNull(b.due_date);

      const statusRank = (task: ProjectTaskPreview) => {
        if (task.status === "done") return 3;
        const due = toDateOrNull(task.due_date);
        if (due && due < today) return 0;
        if (task.status === "in-progress") return 1;
        return 2;
      };

      const rankDiff = statusRank(a) - statusRank(b);
      if (rankDiff !== 0) return rankDiff;

      if (aDue && bDue) return aDue.getTime() - bDue.getTime();
      if (aDue && !bDue) return -1;
      if (!aDue && bDue) return 1;
      return a.title.localeCompare(b.title);
    });
  }, [projectTasks]);

  const assignedMembers = useMemo(() => {
    if (!project) return [] as Array<NonNullable<NonNullable<Project["project_members"]>[number]["members"]>>;
    return (project.project_members || [])
      .map((pm) => pm.members)
      .filter((member): member is NonNullable<typeof member> => Boolean(member));
  }, [project]);

  const taskAssigneeSummary = useMemo(() => {
    const byMember = new Map<string, { memberName: string; count: number; tasks: string[] }>();

    for (const task of projectTasks) {
      if (!task.assignee_member_id) continue;
      const member = availableMembers.find((candidate) => candidate.id === task.assignee_member_id);
      const memberName = member?.name || "Unknown member";
      const current = byMember.get(task.assignee_member_id);
      if (current) {
        current.count += 1;
        current.tasks.push(task.title);
      } else {
        byMember.set(task.assignee_member_id, {
          memberName,
          count: 1,
          tasks: [task.title],
        });
      }
    }

    return [...byMember.entries()].map(([memberId, summary]) => ({
      memberId,
      ...summary,
    }));
  }, [availableMembers, projectTasks]);

  const loadMoreActivities = async () => {
    if (!project || activitiesLoading || !activitiesHasMore) return;
    setActivitiesLoading(true);
    try {
      const response = await fetch(
        `/api/projects/${project.id}/activities?offset=${projectActivities.length}&limit=5`,
        { cache: "no-store" }
      );
      const payload = await response.json().catch(() => null);
      if (!response.ok || !payload || !Array.isArray(payload.activities)) {
        setActivitiesHasMore(false);
        return;
      }

      const mapped = (payload.activities as ActivityApiItem[])
        .map((item) => {
          const parsed = new Date(item.timestamp);
          if (Number.isNaN(parsed.getTime())) return null;
          return {
            id: item.id,
            date: parsed,
            title: item.title,
            detail: item.detail,
            tone: item.tone,
          } satisfies ActivityItem;
        })
        .filter((item): item is ActivityItem => Boolean(item));

      setProjectActivities((previous) => {
        const ids = new Set(previous.map((item) => item.id));
        const nextItems = mapped.filter((item) => !ids.has(item.id));
        return [...previous, ...nextItems];
      });
      setActivitiesHasMore(Boolean(payload.hasMore));
      setActivitiesSource(payload.source === "project_activities" ? "project_activities" : "derived");
      setActivitiesVisibleCount((count) => count + 5);
    } finally {
      setActivitiesLoading(false);
    }
  };

  if (!project) return null;

  const trimmedDescription = quickEditDescription?.trim() || "";
  const aboutDescriptionNeedsToggle =
    trimmedDescription.length > 260 ||
    (trimmedDescription.match(/\n/g)?.length || 0) > 3;

  const memberCount = assignedMembers.length;
  const taskCount = typeof project.task_count === "number" ? project.task_count : projectTasks.length;

  const dateRange: DateRange | undefined = {
    from: parseIsoDate(quickEditStartDate),
    to: parseIsoDate(quickEditDeadline),
  };

  const timeline = getTimelineProgress(project.start_date || null, project.deadline || null);

  const saveAbout = async () => {
    if (!quickEditName.trim()) return;
    setSavingAbout(true);
    try {
      const response = await fetch(`/api/projects/${project.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: quickEditName.trim(),
          status: quickEditStatus,
          start_date: quickEditStartDate || null,
          deadline: quickEditDeadline || null,
          budget: quickEditBudget.trim() === "" ? null : Number(quickEditBudget),
          client_name: quickEditClient.trim() || null,
          description: quickEditDescription.trim() || null,
          labels: quickEditLabels,
        }),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok || !data) return;
      onProjectUpdated({ ...project, ...data } as TProject);
      setAboutEditMode(false);
    } finally {
      setSavingAbout(false);
    }
  };

  const saveMembers = async () => {
    setSavingMembers(true);
    try {
      const response = await fetch(`/api/projects/${project.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ member_ids: quickEditMemberIds }),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok || !data) return;
      onProjectUpdated({ ...project, ...data } as TProject);
      setMembersEditMode(false);
    } finally {
      setSavingMembers(false);
    }
  };

  const toggleQuickEditMember = (memberId: string) => {
    setQuickEditMemberIds((prev) => (prev.includes(memberId) ? prev.filter((id) => id !== memberId) : [...prev, memberId]));
  };

  const addQuickEditLabel = () => {
    const normalized = quickEditLabelInput.trim().replace(/,/g, "");
    if (!normalized) return;
    setQuickEditLabels((prev) => (prev.includes(normalized) ? prev : [...prev, normalized]));
    setQuickEditLabelInput("");
  };

  return (
    <Dialog open={Boolean(project)} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="z-[220] max-h-[92vh] overflow-y-auto border-primary/35 bg-background/95 p-0 sm:max-h-[90vh] sm:max-w-[min(94vw,1100px)] [&>button]:hidden">
        <DialogHeader className="sr-only">
          <DialogTitle>Project preview</DialogTitle>
          <DialogDescription>Detailed preview and quick edit for selected project.</DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="tasks" className="space-y-0">
          <Card className="glass relative w-full border-0 bg-transparent shadow-none">
            <CardHeader className="sticky top-0 z-20 border-b border-border/60 bg-background/90 pb-2 backdrop-blur supports-[backdrop-filter]:bg-background/80 sm:pb-3">
            <button
              type="button"
              aria-label="Close preview"
              className="absolute right-2 top-2 inline-flex h-7 w-7 items-center justify-center rounded-full border border-border bg-background/80 text-muted-foreground sm:right-3 sm:top-3 sm:h-8 sm:w-8"
              onClick={onClose}
            >
              <span className="text-base leading-none">×</span>
            </button>

            <div className="md:flex md:items-start md:justify-between md:gap-4">
              <div>
                <p className="text-[10px] uppercase tracking-wide text-primary sm:text-xs">Project Preview</p>
                <CardTitle className="mt-0.5 pr-8 text-lg leading-tight sm:mt-1 sm:pr-0 sm:text-2xl">{project.name}</CardTitle>
              </div>
              <div className="mt-2 min-w-0 md:mt-0 md:w-72">
                <p className="text-[10px] uppercase tracking-wide text-muted-foreground sm:text-[11px]">Project timeline progress</p>
                {timeline.hasTimeline ? (
                  <>
                    <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-primary/10 sm:mt-2 sm:h-2">
                      <div className="h-full rounded-full bg-primary" style={{ width: `${Math.max(4, Math.min(100, timeline.progress))}%` }} />
                    </div>
                    <div className="mt-1 flex items-center justify-between text-[10px] text-muted-foreground sm:text-[11px]">
                      <span>{formatDateLabel(project.start_date)}</span>
                      <span>{timeline.progress}%</span>
                      <span>{formatDateLabel(project.deadline)}</span>
                    </div>
                  </>
                ) : (
                  <p className="mt-1 text-xs text-muted-foreground">Add start + deadline to track progress.</p>
                )}
              </div>
            </div>

            <TabsList className="mt-2 grid h-auto w-full grid-cols-4 gap-1 bg-transparent p-0 sm:mt-3">
              <TabsTrigger
                value="tasks"
                className="relative h-10 flex-col items-center justify-center gap-0.5 rounded-md border border-border/60 bg-muted/30 px-1 text-[9px] font-medium data-[state=active]:border-primary data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-sm data-[state=active]:ring-1 data-[state=active]:ring-primary/60 sm:h-10 sm:flex-row sm:justify-start sm:gap-2 sm:px-2 sm:text-xs"
              >
                <ListTodo className="h-3.5 w-3.5" />
                <span>Tasks</span>
                <Badge
                  variant="secondary"
                  className="absolute right-0.5 top-0.5 inline-flex h-3.5 min-w-3.5 items-center justify-center px-1 text-[8px] leading-none tabular-nums sm:static sm:h-5 sm:min-w-5 sm:px-1.5 sm:text-[10px]"
                >
                  {taskCount}
                </Badge>
              </TabsTrigger>
              <TabsTrigger
                value="members"
                className="relative h-10 flex-col items-center justify-center gap-0.5 rounded-md border border-border/60 bg-muted/30 px-1 text-[9px] font-medium data-[state=active]:border-primary data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-sm data-[state=active]:ring-1 data-[state=active]:ring-primary/60 sm:h-10 sm:flex-row sm:justify-start sm:gap-2 sm:px-2 sm:text-xs"
              >
                <Users className="h-3.5 w-3.5" />
                <span>Members</span>
                <Badge
                  variant="secondary"
                  className="absolute right-0.5 top-0.5 inline-flex h-3.5 min-w-3.5 items-center justify-center px-1 text-[8px] leading-none tabular-nums sm:static sm:h-5 sm:min-w-5 sm:px-1.5 sm:text-[10px]"
                >
                  {memberCount}
                </Badge>
              </TabsTrigger>
              <TabsTrigger
                value="activities"
                className="relative h-10 flex-col items-center justify-center gap-0.5 rounded-md border border-border/60 bg-muted/30 px-1 text-[9px] font-medium data-[state=active]:border-primary data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-sm data-[state=active]:ring-1 data-[state=active]:ring-primary/60 sm:h-10 sm:flex-row sm:justify-start sm:gap-2 sm:px-2 sm:text-xs"
              >
                <ActivityIcon className="h-3.5 w-3.5" />
                <span>Activity</span>
                <Badge
                  variant="secondary"
                  className="absolute right-0.5 top-0.5 inline-flex h-3.5 min-w-3.5 items-center justify-center px-1 text-[8px] leading-none tabular-nums sm:static sm:h-5 sm:min-w-5 sm:px-1.5 sm:text-[10px]"
                >
                  {projectActivities.length}
                </Badge>
              </TabsTrigger>
              <TabsTrigger
                value="about"
                className="h-10 flex-col items-center justify-center gap-0.5 rounded-md border border-border/60 bg-muted/30 px-1 text-[9px] font-medium data-[state=active]:border-primary data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-sm data-[state=active]:ring-1 data-[state=active]:ring-primary/60 sm:h-10 sm:flex-row sm:justify-start sm:gap-2 sm:px-2 sm:text-xs"
              >
                <CircleHelp className="h-3.5 w-3.5" />
                <span>About</span>
              </TabsTrigger>
            </TabsList>
          </CardHeader>

          <CardContent className="pt-3 sm:pt-4">

              <TabsContent value="tasks" className="space-y-2.5 sm:space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <p className="hidden text-sm text-muted-foreground sm:block">Most relevant tasks first (overdue, active, then remaining).</p>
                  <Button
                    size="sm"
                    className="h-8 bg-primary px-2.5 text-xs text-primary-foreground hover:bg-primary/90 sm:h-9 sm:px-3 sm:text-sm"
                    onClick={() => router.push(`/tasks?projectId=${project.id}`)}
                  >
                    Open in Tasks
                  </Button>
                </div>

                {tasksLoading ? (
                  <p className="text-sm text-muted-foreground">Loading tasks...</p>
                ) : sortedTaskTimeline.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No tasks found for this project.</p>
                ) : (
                  <div className="space-y-2 sm:space-y-3">
                    <div className="relative pl-4 sm:pl-5">
                      <div className="pointer-events-none absolute bottom-2 left-[5px] top-1 w-px bg-border/70 sm:left-[7px]" />
                      <div className="space-y-2 sm:space-y-3">
                        {sortedTaskTimeline.slice(0, tasksVisibleCount).map((task) => (
                          <div key={task.id} className="relative">
                            <span
                              className={cn(
                                "pointer-events-none absolute -left-[15px] top-2.5 h-3 w-3 rounded-full border border-border bg-background sm:-left-[20px] sm:top-3 sm:h-3.5 sm:w-3.5",
                                task.status === "done" && "bg-emerald-400/70",
                                task.status === "in-progress" && "bg-blue-400/70",
                                task.status === "todo" && "bg-zinc-400/70"
                              )}
                            />
                            <button
                              type="button"
                              onClick={() => router.push(`/tasks?projectId=${project.id}&taskId=${task.id}`)}
                              className="w-full rounded-lg border border-border/60 bg-background/60 px-2.5 py-2 text-left transition-colors hover:border-primary/50 hover:bg-primary/10 sm:px-3"
                            >
                              <div className="flex flex-wrap items-start justify-between gap-2">
                                <p className="text-xs font-semibold text-foreground sm:text-sm">{task.title}</p>
                                <div className="flex flex-wrap items-center gap-1.5">
                                  <Badge className={cn("border text-[10px]", PROJECT_PREVIEW_TASK_STATUS_CLASS[task.status])}>
                                    {PROJECT_PREVIEW_TASK_STATUS_LABEL[task.status]}
                                  </Badge>
                                  <Badge variant="outline" className="text-[10px] capitalize">
                                    {task.priority}
                                  </Badge>
                                </div>
                              </div>
                              <div className="mt-1 flex flex-wrap items-center gap-2 text-[10px] sm:text-[11px]">
                                <span className="inline-flex items-center gap-1 rounded-full border border-border/60 bg-muted/30 px-1.5 py-0.5 text-foreground/90">
                                  <Users className="h-3 w-3" />
                                  {getMemberName(task.assignee_member_id)}
                                </span>
                                <span className="text-muted-foreground">Due: {formatDateLabel(task.due_date)}</span>
                              </div>
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>

                    {sortedTaskTimeline.length > tasksVisibleCount && (
                      <div className="flex justify-end">
                        <Button size="sm" variant="outline" className="h-8 px-2.5 text-xs sm:h-9 sm:px-3 sm:text-sm" onClick={() => setTasksVisibleCount((count) => count + 5)}>
                          Load 5 more
                        </Button>
                      </div>
                    )}
                  </div>
                )}
              </TabsContent>

              <TabsContent value="members" className="space-y-2.5 sm:space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <p className="hidden text-sm text-muted-foreground sm:block">Assigned team members for this project.</p>
                  {canEdit && (
                    <Button
                      size="sm"
                      variant={membersEditMode ? "destructive" : "default"}
                      className={membersEditMode ? "h-8 px-2.5 text-xs sm:h-9 sm:px-3 sm:text-sm" : "h-8 bg-primary px-2.5 text-xs text-primary-foreground hover:bg-primary/90 sm:h-9 sm:px-3 sm:text-sm"}
                      onClick={() => setMembersEditMode((open) => !open)}
                    >
                      {membersEditMode ? "Cancel" : "Edit Members"}
                    </Button>
                  )}
                </div>

                {membersEditMode ? (
                  <div className="space-y-2.5 sm:space-y-3">
                    <div className="grid max-h-52 gap-1 overflow-y-auto rounded-md border border-border/60 p-1.5 sm:max-h-56 sm:p-2">
                      {availableMembers.map((member) => {
                        const selected = quickEditMemberIds.includes(member.id);
                        return (
                          <button
                            key={member.id}
                            type="button"
                            onClick={() => toggleQuickEditMember(member.id)}
                            className={cn(
                              "flex items-center justify-between rounded-md border px-2 py-1.5 text-left text-[11px] transition-colors sm:text-xs",
                              selected
                                ? "border-primary/50 bg-primary/10 text-foreground"
                                : "border-border/60 bg-background hover:bg-accent/30"
                            )}
                          >
                            <span className="truncate">{member.name}</span>
                            <span className="text-muted-foreground">{selected ? "Assigned" : "Assign"}</span>
                          </button>
                        );
                      })}
                    </div>
                    <div className="flex justify-end">
                      <Button size="sm" className="h-8 px-2.5 text-xs sm:h-9 sm:px-3 sm:text-sm" onClick={saveMembers} disabled={savingMembers}>
                        {savingMembers ? "Saving..." : "Save Members"}
                      </Button>
                    </div>
                  </div>
                ) : assignedMembers.length > 0 || taskAssigneeSummary.length > 0 ? (
                  <div className="space-y-4">
                    <div>
                      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Project members</p>
                      {assignedMembers.length > 0 ? (
                        <div className="flex flex-wrap gap-2">
                          {assignedMembers.map((member) => {
                            const key = `${member.id || member.user_id || member.email || member.name || "member"}`;
                            const canOpen = Boolean(member.id);
                            return (
                              <button
                                key={key}
                                type="button"
                                disabled={!canOpen}
                                onClick={() => {
                                  if (member.id) router.push(`/team/${member.id}`);
                                }}
                                className="inline-flex items-center gap-2 rounded-full border border-border/70 bg-background/70 px-2 py-1"
                              >
                                <MemberAvatar
                                  name={member.name || undefined}
                                  email={member.email || undefined}
                                  userId={member.user_id || undefined}
                                  avatarUrl={member.avatar_url || undefined}
                                  sizeClass="h-6 w-6"
                                  textClass="text-[10px]"
                                />
                                <span className="text-xs font-medium">{member.name || member.email || "Member"}</span>
                              </button>
                            );
                          })}
                        </div>
                      ) : (
                        <p className="text-sm text-muted-foreground">No members assigned to this project.</p>
                      )}
                    </div>

                    <div>
                      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Task assignees</p>
                      {taskAssigneeSummary.length > 0 ? (
                        <div className="space-y-2">
                          {taskAssigneeSummary.map((summary) => (
                            <button
                              key={summary.memberId}
                              type="button"
                              onClick={() => router.push(`/team/${summary.memberId}`)}
                              className="w-full rounded-md border border-border/60 bg-background/60 p-2 text-left transition-colors hover:border-primary/50 hover:bg-primary/10"
                            >
                              <div className="flex items-center justify-between gap-2">
                                <p className="text-xs font-medium sm:text-sm">{summary.memberName}</p>
                                <Badge variant="outline" className="text-[10px]">{summary.count} task{summary.count === 1 ? "" : "s"}</Badge>
                              </div>
                              <p className="mt-1 text-xs text-muted-foreground">{summary.tasks.slice(0, 3).join(" • ")}{summary.tasks.length > 3 ? " • ..." : ""}</p>
                            </button>
                          ))}
                        </div>
                      ) : (
                        <p className="text-sm text-muted-foreground">No task assignees yet.</p>
                      )}
                    </div>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">No members assigned.</p>
                )}
              </TabsContent>

              <TabsContent value="activities" className="space-y-2.5 sm:space-y-3">
                <p className="hidden text-sm text-muted-foreground sm:block">
                  Most recent project activities.
                  {activitiesSource === "project_activities" ? "" : " Showing inferred activity while history logging is unavailable."}
                </p>

                {activitiesLoading && projectActivities.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Loading activity...</p>
                ) : projectActivities.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No activity available yet.</p>
                ) : (
                  <>
                    <div className="relative pl-4 sm:pl-5">
                      <div className="pointer-events-none absolute bottom-2 left-[5px] top-1 w-px bg-border/70 sm:left-[7px]" />
                      <div className="space-y-2 sm:space-y-3">
                        {projectActivities.slice(0, activitiesVisibleCount).map((activity) => (
                          <div key={activity.id} className="relative">
                            <span
                              className={cn(
                                "pointer-events-none absolute -left-[15px] top-2.5 h-3 w-3 rounded-full border border-border bg-background sm:-left-[20px] sm:top-3 sm:h-3.5 sm:w-3.5",
                                activity.tone === "success" && "bg-emerald-400/80",
                                activity.tone === "warn" && "bg-amber-400/80",
                                activity.tone === "neutral" && "bg-zinc-400/80"
                              )}
                            />
                            <div className="rounded-lg border border-border/60 bg-background/60 px-2.5 py-2 sm:px-3">
                              <div className="flex flex-wrap items-center justify-between gap-2">
                                <p className="text-xs font-semibold sm:text-sm">{activity.title}</p>
                                <span className="text-[10px] text-muted-foreground sm:text-[11px]">{activity.date.toLocaleString()}</span>
                              </div>
                              <p className="mt-1 text-xs text-muted-foreground">{activity.detail}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {(activitiesHasMore || projectActivities.length > activitiesVisibleCount) && (
                      <div className="flex justify-end">
                        <Button size="sm" variant="outline" className="h-8 px-2.5 text-xs sm:h-9 sm:px-3 sm:text-sm" onClick={loadMoreActivities} disabled={activitiesLoading}>
                          {activitiesLoading ? "Loading..." : "Load 5 more"}
                        </Button>
                      </div>
                    )}
                  </>
                )}
              </TabsContent>

              <TabsContent value="about" className="space-y-2 sm:space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <p className="hidden text-sm text-muted-foreground sm:block">Project details and metadata.</p>
                  {canEdit && (
                    <Button
                      size="sm"
                      variant={aboutEditMode ? "destructive" : "default"}
                      className={aboutEditMode ? "h-8 px-2.5 text-xs sm:h-9 sm:px-3 sm:text-sm" : "h-8 bg-primary px-2.5 text-xs text-primary-foreground hover:bg-primary/90 sm:h-9 sm:px-3 sm:text-sm"}
                      onClick={() => setAboutEditMode((open) => !open)}
                    >
                      {aboutEditMode ? "Cancel" : "Edit Details"}
                    </Button>
                  )}
                </div>

                {aboutEditMode && (
                  <div className="rounded-lg border border-border/70 bg-background/50 p-3 sm:p-4">
                    <Label className="text-[10px] uppercase tracking-wide text-muted-foreground sm:text-[11px]">Project Name</Label>
                    <Input className="mt-1 h-8 text-xs sm:h-9 sm:text-sm" value={quickEditName} onChange={(e) => setQuickEditName(e.target.value)} />
                  </div>
                )}

                <div className="grid grid-cols-2 gap-2 sm:gap-3 md:gap-4 xl:grid-cols-4">
                  <div className="order-1 col-span-2 rounded-lg border border-border/70 bg-background/50 p-3 sm:p-3.5 xl:col-span-2">
                    <Label className="text-[10px] uppercase tracking-wide text-muted-foreground sm:text-[11px]">Date Range</Label>
                    {aboutEditMode ? (
                      <DateRangePicker
                        numberOfMonths={isMobileViewport ? 1 : 2}
                        showPresets={false}
                        className="mt-1 text-xs sm:text-sm [&_button]:h-8 [&_button]:text-xs sm:[&_button]:h-9 sm:[&_button]:text-sm"
                        date={dateRange}
                        onDateChange={(range) => {
                          setQuickEditStartDate(serializeIsoDate(range?.from));
                          setQuickEditDeadline(serializeIsoDate(range?.to));
                        }}
                      />
                    ) : (
                      <p className="mt-1 text-xs font-medium sm:text-sm">{formatDateLabel(project.start_date)} to {formatDateLabel(project.deadline)}</p>
                    )}
                  </div>

                  <div className="order-5 col-span-2 rounded-lg border border-border/70 bg-background/50 p-3 sm:p-3.5 xl:order-5 xl:col-span-2">
                    <Label className="text-[10px] uppercase tracking-wide text-muted-foreground sm:text-[11px]">Labels</Label>
                    {aboutEditMode ? (
                      <div className="mt-1.5 space-y-1.5 sm:mt-2 sm:space-y-2">
                        <div className="flex flex-wrap gap-1.5">
                          {quickEditLabels.length > 0 ? quickEditLabels.map((label) => (
                            <Badge key={label} variant="outline" className="inline-flex items-center gap-1 text-xs">
                              {label}
                              <button
                                type="button"
                                className="text-muted-foreground hover:text-foreground"
                                onClick={() => setQuickEditLabels((prev) => prev.filter((item) => item !== label))}
                              >
                                ×
                              </button>
                            </Badge>
                          )) : <span className="text-xs text-muted-foreground sm:text-sm">No labels</span>}
                        </div>
                        <div className="flex gap-2">
                          <Input
                            value={quickEditLabelInput}
                            onChange={(event) => setQuickEditLabelInput(event.target.value)}
                            onKeyDown={(event) => {
                              if (event.key === "Enter" || event.key === ",") {
                                event.preventDefault();
                                addQuickEditLabel();
                              }
                            }}
                            className="h-8 sm:h-9"
                            placeholder="Add label"
                          />
                          <Button type="button" size="sm" variant="outline" className="h-8 px-2.5 text-xs sm:h-9 sm:px-3 sm:text-sm" onClick={addQuickEditLabel}>Add</Button>
                        </div>
                      </div>
                    ) : (
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {(project.labels || []).length > 0 ? (project.labels || []).map((label) => (
                          <span key={label} className="rounded-full border border-border/70 bg-accent/30 px-2 py-0.5 text-xs">{label}</span>
                        )) : <span className="text-xs text-muted-foreground sm:text-sm">No labels</span>}
                      </div>
                    )}
                  </div>

                  <div className="order-2 col-span-2 rounded-lg border border-border/70 bg-background/50 p-3 sm:p-3.5 xl:order-3 xl:col-span-1">
                    <Label className="block text-[10px] uppercase tracking-wide text-muted-foreground sm:text-[11px]">Status</Label>
                    {aboutEditMode ? (
                      <Select value={quickEditStatus} onValueChange={(value) => setQuickEditStatus(value as ProjectStatus)}>
                        <SelectTrigger className="mt-1 h-8 text-xs sm:h-9 sm:text-sm"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="active">Active</SelectItem>
                          <SelectItem value="in-progress">In progress</SelectItem>
                          <SelectItem value="on-hold">On hold</SelectItem>
                          <SelectItem value="completed">Completed</SelectItem>
                          <SelectItem value="closed">Closed</SelectItem>
                        </SelectContent>
                      </Select>
                    ) : (
                      <Badge className={cn("mt-1 border text-[10px] capitalize sm:text-[11px]", PROJECT_STATUS_BADGE_CLASS[project.status])}>{project.status}</Badge>
                    )}
                  </div>

                  <div className="order-3 rounded-lg border border-border/70 bg-background/50 p-3 sm:p-3.5 xl:order-4">
                    <Label className="text-[10px] uppercase tracking-wide text-muted-foreground sm:text-[11px]">Budget</Label>
                    {aboutEditMode ? (
                      <Input type="number" min="0" className="mt-1 h-8 text-xs sm:h-9 sm:text-sm" value={quickEditBudget} onChange={(e) => setQuickEditBudget(e.target.value)} />
                    ) : (
                      <p className="mt-1 text-xs font-medium sm:text-sm">{project.budget ? `$${project.budget.toLocaleString()}` : "-"}</p>
                    )}
                  </div>

                  <div className="order-4 rounded-lg border border-border/70 bg-background/50 p-3 sm:p-3.5 xl:order-2 xl:col-span-2">
                    <Label className="text-[10px] uppercase tracking-wide text-muted-foreground sm:text-[11px]">Client</Label>
                    {aboutEditMode ? (
                      <Popover open={clientPickerOpen} onOpenChange={setClientPickerOpen}>
                        <PopoverTrigger asChild>
                          <Button
                            variant="outline"
                            role="combobox"
                            aria-expanded={clientPickerOpen}
                            className="mt-1 h-8 w-full justify-between px-2 text-xs font-normal sm:h-9 sm:text-sm"
                          >
                            <span className="truncate text-left">
                              {quickEditClient || "Select client"}
                            </span>
                            <ChevronsUpDown className="ml-2 h-3.5 w-3.5 shrink-0 opacity-50" />
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
                          <Command>
                            <CommandInput
                              placeholder="Search clients..."
                              className="no-global-focus-ring h-10 border-0 outline-none ring-0 focus:outline-none focus:ring-0 focus-visible:outline-none focus-visible:ring-0"
                            />
                            <CommandList className="max-h-[220px]">
                              <CommandEmpty>No client found.</CommandEmpty>
                              <CommandGroup>
                                <CommandItem
                                  value="__no_client__"
                                  onSelect={() => {
                                    setQuickEditClient("");
                                    setClientPickerOpen(false);
                                  }}
                                >
                                  <Check className={cn("mr-2 h-4 w-4", quickEditClient ? "opacity-0" : "opacity-100")} />
                                  <span>No client</span>
                                </CommandItem>
                                {clients.map((client) => (
                                  <CommandItem
                                    key={client.id}
                                    value={`${client.name} ${client.id}`}
                                    onSelect={() => {
                                      setQuickEditClient(client.name);
                                      setClientPickerOpen(false);
                                    }}
                                  >
                                    <Check
                                      className={cn(
                                        "mr-2 h-4 w-4",
                                        quickEditClient === client.name ? "opacity-100" : "opacity-0"
                                      )}
                                    />
                                    <span className="truncate">{client.name}</span>
                                  </CommandItem>
                                ))}
                              </CommandGroup>
                            </CommandList>
                          </Command>
                        </PopoverContent>
                      </Popover>
                    ) : (
                      <p className="mt-1 text-xs font-medium sm:text-sm">{getClientDisplayName(project.client_name)}</p>
                    )}
                  </div>

                  <div className="order-6 col-span-2 rounded-lg border border-border/70 bg-background/50 p-3 sm:p-3.5 xl:col-span-4">
                    <Label className="text-[10px] uppercase tracking-wide text-muted-foreground sm:text-[11px]">Description</Label>
                    {aboutEditMode ? (
                      <Textarea className="mt-1 min-h-20 text-xs sm:min-h-24 sm:text-sm" rows={3} value={quickEditDescription} onChange={(e) => setQuickEditDescription(e.target.value)} />
                    ) : (
                      <div className="space-y-2">
                        <div
                          className={cn(
                            "prose prose-sm mt-1 max-w-none text-xs text-muted-foreground sm:text-sm",
                            !aboutDescriptionExpanded && "max-h-24 overflow-hidden sm:max-h-40",
                          )}
                          title={trimmedDescription || "No description available."}
                          dangerouslySetInnerHTML={{
                            __html: trimmedDescription
                              ? renderMarkdownHtml(trimmedDescription)
                              : "<p class=\"text-muted-foreground\">No description available.</p>",
                          }}
                        />
                        {aboutDescriptionNeedsToggle && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="h-8 px-2 text-xs"
                            onClick={() => setAboutDescriptionExpanded((value) => !value)}
                          >
                            {aboutDescriptionExpanded ? "Show less" : "Show more"}
                          </Button>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                {aboutEditMode && (
                  <div className="flex justify-end">
                    <Button size="sm" className="h-8 px-2.5 text-xs sm:h-9 sm:px-3 sm:text-sm" onClick={saveAbout} disabled={savingAbout || !quickEditName.trim()}>
                      {savingAbout ? "Saving..." : "Save Details"}
                    </Button>
                  </div>
                )}
              </TabsContent>
          </CardContent>

          <div className="sticky bottom-0 z-20 flex justify-end border-t border-border/60 bg-background/90 p-2.5 sm:p-4">
            <Button
              size="sm"
              className="h-8 w-full bg-primary px-2.5 text-xs text-primary-foreground hover:bg-primary/90 sm:h-9 sm:w-auto sm:px-3 sm:text-sm"
              onClick={() => onOpenProjectPage(project.id)}
            >
              Open Project Page
            </Button>
          </div>
        </Card>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
