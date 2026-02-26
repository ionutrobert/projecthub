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
  X,
} from "lucide-react";

import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import MemberAvatar from "@/components/member-avatar";
import { useTheme } from "@/components/theme-provider";
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

type ProjectTaskPreview = {
  id: string;
  title: string;
  status: "todo" | "in-progress" | "done";
  due_date: string | null;
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

  const [projects, setProjects] = useState<Project[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [customizationOpen, setCustomizationOpen] = useState(false);
  const [draggedWidgetId, setDraggedWidgetId] = useState<WidgetId | null>(null);
  const [selectedRecentProjectId, setSelectedRecentProjectId] = useState<string | null>(null);
  const [preferences, setPreferences] = useState<DashboardPreferences>({
    layout: DEFAULT_LAYOUT,
    hiddenWidgetIds: [],
  });
  const [persistNotice, setPersistNotice] = useState<string | null>(null);
  const [hasLoadedPreferences, setHasLoadedPreferences] = useState(false);
  const [skipInitialPersist, setSkipInitialPersist] = useState(true);
  const [layoutMode, setLayoutMode] = useState<LayoutMode | null>(null);
  const [previewTasks, setPreviewTasks] = useState<ProjectTaskPreview[]>([]);
  const [previewTasksLoading, setPreviewTasksLoading] = useState(false);
  const [previewTasksExpanded, setPreviewTasksExpanded] = useState(false);
  const [previewDescriptionExpanded, setPreviewDescriptionExpanded] = useState(false);

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
      const [projectsRes, tasksRes] = await Promise.all([
        fetch("/api/projects", { cache: "no-store" }),
        fetch("/api/tasks", { cache: "no-store" }),
      ]);
      const [projectsData, tasksData] = await Promise.all([projectsRes.json(), tasksRes.json()]);

      setProjects(Array.isArray(projectsData) ? projectsData : []);
      setTasks(Array.isArray(tasksData) ? tasksData : []);
    } catch {
      setProjects([]);
      setTasks([]);
    } finally {
      setLoading(false);
    }
  }, []);

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
  }, [preferences, hasLoadedPreferences, layoutMode, skipInitialPersist]);

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
      recentProjects: "",
    }),
    [projectStats, taskStats],
  );

  const orderedVisibleWidgets = useMemo(() => {
    const hidden = new Set(preferences.hiddenWidgetIds);
    return preferences.layout.filter((item) => !hidden.has(item.id));
  }, [preferences]);

  const addWidget = (id: WidgetId) => {
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
    setPreferences((prev) => {
      if (prev.hiddenWidgetIds.includes(id)) return prev;
      return {
        ...prev,
        hiddenWidgetIds: [...prev.hiddenWidgetIds, id],
      };
    });
  };

  const growWidget = (id: WidgetId) => {
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
      recentProjects: [],
    } as const;
  }, [projectStats, taskStats]);

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

  return (
    <div className="space-y-6 page-transition">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Dashboard</h1>
          <p className="text-sm text-muted-foreground sm:text-base">
            Personalized widgets, real data, and one-click navigation to the right area.
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
      <div className="flex flex-wrap items-center gap-2">
        {persistNotice && <span className="text-xs text-muted-foreground">{persistNotice}</span>}
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
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-3 sm:p-6" role="dialog" aria-modal="true">
          <button
            type="button"
            className="absolute inset-0 bg-background/65 backdrop-blur-sm"
            aria-label="Close project preview"
            onClick={() => setSelectedRecentProjectId(null)}
          />

          <Card className="glass relative z-10 w-full max-w-[min(94vw,1100px)] border-primary/35 max-h-[90vh] overflow-y-auto">
            <button
              type="button"
              aria-label="Close preview"
              className="absolute right-3 top-3 z-20 inline-flex h-8 w-8 items-center justify-center rounded-full border border-border bg-background/80 text-muted-foreground"
              onClick={() => setSelectedRecentProjectId(null)}
            >
              <X className="h-4 w-4" />
            </button>
            <CardHeader className="pb-3">
              <div>
                <p className="text-xs uppercase tracking-wide text-primary">Project Preview</p>
                <CardTitle className="mt-1 text-xl">{selectedRecentProject.name}</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                <div className="rounded-lg border border-border/70 bg-background/50 p-3">
                  <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Status</p>
                  <p className="mt-1 text-sm font-medium capitalize">{selectedRecentProject.status}</p>
                </div>
                <div className="rounded-lg border border-border/70 bg-background/50 p-3">
                  <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Date Range</p>
                  <p className="mt-1 text-sm font-medium">
                    {selectedRecentProject.start_date || "-"} to {selectedRecentProject.deadline || "-"}
                  </p>
                </div>
                <div className="rounded-lg border border-border/70 bg-background/50 p-3">
                  <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Budget</p>
                  <p className="mt-1 text-sm font-medium">
                    {selectedRecentProject.budget ? `$${selectedRecentProject.budget.toLocaleString()}` : "-"}
                  </p>
                </div>
                <div className="rounded-lg border border-border/70 bg-background/50 p-3">
                  <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Client</p>
                  <p className="mt-1 text-sm font-medium">{selectedRecentProject.client_name || "-"}</p>
                </div>

                <div className="rounded-lg border border-border/70 bg-background/50 p-3 md:col-span-2">
                  <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Assigned Team</p>
                  {Array.isArray(selectedRecentProject.project_members) &&
                  selectedRecentProject.project_members.length > 0 ? (
                    <div className="mt-2 flex flex-wrap gap-2">
                      {selectedRecentProject.project_members
                        .map((pm) => pm.members)
                        .filter((member): member is NonNullable<typeof member> => Boolean(member))
                        .map((member) => (
                          <div
                            key={`${member.user_id || member.email || member.name}`}
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
                          </div>
                        ))}
                    </div>
                  ) : (
                    <p className="mt-1 text-sm font-medium">No members assigned</p>
                  )}
                </div>
                <div className="rounded-lg border border-border/70 bg-background/50 p-3 xl:col-span-2">
                  <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Labels</p>
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
                </div>

                <div className="rounded-lg border border-border/70 bg-background/50 p-3 md:col-span-2 xl:col-span-4">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Tasks</p>
                    <button
                      type="button"
                      className="text-xs text-primary underline-offset-2 hover:underline"
                      onClick={() => setPreviewTasksExpanded((open) => !open)}
                    >
                      {previewTasksExpanded ? "Hide task list" : "Show task list"}
                    </button>
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {previewTasksLoading
                      ? "Loading tasks..."
                      : `${selectedPreviewTaskCount} task${selectedPreviewTaskCount === 1 ? "" : "s"} linked to this project`}
                  </p>
                  {previewTasksExpanded && (
                    <div className="mt-2 space-y-1.5">
                      {previewTasks.length === 0 ? (
                        <p className="text-xs text-muted-foreground">No tasks found.</p>
                      ) : (
                        previewTasks.slice(0, 6).map((task) => (
                          <div key={task.id} className="flex items-center justify-between rounded-md border border-border/60 px-2 py-1.5 text-xs">
                            <span className="truncate pr-3">{task.title}</span>
                            <span className="shrink-0 capitalize text-muted-foreground">{task.status}</span>
                          </div>
                        ))
                      )}
                    </div>
                  )}
                </div>

                <div className="rounded-lg border border-border/70 bg-background/50 p-3 md:col-span-2 xl:col-span-4">
                  <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Description</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {previewDescriptionText || "No description available."}
                  </p>
                  {shouldClampPreviewDescription && (
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
            <CardFooter className="justify-end border-t border-border/60 bg-background/30 p-3 sm:p-4">
              <Button
                size="sm"
                variant="outline"
                className="w-full sm:w-auto"
                onClick={() => router.push(`/projects/${selectedRecentProject.id}`)}
              >
                Open Project Page
              </Button>
            </CardFooter>
          </Card>
        </div>
      )}
    </div>
  );
}
