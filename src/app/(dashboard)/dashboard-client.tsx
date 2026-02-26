"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowUpRight,
  CheckCircle2,
  Clock,
  Cog,
  DollarSign,
  FolderKanban,
  GripVertical,
  ChevronUp,
  ChevronDown,
  ListChecks,
  Loader2,
  PauseCircle,
  Plus,
  Minus,
  Users,
  Circle,
} from "lucide-react";

import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DateRangePicker } from "@/components/ui/date-range-picker";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import MemberAvatar from "@/components/member-avatar";
import { useTheme } from "@/components/theme-provider";
import { useUser } from "@/components/user-provider";
import { cn } from "@/lib/utils";

type Project = {
  id: string;
  name: string;
  status: "active" | "in-progress" | "on-hold" | "completed" | "closed";
  client_name?: string | null;
  deadline: string | null;
  start_date?: string | null;
  budget: number | null;
  description?: string | null;
  labels?: string[] | null;
  task_count?: number;
  project_members?: Array<{
    members?: {
      id?: string | null;
      name?: string | null;
      email?: string | null;
      user_id?: string | null;
      avatar_url?: string | null;
    } | null;
  }>;
  created_at: string;
};

type Task = {
  id: string;
  status: "todo" | "in-progress" | "done";
  due_date: string | null;
};

type Member = {
  id: string;
  name: string;
  email?: string | null;
  role?: string | null;
  user_id?: string | null;
  avatar_url?: string | null;
};

type ProjectTaskPreview = {
  id: string;
  title: string;
  status: "todo" | "in-progress" | "done";
  priority?: "low" | "medium" | "high" | "urgent";
  description?: string | null;
  due_date: string | null;
  assignee_member_id?: string | null;
};

type WidgetId =
  | "totalProjects"
  | "activeProjects"
  | "completedProjects"
  | "onHoldProjects"
  | "totalBudget"
  | "todoTasks"
  | "inProgressTasks"
  | "overdueTasks"
  | "teamMembers"
  | "recentProjects";

type WidgetSize = "sm" | "md" | "lg" | "xl";

type DashboardLayoutItem = {
  id: WidgetId;
  size: WidgetSize;
};

type DashboardPreferences = {
  layout: DashboardLayoutItem[];
  hiddenWidgetIds: WidgetId[];
};

type LayoutMode = "desktop" | "mobile";

type WidgetDefinition = {
  id: WidgetId;
  title: string;
  description: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
};

const LOCAL_STORAGE_KEY = "projecthub-dashboard-preferences-v2";

function localStorageKeyForMode(mode: LayoutMode) {
  return `${LOCAL_STORAGE_KEY}-${mode}`;
}

// Rollback switch: set false to return to standalone Recent Projects card.
const ENABLE_RECENT_PROJECTS_WIDGET = true;

const DEFAULT_LAYOUT: DashboardLayoutItem[] = [
  { id: "totalProjects", size: "sm" },
  { id: "activeProjects", size: "sm" },
  { id: "completedProjects", size: "sm" },
  { id: "totalBudget", size: "sm" },
  { id: "todoTasks", size: "sm" },
  { id: "inProgressTasks", size: "sm" },
  { id: "overdueTasks", size: "sm" },
  { id: "teamMembers", size: "sm" },
  { id: "onHoldProjects", size: "sm" },
  ...(ENABLE_RECENT_PROJECTS_WIDGET ? ([{ id: "recentProjects", size: "md" }] as DashboardLayoutItem[]) : []),
];

const WIDGETS: WidgetDefinition[] = [
  {
    id: "totalProjects",
    title: "Total Projects",
    description: "All projects in the workspace",
    href: "/projects",
    icon: FolderKanban,
  },
  {
    id: "activeProjects",
    title: "Active Projects",
    description: "Projects currently active",
    href: "/projects?status=active",
    icon: Clock,
  },
  {
    id: "completedProjects",
    title: "Completed Projects",
    description: "Projects marked completed",
    href: "/projects?status=completed",
    icon: CheckCircle2,
  },
  {
    id: "onHoldProjects",
    title: "On Hold Projects",
    description: "Projects paused by the team",
    href: "/projects?status=on-hold",
    icon: PauseCircle,
  },
  {
    id: "totalBudget",
    title: "Total Budget",
    description: "Budget sum across projects",
    href: "/reports",
    icon: DollarSign,
  },
  {
    id: "todoTasks",
    title: "Todo Tasks",
    description: "Tasks waiting to start",
    href: "/tasks",
    icon: ListChecks,
  },
  {
    id: "inProgressTasks",
    title: "In Progress Tasks",
    description: "Tasks currently in progress",
    href: "/tasks",
    icon: Clock,
  },
  {
    id: "overdueTasks",
    title: "Overdue Tasks",
    description: "Tasks with due date in the past",
    href: "/tasks",
    icon: PauseCircle,
  },
  {
    id: "teamMembers",
    title: "Team Members",
    description: "People in your workspace",
    href: "/team",
    icon: Users,
  },
  ...(ENABLE_RECENT_PROJECTS_WIDGET
    ? ([
        {
          id: "recentProjects",
          title: "Recent Projects",
          description: "Latest projects with quick access",
          href: "/projects",
          icon: FolderKanban,
        },
      ] as WidgetDefinition[])
    : []),
];

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

const PROJECT_STATUS_BADGE_CLASS: Record<Project["status"], string> = {
  active: "bg-emerald-500/15 text-emerald-200 border-emerald-500/40",
  "in-progress": "bg-blue-500/15 text-blue-200 border-blue-500/40",
  "on-hold": "bg-amber-500/15 text-amber-200 border-amber-500/40",
  completed: "bg-violet-500/15 text-violet-200 border-violet-500/40",
  closed: "bg-zinc-500/15 text-zinc-200 border-zinc-500/40",
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

function widgetMinSize(id: WidgetId): WidgetSize {
  return id === "recentProjects" ? "sm" : "sm";
}

function sizeToRank(size: WidgetSize) {
  if (size === "sm") return 1;
  if (size === "md") return 2;
  if (size === "lg") return 3;
  return 4;
}

function rankToSize(rank: number): WidgetSize {
  if (rank <= 1) return "sm";
  if (rank === 2) return "md";
  if (rank === 3) return "lg";
  return "xl";
}

function clampWidgetSize(id: WidgetId, size: WidgetSize): WidgetSize {
  return rankToSize(Math.max(sizeToRank(size), sizeToRank(widgetMinSize(id))));
}

function getTodayDateKey() {
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const dd = String(now.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function getWidgetSpanClass(size: WidgetSize) {
  switch (size) {
    case "sm":
      return "md:col-span-3";
    case "md":
      return "md:col-span-6";
    case "lg":
      return "md:col-span-9";
    case "xl":
      return "md:col-span-12";
    default:
      return "md:col-span-6";
  }
}

function formatDateLabel(value: string | null | undefined) {
  if (!value) return "-";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "-";
  return parsed.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function getTimelineProgress(startDate?: string | null, deadline?: string | null) {
  if (!startDate || !deadline) {
    return {
      hasTimeline: false,
      progress: 0,
      daysLeft: null as number | null,
      durationDays: null as number | null,
    };
  }

  const start = new Date(startDate);
  const end = new Date(deadline);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end <= start) {
    return {
      hasTimeline: false,
      progress: 0,
      daysLeft: null as number | null,
      durationDays: null as number | null,
    };
  }

  const now = new Date();
  const duration = end.getTime() - start.getTime();
  const elapsed = Math.min(Math.max(now.getTime() - start.getTime(), 0), duration);
  const progress = Math.round((elapsed / duration) * 100);
  const daysLeft = Math.ceil((end.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  const durationDays = Math.max(1, Math.ceil(duration / (1000 * 60 * 60 * 24)));

  return {
    hasTimeline: true,
    progress,
    daysLeft,
    durationDays,
  };
}

function normalizePreferences(input: unknown): DashboardPreferences {
  if (!input || typeof input !== "object") {
    return { layout: DEFAULT_LAYOUT, hiddenWidgetIds: [] };
  }

  const raw = input as Partial<DashboardPreferences>;
  const knownIds = new Set(WIDGETS.map((widget) => widget.id));

  const layout = (Array.isArray(raw.layout) ? raw.layout : DEFAULT_LAYOUT)
    .filter((item): item is DashboardLayoutItem => {
      if (!item || typeof item !== "object") return false;
      const maybe = item as DashboardLayoutItem;
      return knownIds.has(maybe.id);
    })
    .map((item) => ({
      id: item.id,
      size: clampWidgetSize(
        item.id,
        (["sm", "md", "lg", "xl"].includes(item.size) ? item.size : "sm") as WidgetSize,
      ),
    }));

  const hiddenWidgetIds = (Array.isArray(raw.hiddenWidgetIds) ? raw.hiddenWidgetIds : []).filter(
    (id): id is WidgetId => knownIds.has(id as WidgetId),
  );

  const seen = new Set(layout.map((item) => item.id));
  const mergedLayout = [...layout];
  for (const fallback of DEFAULT_LAYOUT) {
    if (!seen.has(fallback.id)) {
      mergedLayout.push(fallback);
    }
  }

  return {
    layout: mergedLayout,
    hiddenWidgetIds,
  };
}

export default function DashboardClient() {
  const router = useRouter();
  const { accentColor } = useTheme();
  const { profile } = useUser();

  const [projects, setProjects] = useState<Project[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [customizationOpen, setCustomizationOpen] = useState(false);
  const [draggedWidgetId, setDraggedWidgetId] = useState<WidgetId | null>(null);
  const [selectedRecentProjectId, setSelectedRecentProjectId] = useState<string | null>(null);
  const [preferences, setPreferences] = useState<DashboardPreferences>({
    layout: DEFAULT_LAYOUT,
    hiddenWidgetIds: [],
  });
  const [persistNotice, setPersistNotice] = useState<string | null>(null);
  const [layoutChangedByUser, setLayoutChangedByUser] = useState(false);
  const [hasLoadedPreferences, setHasLoadedPreferences] = useState(false);
  const [skipInitialPersist, setSkipInitialPersist] = useState(true);
  const [layoutMode, setLayoutMode] = useState<LayoutMode | null>(null);
  const [previewTasks, setPreviewTasks] = useState<ProjectTaskPreview[]>([]);
  const [selectedPreviewTask, setSelectedPreviewTask] = useState<ProjectTaskPreview | null>(null);
  const [previewTasksLoading, setPreviewTasksLoading] = useState(false);
  const [previewTasksExpanded, setPreviewTasksExpanded] = useState(false);
  const [previewDescriptionExpanded, setPreviewDescriptionExpanded] = useState(false);
  const [quickEditMode, setQuickEditMode] = useState(false);
  const [quickEditSaving, setQuickEditSaving] = useState(false);
  const [quickEditName, setQuickEditName] = useState("");
  const [quickEditStatus, setQuickEditStatus] = useState<Project["status"]>("active");
  const [quickEditStartDate, setQuickEditStartDate] = useState("");
  const [quickEditDeadline, setQuickEditDeadline] = useState("");
  const [quickEditBudget, setQuickEditBudget] = useState("");
  const [quickEditClient, setQuickEditClient] = useState("");
  const [quickEditDescription, setQuickEditDescription] = useState("");
  const [quickEditMemberIds, setQuickEditMemberIds] = useState<string[]>([]);
  const [quickEditLabels, setQuickEditLabels] = useState<string[]>([]);
  const [quickEditLabelInput, setQuickEditLabelInput] = useState("");
  const [welcomeMessage, setWelcomeMessage] = useState("Welcome back to ProjectHub.");

  useEffect(() => {
    if (typeof window === "undefined") return;

    const media = window.matchMedia("(max-width: 767px)");
    const applyMode = (isMobile: boolean) => {
      setLayoutMode(isMobile ? "mobile" : "desktop");
    };

    applyMode(media.matches);

    const onChange = (event: MediaQueryListEvent) => {
      applyMode(event.matches);
    };

    media.addEventListener("change", onChange);
    return () => media.removeEventListener("change", onChange);
  }, []);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [projectsRes, tasksRes, membersRes] = await Promise.all([
        fetch("/api/projects", { cache: "no-store" }),
        fetch("/api/tasks", { cache: "no-store" }),
        fetch("/api/members", { cache: "no-store" }),
      ]);
      const [projectsData, tasksData, membersData] = await Promise.all([
        projectsRes.json(),
        tasksRes.json(),
        membersRes.json(),
      ]);

      setProjects(Array.isArray(projectsData) ? projectsData : []);
      setTasks(Array.isArray(tasksData) ? tasksData : []);
      setMembers(Array.isArray(membersData) ? membersData : []);
    } catch {
      setProjects([]);
      setTasks([]);
      setMembers([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const firstName =
      profile?.full_name?.split(" ")[0] ||
      profile?.email?.split("@")[0] ||
      "there";

    const messages = [
      `Welcome back, ${firstName}. Let's move ProjectHub forward today.`,
      `${firstName}, your ProjectHub command center is ready.`,
      `Great to see you, ${firstName}. Pick one win and ship it in ProjectHub.`,
      `${firstName}, your team momentum starts here in ProjectHub.`,
    ];

    setWelcomeMessage(messages[Math.floor(Math.random() * messages.length)]);
  }, [profile?.email, profile?.full_name]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  useEffect(() => {
    if (!layoutMode) return;

    setHasLoadedPreferences(false);
    setSkipInitialPersist(true);

    let isMounted = true;

    const loadPreferences = async () => {
      let hasLocalPreferences = false;
      const localKey = localStorageKeyForMode(layoutMode);
      if (typeof window !== "undefined") {
        const raw = window.localStorage.getItem(localKey);
        if (raw) {
          try {
            const local = normalizePreferences(JSON.parse(raw));
            if (isMounted) {
              setPreferences(local);
            }
            hasLocalPreferences = true;
          } catch {
            // ignore malformed local cache
          }
        }
      }

      try {
        const response = await fetch(`/api/dashboard/preferences?device=${layoutMode}`, {
          cache: "no-store",
        });
        const payload = await response.json();

        if (!isMounted) return;

        if (response.ok && payload?.preferences) {
          const normalized = normalizePreferences(payload?.preferences);
          const serverFallbackWarning = typeof payload?.warning === "string";

            if (!serverFallbackWarning || !hasLocalPreferences) {
              setPreferences(normalized);
              if (typeof window !== "undefined") {
                window.localStorage.setItem(localKey, JSON.stringify(normalized));
              }
            }
        } else {
          throw new Error("Preferences API unavailable");
        }
      } catch {
        if (!isMounted) return;
        if (!hasLocalPreferences) {
          setPreferences({ layout: DEFAULT_LAYOUT, hiddenWidgetIds: [] });
        }
      } finally {
        if (isMounted) {
          setHasLoadedPreferences(true);
        }
      }
    };

    void loadPreferences();

    return () => {
      isMounted = false;
    };
  }, [layoutMode]);

  useEffect(() => {
    if (!hasLoadedPreferences || !layoutMode) return;

    if (skipInitialPersist) {
      setSkipInitialPersist(false);
      return;
    }

    if (!layoutChangedByUser) return;

    let cancelled = false;
    const timer = setTimeout(async () => {
      try {
        const response = await fetch(`/api/dashboard/preferences?device=${layoutMode}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ preferences }),
        });
        const payload = await response.json().catch(() => null);

        if (!cancelled) {
          if (response.ok) {
            const savedMessage = payload?.warning
              ? "Saved locally. Apply DB migration for cross-device sync."
              : `Saved ${layoutMode} layout`;
            setPersistNotice(savedMessage);
            setTimeout(() => {
              setPersistNotice((current) => (current === savedMessage ? null : current));
            }, 900);
            setLayoutChangedByUser(false);
          } else {
            setPersistNotice("Saved locally. Database sync unavailable right now.");
          }
        }
      } catch {
        if (!cancelled) {
          setPersistNotice("Saved locally. Database sync unavailable right now.");
        }
      }

      if (typeof window !== "undefined") {
        window.localStorage.setItem(
          localStorageKeyForMode(layoutMode),
          JSON.stringify(preferences),
        );
      }
    }, 250);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [preferences, hasLoadedPreferences, layoutMode, skipInitialPersist, layoutChangedByUser]);

  const projectStats = useMemo(() => {
    const totalProjects = projects.length;
    const activeProjects = projects.filter((project) => project.status === "active").length;
    const completedProjects = projects.filter((project) => project.status === "completed").length;
    const onHoldProjects = projects.filter((project) => project.status === "on-hold").length;
    const totalBudget = projects.reduce((sum, project) => sum + Number(project.budget || 0), 0);

    return {
      totalProjects,
      activeProjects,
      completedProjects,
      onHoldProjects,
      totalBudget,
    };
  }, [projects]);

  const taskStats = useMemo(() => {
    const today = getTodayDateKey();

    const todoTasks = tasks.filter((task) => task.status === "todo").length;
    const inProgressTasks = tasks.filter((task) => task.status === "in-progress").length;
    const overdueTasks = tasks.filter(
      (task) => task.status !== "done" && task.due_date !== null && task.due_date < today,
    ).length;

    return {
      todoTasks,
      inProgressTasks,
      overdueTasks,
    };
  }, [tasks]);

  const memberStats = useMemo(() => {
    const uniqueMembers = members.filter((member, index, all) => {
      const key = (member.user_id || member.email || member.id).toLowerCase();
      return (
        all.findIndex((candidate) =>
          (candidate.user_id || candidate.email || candidate.id).toLowerCase() === key,
        ) === index
      );
    });

    const admins = uniqueMembers.filter((member) => member.role === "admin").length;

    return {
      total: uniqueMembers.length,
      admins,
      contributors: Math.max(0, uniqueMembers.length - admins),
      recent: uniqueMembers.slice(0, 5),
    };
  }, [members]);

  const widgetValues = useMemo(
    () => ({
      totalProjects: projectStats.totalProjects.toString(),
      activeProjects: projectStats.activeProjects.toString(),
      completedProjects: projectStats.completedProjects.toString(),
      onHoldProjects: projectStats.onHoldProjects.toString(),
      totalBudget: `$${projectStats.totalBudget.toLocaleString()}`,
      todoTasks: taskStats.todoTasks.toString(),
      inProgressTasks: taskStats.inProgressTasks.toString(),
      overdueTasks: taskStats.overdueTasks.toString(),
      teamMembers: memberStats.total.toString(),
      recentProjects: "",
    }),
    [memberStats.total, projectStats, taskStats],
  );

  const orderedVisibleWidgets = useMemo(() => {
    const hidden = new Set(preferences.hiddenWidgetIds);
    return preferences.layout.filter((item) => !hidden.has(item.id));
  }, [preferences]);

  const addWidget = (id: WidgetId) => {
    setLayoutChangedByUser(true);
    setPreferences((prev) => {
      if (!prev.layout.some((item) => item.id === id)) {
        return {
          ...prev,
          layout: [...prev.layout, { id, size: widgetMinSize(id) }],
          hiddenWidgetIds: prev.hiddenWidgetIds.filter((hiddenId) => hiddenId !== id),
        };
      }

      return {
        ...prev,
        hiddenWidgetIds: prev.hiddenWidgetIds.filter((hiddenId) => hiddenId !== id),
      };
    });
  };

  const hideWidget = (id: WidgetId) => {
    setLayoutChangedByUser(true);
    setPreferences((prev) => {
      if (prev.hiddenWidgetIds.includes(id)) return prev;
      return {
        ...prev,
        hiddenWidgetIds: [...prev.hiddenWidgetIds, id],
      };
    });
  };

  const growWidget = (id: WidgetId) => {
    setLayoutChangedByUser(true);
    setPreferences((prev) => ({
      ...prev,
      layout: prev.layout.map((item) => {
        if (item.id !== id) return item;
        if (item.size === "sm") return { ...item, size: clampWidgetSize(item.id, "md") };
        if (item.size === "md") return { ...item, size: clampWidgetSize(item.id, "lg") };
        if (item.size === "lg") return { ...item, size: clampWidgetSize(item.id, "xl") };
        return item;
      }),
    }));
  };

  const shrinkWidget = (id: WidgetId) => {
    setLayoutChangedByUser(true);
    setPreferences((prev) => ({
      ...prev,
      layout: prev.layout.map((item) => {
        if (item.id !== id) return item;
        if (item.size === "xl") return { ...item, size: clampWidgetSize(item.id, "lg") };
        if (item.size === "lg") return { ...item, size: clampWidgetSize(item.id, "md") };
        if (item.size === "md") return { ...item, size: clampWidgetSize(item.id, "sm") };
        return item;
      }),
    }));
  };

  const reorderWidget = (fromId: WidgetId, toId: WidgetId) => {
    if (fromId === toId) return;

    setLayoutChangedByUser(true);

    setPreferences((prev) => {
      const fromIndex = prev.layout.findIndex((item) => item.id === fromId);
      const toIndex = prev.layout.findIndex((item) => item.id === toId);
      if (fromIndex === -1 || toIndex === -1) return prev;

      const next = [...prev.layout];
      const [moved] = next.splice(fromIndex, 1);
      next.splice(toIndex, 0, moved);

      return { ...prev, layout: next };
    });
  };

  const moveWidget = (id: WidgetId, direction: "up" | "down") => {
    setLayoutChangedByUser(true);
    setPreferences((prev) => {
      const index = prev.layout.findIndex((item) => item.id === id);
      if (index === -1) return prev;

      const targetIndex = direction === "up" ? index - 1 : index + 1;
      if (targetIndex < 0 || targetIndex >= prev.layout.length) return prev;

      const next = [...prev.layout];
      [next[index], next[targetIndex]] = [next[targetIndex], next[index]];
      return { ...prev, layout: next };
    });
  };

  const restoreDefaults = () => {
    setLayoutChangedByUser(true);
    setPreferences({ layout: DEFAULT_LAYOUT, hiddenWidgetIds: [] });
    setPersistNotice("Dashboard reset to defaults.");
    setTimeout(() => setPersistNotice(null), 1800);
  };

  const hiddenWidgetSet = new Set(preferences.hiddenWidgetIds);
  const hiddenWidgets = WIDGETS.filter((widget) => hiddenWidgetSet.has(widget.id));

  const widgetDetailBars = useMemo(() => {
    const projectMax = Math.max(
      1,
      projectStats.totalProjects,
      projectStats.activeProjects,
      projectStats.completedProjects,
      projectStats.onHoldProjects,
    );
    const taskMax = Math.max(1, taskStats.todoTasks, taskStats.inProgressTasks, taskStats.overdueTasks);

    return {
      totalProjects: [
        { label: "Active", value: projectStats.activeProjects, max: projectMax },
        { label: "Completed", value: projectStats.completedProjects, max: projectMax },
        { label: "On hold", value: projectStats.onHoldProjects, max: projectMax },
      ],
      activeProjects: [
        { label: "Active", value: projectStats.activeProjects, max: projectMax },
        { label: "All", value: projectStats.totalProjects, max: projectMax },
      ],
      completedProjects: [
        { label: "Completed", value: projectStats.completedProjects, max: projectMax },
        { label: "All", value: projectStats.totalProjects, max: projectMax },
      ],
      onHoldProjects: [
        { label: "On hold", value: projectStats.onHoldProjects, max: projectMax },
        { label: "All", value: projectStats.totalProjects, max: projectMax },
      ],
      totalBudget: [
        { label: "Projects", value: projectStats.totalProjects, max: projectMax },
        { label: "Active", value: projectStats.activeProjects, max: projectMax },
      ],
      todoTasks: [
        { label: "Todo", value: taskStats.todoTasks, max: taskMax },
        { label: "In progress", value: taskStats.inProgressTasks, max: taskMax },
      ],
      inProgressTasks: [
        { label: "In progress", value: taskStats.inProgressTasks, max: taskMax },
        { label: "Todo", value: taskStats.todoTasks, max: taskMax },
      ],
      overdueTasks: [
        { label: "Overdue", value: taskStats.overdueTasks, max: taskMax },
        { label: "In progress", value: taskStats.inProgressTasks, max: taskMax },
      ],
      teamMembers: [
        { label: "Admins", value: memberStats.admins, max: Math.max(1, memberStats.total) },
        { label: "Contributors", value: memberStats.contributors, max: Math.max(1, memberStats.total) },
      ],
      recentProjects: [],
    } as const;
  }, [memberStats, projectStats, taskStats]);

  const recentProjects = useMemo(() => {
    return [...projects]
      .sort((a, b) => {
        const aDate = new Date(a.created_at).getTime();
        const bDate = new Date(b.created_at).getTime();
        return bDate - aDate;
      })
      .slice(0, 6);
  }, [projects]);

  const selectedRecentProject = useMemo(() => {
    if (!selectedRecentProjectId) return null;
    return recentProjects.find((project) => project.id === selectedRecentProjectId) || null;
  }, [recentProjects, selectedRecentProjectId]);

  useEffect(() => {
    if (!selectedRecentProject) return;

    const handleEsc = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setSelectedRecentProjectId(null);
      }
    };

    window.addEventListener("keydown", handleEsc);
    return () => window.removeEventListener("keydown", handleEsc);
  }, [selectedRecentProject]);

  useEffect(() => {
    if (!selectedRecentProject) return;

    setPreviewTasksExpanded(false);
    setPreviewDescriptionExpanded(false);
    setSelectedPreviewTask(null);
    setQuickEditMode(false);
    setQuickEditName(selectedRecentProject.name || "");
    setQuickEditStatus(selectedRecentProject.status || "active");
    setQuickEditStartDate(selectedRecentProject.start_date || "");
    setQuickEditDeadline(selectedRecentProject.deadline || "");
    setQuickEditBudget(
      typeof selectedRecentProject.budget === "number" && !Number.isNaN(selectedRecentProject.budget)
        ? String(selectedRecentProject.budget)
        : "",
    );
    setQuickEditClient(selectedRecentProject.client_name || "");
    setQuickEditDescription(selectedRecentProject.description || "");
    setQuickEditMemberIds(
      (selectedRecentProject.project_members || [])
        .map((pm) => pm.members?.id)
        .filter((id): id is string => Boolean(id))
    );
    setQuickEditLabels(selectedRecentProject.labels || []);
    setQuickEditLabelInput("");
    setPreviewTasksLoading(true);

    const loadProjectTasks = async () => {
      try {
        const response = await fetch(`/api/tasks?projectId=${selectedRecentProject.id}`, {
          cache: "no-store",
        });
        const data = await response.json().catch(() => []);
        if (response.ok && Array.isArray(data)) {
          setPreviewTasks(data);
        } else {
          setPreviewTasks([]);
        }
      } catch {
        setPreviewTasks([]);
      } finally {
        setPreviewTasksLoading(false);
      }
    };

    void loadProjectTasks();
  }, [selectedRecentProject]);

  const getMemberName = useCallback(
    (memberId?: string | null) => {
      if (!memberId) return "Unassigned";
      return members.find((member) => member.id === memberId)?.name || "Unassigned";
    },
    [members],
  );

  const saveQuickEdit = useCallback(async () => {
    if (!selectedRecentProject || !quickEditName.trim()) return;
    setQuickEditSaving(true);

    try {
      const payload = {
        name: quickEditName.trim(),
        status: quickEditStatus,
        start_date: quickEditStartDate || null,
        deadline: quickEditDeadline || null,
        budget: quickEditBudget.trim() === "" ? null : Number(quickEditBudget),
        client_name: quickEditClient.trim() || null,
        description: quickEditDescription.trim() || null,
        member_ids: quickEditMemberIds,
        labels: quickEditLabels,
      };

      const response = await fetch(`/api/projects/${selectedRecentProject.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const updated = await response.json().catch(() => null);
      if (!response.ok || !updated) {
        throw new Error("Failed to save quick edit");
      }

      setProjects((prev) =>
        prev.map((project) =>
          project.id === selectedRecentProject.id
            ? {
                ...project,
                ...updated,
              }
            : project,
        ),
      );
      setQuickEditMode(false);
      setPersistNotice("Project quick edit saved.");
      setTimeout(() => {
        setPersistNotice((current) => (current === "Project quick edit saved." ? null : current));
      }, 1400);
    } catch {
      setPersistNotice("Unable to save quick edit right now.");
    } finally {
      setQuickEditSaving(false);
    }
  }, [
    quickEditBudget,
    quickEditClient,
    quickEditDeadline,
    quickEditDescription,
    quickEditName,
    quickEditStartDate,
    quickEditStatus,
    quickEditMemberIds,
    quickEditLabels,
    selectedRecentProject,
  ]);

  const closeProjectPreview = useCallback(() => {
    setSelectedRecentProjectId(null);
    setSelectedPreviewTask(null);
    setQuickEditMode(false);
    setPreviewTasksExpanded(false);
    setPreviewDescriptionExpanded(false);
  }, []);

  const toggleQuickEditMember = useCallback((memberId: string) => {
    setQuickEditMemberIds((prev) =>
      prev.includes(memberId) ? prev.filter((id) => id !== memberId) : [...prev, memberId]
    );
  }, []);

  const addQuickEditLabel = useCallback(() => {
    const normalized = quickEditLabelInput.trim().replace(/,/g, "");
    if (!normalized) return;
    setQuickEditLabels((prev) => (prev.includes(normalized) ? prev : [...prev, normalized]));
    setQuickEditLabelInput("");
  }, [quickEditLabelInput]);

  const selectedPreviewTaskCount =
    selectedRecentProject && typeof selectedRecentProject.task_count === "number"
      ? selectedRecentProject.task_count
      : previewTasks.length;
  const selectedPreviewDescription = selectedRecentProject?.description || "";
  const shouldClampPreviewDescription = selectedPreviewDescription.length > 220;
  const previewDescriptionText =
    shouldClampPreviewDescription && !previewDescriptionExpanded
      ? `${selectedPreviewDescription.slice(0, 220).trimEnd()}...`
      : selectedPreviewDescription;

  const timelineMetrics = getTimelineProgress(
    selectedRecentProject?.start_date || null,
    selectedRecentProject?.deadline || null,
  );

  return (
    <div className="space-y-6 page-transition">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Dashboard</h1>
          <p className="text-sm text-muted-foreground sm:text-base">
            {welcomeMessage}
          </p>
        </div>
        <div className="flex flex-col items-start gap-2 sm:items-end">
          <Button
            type="button"
            variant="outline"
            className={cn(
              "w-fit gap-2",
              customizationOpen && "border-primary bg-primary/10 text-primary shadow-sm animate-pulse",
            )}
            style={
              customizationOpen
                ? {
                    borderColor: accentColor,
                    boxShadow: `0 0 0 1px ${accentColor}55, 0 0 16px ${accentColor}33`,
                  }
                : undefined
            }
            onClick={() => setCustomizationOpen((open) => !open)}
          >
            <Cog className="h-4 w-4" />
            {customizationOpen ? "Close Customization" : "Customize Dashboard"}
          </Button>
          {customizationOpen && (
            <Button type="button" variant="outline" size="sm" className="border-border/90 bg-background" onClick={restoreDefaults}>
              Restore Default Layout
            </Button>
          )}
        </div>
      </div>

      {customizationOpen && (
        <Card className="glass border-primary/40 bg-primary/5">
          <CardContent className="p-3 sm:p-4">
            <div className="flex flex-col gap-1 text-xs sm:text-sm">
              <p className="font-semibold text-primary">Customization mode is ON</p>
              <p className="text-muted-foreground">
                Drag cards to reorder. Use <span className="font-medium">↑/↓</span> to move on mobile,
                <span className="font-medium"> − / + </span>to resize, and <span className="font-medium">×</span> to hide.
                Hidden widgets appear below and can be restored with <span className="font-medium">+</span>.
                Changes save automatically.
              </p>
              {persistNotice && <p className="text-xs text-primary/90">{persistNotice}</p>}
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-12">
        {orderedVisibleWidgets.map((layoutItem) => {
          const widget = WIDGETS.find((item) => item.id === layoutItem.id);
          if (!widget) return null;

          const Icon = widget.icon;
          const value = widgetValues[widget.id];
          const isRecentProjectsWidget = widget.id === "recentProjects";
          const isTeamMembersWidget = widget.id === "teamMembers";
          const bars = widgetDetailBars[widget.id] || [];
          const recentRowsToShow =
            layoutItem.size === "sm" ? 2 : layoutItem.size === "md" ? 2 : layoutItem.size === "lg" ? 3 : 5;
          const canGrow = layoutItem.size !== "xl";
          const canShrink = layoutItem.size !== widgetMinSize(widget.id);

          return (
            <Card
              key={widget.id}
              draggable={customizationOpen}
              onDragStart={() => setDraggedWidgetId(widget.id)}
              onDragOver={(event) => {
                if (customizationOpen) {
                  event.preventDefault();
                }
              }}
              onDrop={() => {
                if (!customizationOpen || !draggedWidgetId) return;
                reorderWidget(draggedWidgetId, widget.id);
                setDraggedWidgetId(null);
              }}
              onDragEnd={() => setDraggedWidgetId(null)}
              className={cn(
                "glass relative border-border/70 transition-colors hover:border-primary/40",
                customizationOpen ? "cursor-grab active:cursor-grabbing" : "cursor-pointer",
                customizationOpen && "dashboard-widget-wiggle",
                isRecentProjectsWidget && layoutItem.size === "xl" && "min-h-[24rem]",
                isRecentProjectsWidget && layoutItem.size === "lg" && "min-h-[20rem]",
                getWidgetSpanClass(layoutItem.size),
              )}
              onClick={() => {
                if (customizationOpen) return;
                if (isRecentProjectsWidget) return;
                router.push(widget.href);
              }}
            >
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="space-y-0.5">
                    <CardTitle className="text-sm font-semibold">{widget.title}</CardTitle>
                    <p className="text-xs text-muted-foreground">{widget.description}</p>
                  </div>
                  <div className="flex items-center gap-1">
                    {customizationOpen && <GripVertical className="h-4 w-4 text-muted-foreground" />}
                    <Icon className="h-4 w-4 text-primary" />
                  </div>
                </div>
                {customizationOpen && (
                  <div
                    className="mt-2 flex items-center justify-end gap-1 rounded-lg border border-primary/40 bg-background/80 px-1.5 py-1 widget-controls-highlight"
                    onClick={(event) => event.stopPropagation()}
                  >
                    <button
                      type="button"
                      className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-border bg-background/70 text-muted-foreground hover:text-foreground disabled:opacity-40"
                      disabled={preferences.layout.findIndex((item) => item.id === widget.id) === 0}
                      onClick={() => moveWidget(widget.id, "up")}
                      title="Move up"
                    >
                      <ChevronUp className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-border bg-background/70 text-muted-foreground hover:text-foreground disabled:opacity-40"
                      disabled={
                        preferences.layout.findIndex((item) => item.id === widget.id) ===
                        preferences.layout.length - 1
                      }
                      onClick={() => moveWidget(widget.id, "down")}
                      title="Move down"
                    >
                      <ChevronDown className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-border bg-background/70 text-muted-foreground hover:text-foreground disabled:opacity-40"
                      disabled={!canShrink}
                      onClick={() => shrinkWidget(widget.id)}
                      title="Make smaller"
                    >
                      <Minus className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-border bg-background/70 text-muted-foreground hover:text-foreground disabled:opacity-40"
                      disabled={!canGrow}
                      onClick={() => growWidget(widget.id)}
                      title="Make larger"
                    >
                      <Plus className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-border bg-background/70 text-destructive hover:bg-destructive/10"
                      onClick={() => hideWidget(widget.id)}
                      title="Hide widget"
                    >
                      ×
                    </button>
                  </div>
                )}
              </CardHeader>
              <CardContent>
                {!isRecentProjectsWidget && (
                  <div className="flex items-end justify-between gap-2">
                    <span className="text-3xl font-bold tracking-tight">{value}</span>
                    {customizationOpen ? (
                      <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">Arrange</span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                        Open
                        <ArrowUpRight className="h-3.5 w-3.5" />
                      </span>
                    )}
                  </div>
                )}

                {isRecentProjectsWidget ? (
                  loading ? (
                    <div className="flex items-center justify-center py-10">
                      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                    </div>
                  ) : recentProjects.length === 0 ? (
                    <div className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
                      No projects yet. Create your first project.
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {recentProjects.slice(0, recentRowsToShow).map((project) => (
                        <button
                          key={project.id}
                          type="button"
                          className={cn(
                            "flex w-full items-center justify-between rounded-lg border border-border/70 px-3 text-left transition-colors hover:bg-accent/50",
                            selectedRecentProjectId === project.id && "border-primary/40 bg-primary/5",
                            layoutItem.size === "sm" || layoutItem.size === "md" ? "py-2" : "py-3",
                          )}
                          onClick={() => {
                            if (customizationOpen) return;
                            setSelectedRecentProjectId(project.id);
                          }}
                        >
                          <div className="min-w-0">
                            <p className="truncate text-sm font-semibold">{project.name}</p>
                            {(layoutItem.size === "lg" || layoutItem.size === "xl") && (
                              <p className="text-xs text-muted-foreground">
                                Deadline: {project.deadline || "Not set"}
                              </p>
                            )}
                          </div>
                          <div className="ml-4 text-right">
                            <span className="text-xs capitalize text-muted-foreground">{project.status}</span>
                            {(layoutItem.size === "lg" || layoutItem.size === "xl") && (
                              <p className="text-sm font-medium">
                                {project.budget ? `$${project.budget.toLocaleString()}` : "-"}
                              </p>
                            )}
                          </div>
                        </button>
                      ))}
                    </div>
                  )
                ) : isTeamMembersWidget ? (
                  <div className="mt-3 space-y-3">
                    <div className="flex -space-x-2">
                      {memberStats.recent.map((member) => (
                        <MemberAvatar
                          key={member.id}
                          name={member.name}
                          email={member.email || undefined}
                          userId={member.user_id || undefined}
                          avatarUrl={member.avatar_url || undefined}
                          ring={false}
                          sizeClass="h-8 w-8 border-2 border-background"
                          textClass="text-[10px]"
                        />
                      ))}
                      {memberStats.total > memberStats.recent.length && (
                        <div className="flex h-8 w-8 items-center justify-center rounded-full border-2 border-background bg-muted text-[10px] font-semibold text-muted-foreground">
                          +{memberStats.total - memberStats.recent.length}
                        </div>
                      )}
                    </div>
                    {layoutItem.size !== "sm" && bars.length > 0 && (
                      <div className="space-y-2">
                        {bars.map((bar) => {
                          const width = Math.max(8, Math.round((bar.value / bar.max) * 100));
                          return (
                            <div key={bar.label} className="space-y-1">
                              <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                                <span>{bar.label}</span>
                                <span>{bar.value}</span>
                              </div>
                              <div className="h-1.5 rounded-full bg-muted">
                                <div className="h-full rounded-full bg-primary" style={{ width: `${width}%` }} />
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                ) : (
                  layoutItem.size !== "sm" && bars.length > 0 && (
                  <div className="mt-3 space-y-2">
                    {bars.map((bar) => {
                      const width = Math.max(8, Math.round((bar.value / bar.max) * 100));
                      return (
                        <div key={bar.label} className="space-y-1">
                          <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                            <span>{bar.label}</span>
                            <span>{bar.value}</span>
                          </div>
                          <div className="h-1.5 rounded-full bg-muted">
                            <div className="h-full rounded-full bg-primary" style={{ width: `${width}%` }} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  )
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {customizationOpen && hiddenWidgets.length > 0 && (
        <Card className="glass border-dashed border-border/70">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Hidden Widgets</CardTitle>
            <p className="text-xs text-muted-foreground">These are hidden from your dashboard. Tap + to show again.</p>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {hiddenWidgets.map((widget) => {
                const Icon = widget.icon;
                return (
                  <div
                    key={widget.id}
                    className="flex items-center justify-between rounded-lg border border-border/60 bg-muted/20 px-3 py-2 opacity-70"
                  >
                    <span className="inline-flex items-center gap-2 text-sm text-muted-foreground">
                      <Icon className="h-4 w-4" />
                      {widget.title}
                    </span>
                    <button
                      type="button"
                      className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-border bg-background text-primary hover:bg-primary/10"
                      onClick={() => addWidget(widget.id)}
                      title="Show widget"
                    >
                      <Plus className="h-3.5 w-3.5" />
                    </button>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {!ENABLE_RECENT_PROJECTS_WIDGET && <Card className="glass overflow-hidden">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">Recent Projects</CardTitle>
          <Button variant="outline" size="sm" onClick={() => router.push("/projects")}>
            Open Projects
          </Button>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-10">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : recentProjects.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
              No projects yet. Create your first project.
            </div>
          ) : (
            <div className="space-y-2">
              {recentProjects.map((project) => (
                <button
                  key={project.id}
                  type="button"
                  className={cn(
                    "flex w-full items-center justify-between rounded-lg border border-border/70 px-3 py-3 text-left transition-colors hover:bg-accent/50",
                    selectedRecentProjectId === project.id && "border-primary/40 bg-primary/5",
                  )}
                  onClick={() => setSelectedRecentProjectId(project.id)}
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold">{project.name}</p>
                    <p className="text-xs text-muted-foreground">
                      Deadline: {project.deadline || "Not set"}
                    </p>
                  </div>
                  <div className="ml-4 text-right">
                    <span className="text-xs capitalize text-muted-foreground">{project.status}</span>
                    <p className="text-sm font-medium">{project.budget ? `$${project.budget.toLocaleString()}` : "-"}</p>
                  </div>
                </button>
              ))}
            </div>
          )}
        </CardContent>
      </Card>}

      {selectedRecentProject && (
        <Dialog
          open={Boolean(selectedRecentProject)}
          onOpenChange={(open) => {
            if (!open) closeProjectPreview();
          }}
        >
          <DialogContent className="z-[220] sm:max-w-[min(94vw,1100px)] max-h-[90vh] overflow-y-auto border-primary/35 bg-background/95 p-0 backdrop-blur-xl [&>button]:hidden">
            <DialogHeader className="sr-only">
              <DialogTitle>Project preview</DialogTitle>
              <DialogDescription>Detailed preview and quick edit for selected project.</DialogDescription>
            </DialogHeader>
            <Card className="glass relative w-full border-0 bg-transparent shadow-none">
            <CardHeader className="sticky top-0 z-20 border-b border-border/60 bg-background/90 pb-3 backdrop-blur supports-[backdrop-filter]:bg-background/80">
              <button
                type="button"
                aria-label="Close preview"
                className="absolute right-3 top-3 inline-flex h-8 w-8 items-center justify-center rounded-full border border-border bg-background/80 text-muted-foreground"
                onClick={closeProjectPreview}
              >
                <span className="text-base leading-none">×</span>
              </button>
              <div className="pr-10 md:flex md:items-start md:justify-between md:gap-4">
                <div>
                <p className="text-xs uppercase tracking-wide text-primary">Project Preview</p>
                {quickEditMode ? (
                  <Input
                    value={quickEditName}
                    onChange={(event) => setQuickEditName(event.target.value)}
                    className="mt-1 h-10 text-xl font-semibold"
                    placeholder="Project name"
                  />
                ) : (
                  <CardTitle className="mt-1 text-xl">{selectedRecentProject.name}</CardTitle>
                )}
                <div className="mt-2 flex flex-wrap gap-2">
                  {quickEditMode && (
                    <Badge variant="outline" className="text-[11px]">
                      Quick edit enabled
                    </Badge>
                  )}
                </div>
                </div>
                <div className="mt-3 min-w-0 md:mt-0 md:w-72">
                  <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Project timeline progress</p>
                  {timelineMetrics.hasTimeline ? (
                    <>
                      <div className="mt-2 h-2 overflow-hidden rounded-full bg-primary/10">
                        <div
                          className="h-full rounded-full bg-primary shadow-[0_0_18px_hsl(var(--primary)/0.55)] transition-all"
                          style={{ width: `${Math.max(4, Math.min(100, timelineMetrics.progress))}%` }}
                        />
                      </div>
                      <div className="mt-1 flex items-center justify-between text-[11px] text-muted-foreground">
                        <span>{formatDateLabel(selectedRecentProject.start_date || null)}</span>
                        <span>{timelineMetrics.progress}%</span>
                        <span>{formatDateLabel(selectedRecentProject.deadline || null)}</span>
                      </div>
                    </>
                  ) : (
                    <p className="mt-1 text-xs text-muted-foreground">Add start + deadline to track progress.</p>
                  )}
                </div>
              </div>
            </CardHeader>
            <CardContent className="pt-4">
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                <div className="rounded-lg border border-border/70 bg-background/50 p-3">
                  <Label className="block text-[11px] uppercase tracking-wide text-muted-foreground">Status</Label>
                  {quickEditMode ? (
                    <Select value={quickEditStatus} onValueChange={(value) => setQuickEditStatus(value as Project["status"])}>
                      <SelectTrigger className="mt-1 h-9 text-sm">
                        <SelectValue placeholder="Select status" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="active">Active</SelectItem>
                        <SelectItem value="in-progress">In progress</SelectItem>
                        <SelectItem value="on-hold">On hold</SelectItem>
                        <SelectItem value="completed">Completed</SelectItem>
                        <SelectItem value="closed">Closed</SelectItem>
                      </SelectContent>
                    </Select>
                  ) : (
                    <Badge className={cn("mt-1 border text-[11px] capitalize", PROJECT_STATUS_BADGE_CLASS[selectedRecentProject.status])}>
                      {selectedRecentProject.status}
                    </Badge>
                  )}
                </div>
                <div className="rounded-lg border border-border/70 bg-background/50 p-3">
                  <Label className="text-[11px] uppercase tracking-wide text-muted-foreground">Date Range</Label>
                  {quickEditMode ? (
                    <DateRangePicker
                      className="mt-1"
                      numberOfMonths={2}
                      showPresets={false}
                      date={{
                        from: parseIsoDate(quickEditStartDate),
                        to: parseIsoDate(quickEditDeadline),
                      }}
                      onDateChange={(range) => {
                        setQuickEditStartDate(serializeIsoDate(range?.from))
                        setQuickEditDeadline(serializeIsoDate(range?.to))
                      }}
                      placeholder="Select project date range"
                    />
                  ) : (
                    <p className="mt-1 text-sm font-medium">
                      {formatDateLabel(selectedRecentProject.start_date || null)} to {formatDateLabel(selectedRecentProject.deadline || null)}
                    </p>
                  )}
                </div>
                <div className="rounded-lg border border-border/70 bg-background/50 p-3">
                  <Label className="text-[11px] uppercase tracking-wide text-muted-foreground">Budget</Label>
                  {quickEditMode ? (
                    <Input
                      type="number"
                      min="0"
                      value={quickEditBudget}
                      onChange={(event) => setQuickEditBudget(event.target.value)}
                      className="mt-1 h-9 text-sm"
                      placeholder="Budget"
                    />
                  ) : (
                    <p className="mt-1 text-sm font-medium">
                      {selectedRecentProject.budget ? `$${selectedRecentProject.budget.toLocaleString()}` : "-"}
                    </p>
                  )}
                </div>
                <div className="rounded-lg border border-border/70 bg-background/50 p-3">
                  <Label className="text-[11px] uppercase tracking-wide text-muted-foreground">Client</Label>
                  {quickEditMode ? (
                    <Input
                      value={quickEditClient}
                      onChange={(event) => setQuickEditClient(event.target.value)}
                      className="mt-1 h-9 text-sm"
                      placeholder="Client"
                    />
                  ) : (
                    <p className="mt-1 text-sm font-medium">{selectedRecentProject.client_name || "-"}</p>
                  )}
                </div>

                <div className="rounded-lg border border-border/70 bg-background/50 p-3 md:col-span-2">
                  <Label className="text-[11px] uppercase tracking-wide text-muted-foreground">Assigned Team</Label>
                  {quickEditMode ? (
                    <div className="mt-2 space-y-2">
                      <div className="grid max-h-40 gap-1 overflow-y-auto rounded-md border border-border/60 p-2">
                        {members.map((member) => {
                          const selected = quickEditMemberIds.includes(member.id);
                          return (
                            <button
                              key={member.id}
                              type="button"
                              onClick={() => toggleQuickEditMember(member.id)}
                              className={cn(
                                "flex items-center justify-between rounded-md border px-2 py-1.5 text-left text-xs transition-colors",
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
                      <div className="flex flex-wrap gap-2">
                        {quickEditMemberIds.length > 0 ? (
                          quickEditMemberIds.map((memberId) => {
                            const member = members.find((item) => item.id === memberId);
                            if (!member) return null;
                            return (
                              <Badge key={memberId} variant="outline" className="inline-flex items-center gap-1">
                                {member.name}
                                <button
                                  type="button"
                                  className="text-muted-foreground hover:text-foreground"
                                  onClick={() => toggleQuickEditMember(memberId)}
                                >
                                  ×
                                </button>
                              </Badge>
                            );
                          })
                        ) : (
                          <span className="text-sm text-muted-foreground">No members assigned</span>
                        )}
                      </div>
                    </div>
                  ) : Array.isArray(selectedRecentProject.project_members) &&
                  selectedRecentProject.project_members.length > 0 ? (
                    <div className="mt-2 flex flex-wrap gap-2">
                      {selectedRecentProject.project_members
                        .map((pm) => pm.members)
                        .filter((member): member is NonNullable<typeof member> => Boolean(member))
                        .map((member) => {
                          const key = `${member.id || member.user_id || member.email || member.name}`;
                          const canOpenMember = Boolean(member.id);

                          return (
                            <button
                              key={key}
                              type="button"
                              disabled={!canOpenMember}
                              onClick={() => {
                                if (member.id) {
                                  router.push(`/team/${member.id}`);
                                }
                              }}
                              className={cn(
                                "inline-flex items-center gap-2 rounded-full border border-border/70 bg-background/70 px-2 py-1 text-left transition-colors",
                                canOpenMember
                                  ? "hover:border-primary/50 hover:bg-primary/10"
                                  : "cursor-default opacity-90"
                              )}
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
                    <p className="mt-1 text-sm font-medium">No members assigned</p>
                  )}
                </div>
                <div className="rounded-lg border border-border/70 bg-background/50 p-3 md:col-span-2 xl:col-span-2">
                  <Label className="text-[11px] uppercase tracking-wide text-muted-foreground">Labels</Label>
                  {quickEditMode ? (
                    <div className="mt-2 space-y-2">
                      <div className="flex flex-wrap gap-1.5">
                        {quickEditLabels.length > 0 ? (
                          quickEditLabels.map((label) => (
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
                          ))
                        ) : (
                          <span className="text-sm text-muted-foreground">No labels</span>
                        )}
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
                          className="h-9"
                          placeholder="Add label"
                        />
                        <Button type="button" size="sm" variant="outline" onClick={addQuickEditLabel}>
                          Add
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {(selectedRecentProject.labels || []).length > 0 ? (
                        (selectedRecentProject.labels || []).map((label) => (
                          <span key={label} className="rounded-full border border-border/70 bg-accent/30 px-2 py-0.5 text-xs">
                            {label}
                          </span>
                        ))
                      ) : (
                        <span className="text-sm text-muted-foreground">No labels</span>
                      )}
                    </div>
                  )}
                </div>

                <div className="rounded-lg border border-border/70 bg-background/50 p-3 md:col-span-2 xl:col-span-4">
                  <div className="flex items-center justify-between gap-2">
                    <Label className="text-[11px] uppercase tracking-wide text-muted-foreground">Tasks</Label>
                    <button
                      type="button"
                      className="inline-flex items-center gap-1 text-xs text-primary underline-offset-2 hover:underline"
                      onClick={() => setPreviewTasksExpanded((open) => !open)}
                    >
                      {previewTasksExpanded ? "Collapse task timeline" : "Expand task timeline preview"}
                    </button>
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {previewTasksLoading
                      ? "Loading tasks..."
                      : `${selectedPreviewTaskCount} task${selectedPreviewTaskCount === 1 ? "" : "s"} linked to this project. Expand to preview and open each task.`}
                  </p>
                  <div className="mt-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => router.push(`/tasks?projectId=${selectedRecentProject.id}`)}
                    >
                      Open project tasks
                    </Button>
                  </div>
                  {previewTasksExpanded && (
                    <div className="mt-3 space-y-3">
                      {previewTasks.length === 0 ? (
                        <p className="text-xs text-muted-foreground">No tasks found.</p>
                      ) : (
                        <div className="relative pl-5">
                          <div className="pointer-events-none absolute bottom-2 left-[7px] top-1 w-px bg-border/70" />
                          <div className="space-y-3">
                            {previewTasks.slice(0, 6).map((task) => (
                              <div key={task.id} className="relative">
                                <Circle className="pointer-events-none absolute -left-[20px] top-3 h-3.5 w-3.5 fill-background text-primary" />
                                <button
                                  type="button"
                                  onClick={() => setSelectedPreviewTask(task)}
                                  className="w-full rounded-lg border border-border/60 bg-background/60 px-3 py-2 text-left transition-colors hover:border-primary/50 hover:bg-primary/10"
                                >
                                  <div className="flex flex-wrap items-start justify-between gap-2">
                                    <p className="text-sm font-semibold text-foreground">{task.title}</p>
                                    <div className="flex flex-wrap items-center gap-1.5">
                                      <Badge className={cn("border text-[10px]", PROJECT_PREVIEW_TASK_STATUS_CLASS[task.status])}>
                                        {PROJECT_PREVIEW_TASK_STATUS_LABEL[task.status]}
                                      </Badge>
                                      {task.priority && (
                                        <Badge variant="outline" className="text-[10px] capitalize">
                                          {task.priority}
                                        </Badge>
                                      )}
                                    </div>
                                  </div>
                                  <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
                                    <span>Assignee: {getMemberName(task.assignee_member_id)}</span>
                                    <span>•</span>
                                    <span>Due: {formatDateLabel(task.due_date)}</span>
                                  </div>
                                </button>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                      <div className="flex flex-wrap gap-2">
                        <Button
                          size="sm"
                          variant="ghost"
                          className="mt-1"
                          onClick={() => setPreviewTasksExpanded(false)}
                        >
                          Collapse timeline
                        </Button>
                      </div>
                    </div>
                  )}
                </div>

                <div className="rounded-lg border border-border/70 bg-background/50 p-3 md:col-span-2 xl:col-span-4">
                  <Label className="text-[11px] uppercase tracking-wide text-muted-foreground">Description</Label>
                  {quickEditMode ? (
                    <Textarea
                      value={quickEditDescription}
                      onChange={(event) => setQuickEditDescription(event.target.value)}
                      rows={4}
                      className="mt-1 text-sm"
                    />
                  ) : (
                    <p className="mt-1 text-sm text-muted-foreground">
                      {previewDescriptionText || "No description available."}
                    </p>
                  )}
                  {!quickEditMode && shouldClampPreviewDescription && (
                    <button
                      type="button"
                      className="mt-2 text-xs text-primary underline-offset-2 hover:underline"
                      onClick={() => setPreviewDescriptionExpanded((open) => !open)}
                    >
                      {previewDescriptionExpanded ? "Show less" : "Show more"}
                    </button>
                  )}
                </div>
              </div>
            </CardContent>
            <CardFooter className="sticky bottom-0 z-20 flex flex-col gap-2 border-t border-border/60 bg-background/90 p-3 backdrop-blur supports-[backdrop-filter]:bg-background/80 sm:flex-row sm:items-center sm:justify-between sm:p-4">
              <div className="flex w-full flex-col items-stretch gap-2 sm:w-auto sm:flex-row sm:items-center">
                {persistNotice && <p className="text-xs text-muted-foreground">{persistNotice}</p>}
                {quickEditMode && (
                  <Button
                    size="sm"
                    variant="destructive"
                    className="w-full sm:w-auto"
                    onClick={() => setQuickEditMode(false)}
                    disabled={quickEditSaving}
                  >
                    Exit quick edit
                  </Button>
                )}
              </div>
              <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center">
                {quickEditMode ? (
                  <Button
                    size="sm"
                    className="w-full sm:w-auto"
                    onClick={saveQuickEdit}
                    disabled={quickEditSaving || !quickEditName.trim()}
                  >
                    {quickEditSaving ? "Saving..." : "Save quick edit"}
                  </Button>
                ) : (
                  <Button
                    size="sm"
                    variant="outline"
                    className="w-full sm:w-auto"
                    onClick={() => setQuickEditMode(true)}
                  >
                    Quick Edit
                  </Button>
                )}
                <Button
                  size="sm"
                  variant="outline"
                  className="w-full sm:w-auto"
                  onClick={() => router.push(`/projects/${selectedRecentProject.id}`)}
                >
                  Open Project Page
                </Button>
              </div>
            </CardFooter>
          </Card>
          </DialogContent>
        </Dialog>
      )}

      <Dialog
        open={Boolean(selectedPreviewTask)}
        onOpenChange={(open) => {
          if (!open) setSelectedPreviewTask(null);
        }}
      >
        <DialogContent className="sm:max-w-lg">
          {selectedPreviewTask && (
            <>
              <DialogHeader>
                <DialogTitle>{selectedPreviewTask.title}</DialogTitle>
                <DialogDescription>
                  Task details from project timeline preview.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-3 text-sm">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge className={cn("border text-[11px]", PROJECT_PREVIEW_TASK_STATUS_CLASS[selectedPreviewTask.status])}>
                    {PROJECT_PREVIEW_TASK_STATUS_LABEL[selectedPreviewTask.status]}
                  </Badge>
                  {selectedPreviewTask.priority && (
                    <Badge variant="outline" className="capitalize">
                      {selectedPreviewTask.priority}
                    </Badge>
                  )}
                </div>
                <div className="grid gap-2 rounded-md border border-border/60 bg-muted/20 p-3">
                  <p>
                    <span className="text-muted-foreground">Assignee:</span>{" "}
                    {getMemberName(selectedPreviewTask.assignee_member_id)}
                  </p>
                  <p>
                    <span className="text-muted-foreground">Due date:</span>{" "}
                    {formatDateLabel(selectedPreviewTask.due_date)}
                  </p>
                  <p>
                    <span className="text-muted-foreground">Description:</span>{" "}
                    {selectedPreviewTask.description?.trim() || "No description available."}
                  </p>
                </div>
                <div className="flex justify-end">
                  <Button
                    size="sm"
                    onClick={() => {
                      if (!selectedRecentProject) return;
                      router.push(`/tasks?projectId=${selectedRecentProject.id}&taskId=${selectedPreviewTask.id}`);
                    }}
                  >
                    Open in Tasks
                  </Button>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
