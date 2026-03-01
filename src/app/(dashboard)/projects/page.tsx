"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import { useUser } from "@/components/user-provider";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import ProjectPreviewModal from "@/components/project-preview-modal";
import ProjectFormModal from "@/components/project-form-modal";
import MemberAvatar from "@/components/member-avatar";
import { getNameInitials } from "@/lib/avatar";
import { renderMarkdownHtml } from "@/lib/markdown";
import { cn } from "@/lib/utils";
import {
  FolderKanban,
  Plus,
  X,
  Loader2,
  Code,
  Zap,
  Globe,
  Database,
  Shield,
  Briefcase,
  Mail,
  Settings,
  Users,
  Star,
  Eye,
  List,
  LayoutGrid,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Check,
  ChevronsUpDown,
  SlidersHorizontal,
} from "lucide-react";

interface Project {
  id: string;
  name: string;
  status: "active" | "on-hold" | "completed" | "in-progress" | "closed";
  client_name?: string | null;
  deadline: string | null;
  budget: number | null;
  labels?: string[] | null;
  description: string | null;
  created_by: string | null;
  created_at: string;
  start_date?: string | null;
  color?: string;
  icon?: string;
  project_members?: { members: Member }[];
  progress?: number;
  milestones?: { label: string; date: string; completed?: boolean }[];
  task_count?: number;
}

const ICON_MAP: Record<
  string,
  React.ComponentType<{ className?: string; style?: React.CSSProperties }>
> = {
  FolderKanban,
  Code,
  Zap,
  Globe,
  Database,
  Shield,
  Briefcase,
  Mail,
  Settings,
  Users,
};

interface Member {
  id: string;
  user_id?: string | null;
  name: string;
  email: string;
  role: string;
}

interface Client {
  id: string;
  name: string;
}

type TableSortKey = "project" | "status" | "deadline" | "budget";
type TableSortDirection = "asc" | "desc";

const SORT_MODE_LABEL: Record<"priority" | "due_date" | "name" | "custom", string> = {
  priority: "Priority",
  due_date: "Due Date",
  name: "Name",
  custom: "Custom Order",
};

const TABLE_SORT_LABEL: Record<TableSortKey, string> = {
  project: "Project",
  status: "Status",
  deadline: "Deadline",
  budget: "Budget",
};

const PROJECT_STATUSES: Project["status"][] = [
  "active",
  "in-progress",
  "on-hold",
  "completed",
  "closed",
];

const getClientDisplayName = (clientName?: string | null) => {
  const normalized = clientName?.trim();
  return normalized ? normalized : "Internal project";
};

function getDeadlineCopy(deadline: string | null) {
  if (!deadline) {
    return { label: "No deadline", tone: "muted" as const };
  }

  const parsed = new Date(deadline);
  if (Number.isNaN(parsed.getTime())) {
    return { label: deadline, tone: "muted" as const };
  }

  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const dueDate = new Date(parsed.getFullYear(), parsed.getMonth(), parsed.getDate());
  const diffDays = Math.floor((dueDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

  if (diffDays === 0) {
    return { label: "Deadline today", tone: "warn" as const };
  }

  if (diffDays < 0) {
    const daysOver = Math.abs(diffDays);
    return {
      label: `Overdue by ${daysOver} day${daysOver === 1 ? "" : "s"}`,
      tone: "overdue" as const,
    };
  }

  return {
    label: `Due in ${diffDays} day${diffDays === 1 ? "" : "s"}`,
    tone: "upcoming" as const,
  };
}

function getDeadlineToneClass(tone: "muted" | "warn" | "overdue" | "upcoming") {
  if (tone === "overdue") return "border-red-500/40 bg-red-500/10 text-red-600 dark:text-red-300";
  if (tone === "warn") return "border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-300";
  if (tone === "upcoming") return "border-blue-500/40 bg-blue-500/10 text-blue-700 dark:text-blue-300";
  return "border-border/60 bg-muted/40 text-muted-foreground";
}

function getProjectCompletionEstimate(status: Project["status"], taskCount?: number) {
  if (!taskCount || taskCount <= 0) {
    if (status === "completed" || status === "closed") return 100;
    if (status === "in-progress") return 45;
    return 15;
  }

  if (status === "completed" || status === "closed") return 100;
  if (status === "in-progress") return 60;
  if (status === "on-hold") return 35;
  return 25;
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
  );
}

export default function ProjectsPage() {
  const { user, profile, loading: userLoading } = useUser();
  const router = useRouter();
  const searchParams = useSearchParams();

  const [projects, setProjects] = useState<Project[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [addProjectOpen, setAddProjectOpen] = useState(false);
  const [loadingError, setLoadingError] = useState<string | null>(null);
  const [previewProject, setPreviewProject] = useState<Project | null>(null);
  const [toast, setToast] = useState<{ projectId: string; projectName: string } | null>(null);
  const initialFilter = searchParams.get("status") || "all";
  const initialSearch =
    searchParams.get("q") || searchParams.get("search") || "";
  const initialSpotlightProjectId = searchParams.get("project") || "";
  const initialMembers = (searchParams.get("members") || "")
    .split(",")
    .filter(Boolean);
  const [filter, setFilter] = useState<string>(initialFilter);
  const [search, setSearch] = useState(initialSearch);
  const [debouncedSearch, setDebouncedSearch] = useState(initialSearch);
  const [selectedMemberIds, setSelectedMemberIds] =
    useState<string[]>(initialMembers);
  const [memberFilterOpen, setMemberFilterOpen] = useState(false);
  const [starredIds, setStarredIds] = useState<string[]>([]);
  const [customOrder] = useState<string[]>(() => {
    if (typeof window === "undefined") return [];
    try {
      const order = window.localStorage.getItem("projecthub-custom-order");
      return order ? JSON.parse(order) : [];
    } catch {
      return [];
    }
  });
  const [sortMode, setSortMode] = useState<"priority" | "due_date" | "name" | "custom">(
    "priority",
  );
  const [starFeedback, setStarFeedback] = useState<string | null>(null);
  const [highlightProjectId, setHighlightProjectId] = useState<string | null>(null);
  const [spotlightProjectId, setSpotlightProjectId] = useState(initialSpotlightProjectId);
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);
  const [tableSort, setTableSort] = useState<{ key: TableSortKey; direction: TableSortDirection } | null>(null);
  const [desktopView, setDesktopView] = useState<"list" | "card">("list");
  const [deleteToast, setDeleteToast] = useState<string | null>(null);

  const canEdit = profile?.role === "admin" || profile?.role === "member";

  const dedupedMembers = useMemo(() => {
    return members.filter((member, index, all) => {
      const key = `${member.name.toLowerCase()}::${(member.email || "").toLowerCase()}`;
      return (
        all.findIndex((candidate) => {
          const candidateKey = `${candidate.name.toLowerCase()}::${(candidate.email || "").toLowerCase()}`;
          return candidateKey === key;
        }) === index
      );
    });
  }, [members]);

  // Debounce search
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(t);
  }, [search]);

  // Sync URL with filters for shareability
  useEffect(() => {
    const params = new URLSearchParams();
    if (filter && filter !== "all") params.set("status", filter);
    if (debouncedSearch) params.set("q", debouncedSearch);
    if (spotlightProjectId) params.set("project", spotlightProjectId);
    if (selectedMemberIds.length > 0)
      params.set("members", selectedMemberIds.join(","));
    const qs = params.toString();
    const href = qs ? `/projects?${qs}` : "/projects";
    router.replace(href);
  }, [filter, debouncedSearch, spotlightProjectId, selectedMemberIds, router]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(
      "projecthub-custom-order",
      JSON.stringify(customOrder),
    );
  }, [customOrder]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const saved = window.sessionStorage.getItem("projecthub-projects-desktop-view");
    if (saved === "list" || saved === "card") {
      setDesktopView(saved);
    }
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.sessionStorage.setItem("projecthub-projects-desktop-view", desktopView);
  }, [desktopView]);

  useEffect(() => {
    if (userLoading) return;
    if (profile) return;

    setDesktopView("list");
    if (typeof window !== "undefined") {
      window.sessionStorage.removeItem("projecthub-projects-desktop-view");
    }
  }, [profile, userLoading]);

  useEffect(() => {
    if (!loading) return;
    const timer = setTimeout(() => {
      setLoading(false);
      setLoadingError("Loading projects timed out. Please refresh.");
    }, 12000);
    return () => clearTimeout(timer);
  }, [loading]);

  async function fetchJsonWithTimeout(url: string, ms = 10000) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), ms);
    try {
      const response = await fetch(url, { signal: controller.signal });
      const data = await response.json();
      return { ok: response.ok, data };
    } finally {
      clearTimeout(timer);
    }
  }

  const fetchProjects = useCallback(async () => {
    setLoading(true);
    setLoadingError(null);
    try {
      let url = "/api/projects";
      const params = new URLSearchParams();
      if (filter !== "all") params.set("status", filter);
      if (debouncedSearch) params.set("q", debouncedSearch);
      if (selectedMemberIds.length > 0)
        params.set("members", selectedMemberIds.join(","));
      if (params.toString()) url += `?${params.toString()}`;

      const { data } = await fetchJsonWithTimeout(url);
      if (Array.isArray(data)) {
        setProjects(data);
      } else {
        setProjects([]);
      }
    } catch {
      setProjects([]);
      setLoadingError("Unable to load projects right now.");
    } finally {
      setLoading(false);
    }
  }, [filter, debouncedSearch, selectedMemberIds]);

  const fetchMembers = useCallback(async () => {
    try {
      const { data } = await fetchJsonWithTimeout("/api/members");
      if (Array.isArray(data)) {
        setMembers(data);
      } else {
        setMembers([]);
      }
    } catch {
      setMembers([]);
    }
  }, []);

  const fetchStars = useCallback(async () => {
    try {
      const { data } = await fetchJsonWithTimeout("/api/projects/stars");
      if (Array.isArray(data)) {
        setStarredIds(data);
      } else {
        setStarredIds([]);
      }
    } catch {
      setStarredIds([]);
    }
  }, []);

  const fetchClients = useCallback(async () => {
    try {
      const { data } = await fetchJsonWithTimeout("/api/clients");
      if (Array.isArray(data)) {
        setClients(data);
      } else {
        setClients([]);
      }
    } catch {
      setClients([]);
    }
  }, []);

  // Load data on auth ready and filter changes (functions declared above)
  useEffect(() => {
    if (!userLoading) {
      fetchProjects();
      fetchMembers();
      fetchStars();
      fetchClients();
    }
  }, [userLoading, fetchProjects, fetchMembers, fetchStars, fetchClients]);

  const handleStatusChange = async (project: Project) => {
    if (!canEdit) return;
    const currentIndex = PROJECT_STATUSES.indexOf(project.status);
    const nextStatus =
      PROJECT_STATUSES[(currentIndex + 1) % PROJECT_STATUSES.length] || "active";
    const response = await fetch(`/api/projects/${project.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: nextStatus }),
    });
    if (response.ok) {
      setProjects((prev) =>
        prev.map((p) =>
          p.id === project.id ? { ...p, status: nextStatus } : p,
        ),
      );
    }
  };

  const toggleStar = async (id: string) => {
    const isStarred = starredIds.includes(id);
    const method = isStarred ? "DELETE" : "POST";
    const response = await fetch(`/api/projects/${id}/star`, { method });
    if (response.ok) {
      setStarredIds((prev) => {
        if (isStarred) return prev.filter((pid) => pid !== id);
        return [...prev, id];
      });

      if (!isStarred) {
        setHighlightProjectId(id);
        setStarFeedback("Project starred and prioritized at the top.");
        setTimeout(() => setHighlightProjectId(null), 2200);
      } else {
        setStarFeedback("Project removed from starred list.");
      }
      setTimeout(() => setStarFeedback(null), 2600);
    }
  };

  const handleProjectCreated = (project: Project) => {
    setToast({ projectId: project.id, projectName: project.name });
    // Optimistically add to projects list
    setProjects((prev) => [project, ...prev]);
    // Auto-dismiss after 6 seconds
    setTimeout(() => setToast(null), 6000);
  };


  const getStatusStyles = (status: string) => {
    switch (status) {
      case "active":
        return "status-active";
      case "in-progress":
        return "status-active";
      case "on-hold":
        return "status-on-hold";
      case "completed":
        return "status-completed";
      case "closed":
        return "status-completed";
      default:
        return "";
    }
  };

  const getProjectAssigneeNames = (project: Project) => {
    const names = Array.from(
      new Set(
        (project.project_members || [])
          .map((pm) => pm.members?.name)
          .filter((name): name is string => Boolean(name)),
      ),
    );

    return names;
  };

  const getProjectAssignees = (project: Project) => {
    const uniqueById = new Map<string, Member>();

    for (const relation of project.project_members || []) {
      const member = relation.members;
      if (!member?.id) continue;
      if (!uniqueById.has(member.id)) {
        uniqueById.set(member.id, member);
      }
    }

    return [...uniqueById.values()];
  };

  const sortedProjects = useMemo(() => {
    const list = [...projects];

    const parseDeadline = (value: string | null | undefined) => {
      if (!value) return Number.POSITIVE_INFINITY;
      const timestamp = new Date(value).getTime();
      return Number.isNaN(timestamp) ? Number.POSITIVE_INFINITY : timestamp;
    };

    const isAssignedToCurrentUser = (project: Project) => {
      if (!user) return false;
      return (project.project_members || []).some(
        (pm) => pm.members?.user_id === user.id || pm.members?.email === user.email,
      );
    };

    if (sortMode === "priority") {
      list.sort((a, b) => {
        const aStarred = starredIds.includes(a.id) ? 0 : 1;
        const bStarred = starredIds.includes(b.id) ? 0 : 1;
        if (aStarred !== bStarred) return aStarred - bStarred;

        const aMine = isAssignedToCurrentUser(a) ? 0 : 1;
        const bMine = isAssignedToCurrentUser(b) ? 0 : 1;
        if (aMine !== bMine) return aMine - bMine;

        const aDeadline = parseDeadline(a.deadline);
        const bDeadline = parseDeadline(b.deadline);
        if (aDeadline !== bDeadline) return aDeadline - bDeadline;

        return a.name.localeCompare(b.name);
      });
      return list;
    }

    if (sortMode === "due_date") {
      list.sort((a, b) => {
        const aDeadline = parseDeadline(a.deadline);
        const bDeadline = parseDeadline(b.deadline);
        if (aDeadline !== bDeadline) return aDeadline - bDeadline;
        return a.name.localeCompare(b.name);
      });
      return list;
    }

    if (sortMode === "custom" && customOrder.length > 0) {
      const orderMap = customOrder.reduce<Record<string, number>>(
        (acc, id, idx) => {
          acc[id] = idx;
          return acc;
        },
        {},
      );
      list.sort((a, b) => {
        const aOrder = orderMap[a.id];
        const bOrder = orderMap[b.id];
        if (aOrder !== undefined && bOrder !== undefined) {
          return aOrder - bOrder;
        }
        if (aOrder !== undefined) return -1;
        if (bOrder !== undefined) return 1;
        return a.name.localeCompare(b.name);
      });
      return list;
    }

    if (sortMode === "name") {
      return list.sort((a, b) => a.name.localeCompare(b.name));
    }

    return list;
  }, [projects, sortMode, starredIds, customOrder, user]);

  const desktopSortedProjects = useMemo(() => {
    if (!tableSort) return sortedProjects;

    const toDeadlineTimestamp = (value: string | null | undefined) => {
      if (!value) return Number.POSITIVE_INFINITY;
      const timestamp = new Date(value).getTime();
      return Number.isNaN(timestamp) ? Number.POSITIVE_INFINITY : timestamp;
    };

    const sorted = [...sortedProjects].sort((a, b) => {
      let result = 0;

      if (tableSort.key === "project") {
        result = a.name.localeCompare(b.name);
      } else if (tableSort.key === "status") {
        result = a.status.localeCompare(b.status);
      } else if (tableSort.key === "deadline") {
        result = toDeadlineTimestamp(a.deadline) - toDeadlineTimestamp(b.deadline);
      } else if (tableSort.key === "budget") {
        const aBudget = typeof a.budget === "number" ? a.budget : Number.POSITIVE_INFINITY;
        const bBudget = typeof b.budget === "number" ? b.budget : Number.POSITIVE_INFINITY;
        result = aBudget - bBudget;
      }

      return tableSort.direction === "asc" ? result : -result;
    });

    return sorted;
  }, [sortedProjects, tableSort]);

  const toggleTableSort = (key: TableSortKey) => {
    setTableSort((current) => {
      if (!current || current.key !== key) {
        return { key, direction: "asc" };
      }

      if (current.direction === "desc") {
        return null;
      }

      return {
        key,
        direction: "desc",
      };
    });
  };

  const getSortIcon = (key: TableSortKey) => {
    if (!tableSort || tableSort.key !== key) {
      return <ArrowUpDown className="h-3.5 w-3.5 opacity-60" />;
    }

    if (tableSort.direction === "asc") {
      return <ArrowUp className="h-3.5 w-3.5" />;
    }

    return <ArrowDown className="h-3.5 w-3.5" />;
  };

  const spotlightProject = useMemo(() => {
    if (!spotlightProjectId) return null;
    return projects.find((project) => project.id === spotlightProjectId) || null;
  }, [projects, spotlightProjectId]);

   useEffect(() => {
     if (!spotlightProject) return;
     setHighlightProjectId(spotlightProject.id);
     const timer = setTimeout(() => setHighlightProjectId(null), 2400);
     return () => clearTimeout(timer);
   }, [spotlightProject]);

   // Handle delete notification from query param
   useEffect(() => {
     const deleted = searchParams.get("deleted");
     if (deleted) {
       setDeleteToast(deleted);
       // Remove the query param after showing toast
       const params = new URLSearchParams(searchParams.toString());
       params.delete("deleted");
       router.replace(`/projects?${params.toString()}`, { scroll: false });
       // Auto-dismiss after 6 seconds
       setTimeout(() => setDeleteToast(null), 6000);
     }
   }, [searchParams, router]);

   // Close preview modal if the project no longer exists in the list
   useEffect(() => {
     if (previewProject && !projects.some(p => p.id === previewProject.id)) {
       setPreviewProject(null);
     }
   }, [projects, previewProject]);

  const hasActiveFilters =
    filter !== "all" ||
    debouncedSearch.trim().length > 0 ||
    selectedMemberIds.length > 0 ||
    sortMode !== "priority";
  const hasTableSort = Boolean(tableSort);
  const hasActiveControls = hasActiveFilters || hasTableSort;

  if (userLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-start justify-between gap-3 sm:items-center sm:gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Projects</h1>
          <p className="text-muted-foreground text-sm sm:text-base">
            Manage your projects and track progress.
          </p>
        </div>
        {canEdit && (
          <Button
            onClick={() => setAddProjectOpen(true)}
            className="gap-2 shrink-0"
          >
            <Plus className="h-4 w-4" /> Add Project
          </Button>
        )}
      </div>

       {deleteToast && (
         <div className="rounded-lg border border-rose-500/30 bg-rose-500/10 p-3 flex items-center justify-between">
           <p className="text-sm text-rose-700 dark:text-rose-400">
             Project &quot;{deleteToast}&quot; deleted.
           </p>
           <Button size="sm" variant="ghost" onClick={() => setDeleteToast(null)}>Dismiss</Button>
         </div>
       )}

       {toast && (
         <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-3 flex items-center justify-between">
           <p className="text-sm text-emerald-700 dark:text-emerald-400">
             Project &quot;{toast.projectName}&quot; created successfully.
           </p>
           <div className="flex gap-2">
             <Button size="sm" variant="outline" onClick={() => { router.push(`/projects/${toast.projectId}`); setToast(null); }}>
               View Project
             </Button>
             <Button size="sm" variant="ghost" onClick={() => setToast(null)}>Dismiss</Button>
           </div>
         </div>
       )}

      {/* Filters */}
      <div className="lg:hidden">
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="w-full justify-center"
          onClick={() => setMobileFiltersOpen((open) => !open)}
        >
          <SlidersHorizontal className="mr-2 h-4 w-4" />
          {mobileFiltersOpen ? "Hide Filters" : "Show Filters"}
        </Button>
      </div>

      <div
        className={`${mobileFiltersOpen ? "flex" : "hidden"} flex-col gap-3 lg:flex lg:flex-row lg:flex-wrap`}
      >
        <input
          type="text"
          placeholder="Search projects..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="h-10 px-3 rounded-lg border border-input bg-background text-sm w-full sm:w-48"
        />
        <select
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          className="h-10 px-3 rounded-lg border border-input bg-background text-sm"
        >
          <option value="all">All Statuses</option>
          <option value="active">Active</option>
          <option value="in-progress">In Progress</option>
          <option value="on-hold">On Hold</option>
          <option value="completed">Completed</option>
          <option value="closed">Closed</option>
        </select>
        <Popover open={memberFilterOpen} onOpenChange={setMemberFilterOpen}>
          <PopoverTrigger asChild>
            <Button
              type="button"
              variant="outline"
              role="combobox"
              aria-expanded={memberFilterOpen}
              className="h-10 w-full justify-between rounded-lg px-3 text-sm font-normal lg:min-w-56 lg:w-auto"
            >
              <span className="truncate">
                {selectedMemberIds.length === 0
                  ? "Filter by assignees"
                  : `${selectedMemberIds.length} assignee${selectedMemberIds.length > 1 ? "s" : ""} selected`}
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
                  {dedupedMembers.map((member) => {
                    const checked = selectedMemberIds.includes(member.id);
                    return (
                      <CommandItem
                        key={member.id}
                        value={`${member.name} ${member.email || ""} ${member.id}`}
                        onSelect={() => {
                          setSelectedMemberIds((prev) =>
                            prev.includes(member.id)
                              ? prev.filter((id) => id !== member.id)
                              : [...prev, member.id],
                          );
                        }}
                      >
                        <Check className={cn("mr-2 h-4 w-4", checked ? "opacity-100" : "opacity-0")} />
                        <span className="truncate">{member.name}</span>
                      </CommandItem>
                    );
                  })}
                  {selectedMemberIds.length > 0 && (
                    <CommandItem
                      value="__clear_assignees__"
                      onSelect={() => setSelectedMemberIds([])}
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
          value={sortMode}
          onChange={(e) => setSortMode(e.target.value as typeof sortMode)}
          className="h-10 px-3 rounded-lg border border-input bg-background text-sm"
        >
          <option value="priority">Sort: Priority (Starred, Mine, Due Date)</option>
          <option value="due_date">Sort: Due Date</option>
          <option value="name">Sort: Name</option>
          <option value="custom">Sort: Custom Order</option>
        </select>
      </div>

      {hasActiveControls && (
        <div className="rounded-lg border border-border/60 bg-muted/20 p-2.5 sm:p-3">
          <div className="mb-2 flex items-center justify-between gap-2">
            <p className="text-xs font-medium text-muted-foreground">Active filters & sorting</p>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className="h-7 px-2 text-xs"
              onClick={() => {
                setFilter("all");
                setSearch("");
                setDebouncedSearch("");
                setSpotlightProjectId("");
                setSelectedMemberIds([]);
                setSortMode("priority");
                setTableSort(null);
                setMobileFiltersOpen(false);
              }}
            >
              Reset all
            </Button>
          </div>

          <div className="flex flex-wrap items-center gap-2">
          {filter !== "all" && (
            <button
              type="button"
              onClick={() => setFilter("all")}
              className="inline-flex items-center gap-1 rounded-full border border-border bg-background px-3 py-1 text-xs"
            >
              Status: {filter}
              <X className="h-3 w-3" />
            </button>
          )}

          {sortMode !== "priority" && (
            <button
              type="button"
              onClick={() => setSortMode("priority")}
              className="inline-flex items-center gap-1 rounded-full border border-border bg-background px-3 py-1 text-xs"
            >
              Sort Mode: {SORT_MODE_LABEL[sortMode]}
              <X className="h-3 w-3" />
            </button>
          )}

          {tableSort && (
            <button
              type="button"
              onClick={() => setTableSort(null)}
              className="inline-flex items-center gap-1 rounded-full border border-border bg-background px-3 py-1 text-xs"
            >
              Table Sort: {TABLE_SORT_LABEL[tableSort.key]} ({tableSort.direction === "asc" ? "A-Z" : "Z-A"})
              <X className="h-3 w-3" />
            </button>
          )}

          {debouncedSearch.trim() && (
            <button
              type="button"
              onClick={() => {
                setSearch("");
                setDebouncedSearch("");
              }}
              className="inline-flex items-center gap-1 rounded-full border border-border bg-background px-3 py-1 text-xs"
            >
              Search: {debouncedSearch}
              <X className="h-3 w-3" />
            </button>
          )}

          {selectedMemberIds.map((selectedId) => {
            const member = dedupedMembers.find((candidate) => candidate.id === selectedId);
            if (!member) return null;
            return (
              <button
                key={selectedId}
                type="button"
                onClick={() =>
                  setSelectedMemberIds((prev) => prev.filter((id) => id !== selectedId))
                }
                className="inline-flex items-center gap-1 rounded-full border border-border bg-background px-3 py-1 text-xs"
              >
                {member.name}
                <X className="h-3 w-3" />
              </button>
            );
          })}

          </div>
        </div>
      )}

      {loadingError && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
          {loadingError}
        </div>
      )}

      {starFeedback && (
        <div className="rounded-lg border border-emerald-400/30 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-700 dark:text-emerald-400">
          {starFeedback}
        </div>
      )}

      {spotlightProjectId && (
        <Card className="glass border-primary/35">
          <CardHeader className="pb-3">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-xs uppercase tracking-wide text-primary">Quick Project Preview</p>
                <CardTitle className="mt-1 text-xl">{spotlightProject?.name || "Project preview"}</CardTitle>
              </div>
              <div className="flex items-center gap-2">
                {spotlightProject && (
                  <Button
                    size="sm"
                    onClick={() => {
                      setPreviewProject(spotlightProject);
                    }}
                  >
                    Preview Project
                  </Button>
                )}
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setSpotlightProjectId("")}
                >
                  Dismiss Preview
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {spotlightProject ? (
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                <div className="rounded-lg border border-border/70 bg-background/50 p-3">
                  <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Status</p>
                  <p className={`mt-1 inline-flex rounded-full px-2.5 py-1 text-xs font-medium capitalize ${getStatusStyles(spotlightProject.status)}`}>
                    {spotlightProject.status}
                  </p>
                </div>
                <div className="rounded-lg border border-border/70 bg-background/50 p-3">
                  <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Date Range</p>
                  <p className="mt-1 text-sm font-medium">
                    {spotlightProject.start_date || "-"} to {spotlightProject.deadline || "-"}
                  </p>
                </div>
                <div className="rounded-lg border border-border/70 bg-background/50 p-3">
                  <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Budget</p>
                  <p className="mt-1 text-sm font-medium">
                    {spotlightProject.budget ? `$${spotlightProject.budget.toLocaleString()}` : "-"}
                  </p>
                </div>
                <div className="rounded-lg border border-border/70 bg-background/50 p-3">
                  <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Client</p>
                  <p className="mt-1 text-sm font-medium">{getClientDisplayName(spotlightProject.client_name)}</p>
                </div>

                <div className="rounded-lg border border-border/70 bg-background/50 p-3 md:col-span-2">
                  <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Assigned Team</p>
                  <p className="mt-1 text-sm font-medium">
                    {getProjectAssigneeNames(spotlightProject).join(", ") || "No members assigned"}
                  </p>
                </div>
                <div className="rounded-lg border border-border/70 bg-background/50 p-3 xl:col-span-2">
                  <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Labels</p>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {(spotlightProject.labels || []).length > 0 ? (
                      (spotlightProject.labels || []).map((label) => (
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
                  <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Description</p>
                  <div
                    className="prose prose-sm mt-1 max-h-52 max-w-none overflow-hidden text-sm text-muted-foreground"
                    title={spotlightProject.description || "No description available."}
                    dangerouslySetInnerHTML={{
                      __html: spotlightProject.description
                        ? renderMarkdownHtml(spotlightProject.description)
                        : "<p class=\"text-muted-foreground\">No description available.</p>",
                    }}
                  />
                </div>
              </div>
            ) : (
              <div className="rounded-lg border border-dashed border-border p-4 text-sm text-muted-foreground">
                The selected project was not found in the current list. Clear filters or dismiss this preview.
              </div>
            )}
          </CardContent>
        </Card>
      )}

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
            <div className="hidden items-center justify-end border-b border-border/60 px-3 py-2 md:flex">
              <div className="inline-flex items-center gap-1 rounded-md border border-border/70 bg-background/70 p-1">
                <Button
                  type="button"
                  size="sm"
                  variant={desktopView === "list" ? "default" : "ghost"}
                  className={cn("h-8 gap-1.5 px-2.5 text-xs", desktopView === "list" && "bg-primary text-primary-foreground hover:bg-primary/90")}
                  onClick={() => setDesktopView("list")}
                >
                  <List className="h-3.5 w-3.5" />
                  List
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant={desktopView === "card" ? "default" : "ghost"}
                  className={cn("h-8 gap-1.5 px-2.5 text-xs", desktopView === "card" && "bg-primary text-primary-foreground hover:bg-primary/90")}
                  onClick={() => setDesktopView("card")}
                >
                  <LayoutGrid className="h-3.5 w-3.5" />
                  Card
                </Button>
              </div>
            </div>

            <div className="divide-y divide-border md:hidden">
              {sortedProjects.map((project) => {
                const assigneeMembers = getProjectAssignees(project);
                const assigneeNames = getProjectAssigneeNames(project).join(", ");
                const assigneeInitials =
                  assigneeMembers
                    .slice(0, 3)
                    .map((member) => getNameInitials(member.name, member.email))
                    .join(", ") + (assigneeMembers.length > 3 ? ".." : "");
                const deadline = getDeadlineCopy(project.deadline);
                return (
                  <div
                    key={project.id}
                    className={`flex flex-col gap-2.5 p-3 hover:bg-accent/20 transition-all duration-300 card-hover cursor-pointer sm:p-4 ${highlightProjectId === project.id ? "ring-1 ring-amber-400/50 bg-amber-400/5" : ""}`}
                    role="button"
                    tabIndex={0}
                    onClick={() => {
                      setPreviewProject(project);
                    }}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        setPreviewProject(project);
                      }
                    }}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex min-w-0 items-center gap-2.5 sm:gap-3">
                      <button
                        type="button"
                        className="h-6 w-6 flex items-center justify-center rounded-full border border-border bg-background/60 text-muted-foreground shrink-0 btn-glow sm:h-8 sm:w-8"
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleStar(project.id);
                        }}
                        title={starredIds.includes(project.id) ? "Unstar project" : "Star project"}
                      >
                        {starredIds.includes(project.id) ? (
                          <Star className="h-3 w-3 text-amber-400 sm:h-4 sm:w-4" />
                        ) : (
                          <Star className="h-3 w-3 text-muted-foreground sm:h-4 sm:w-4" />
                        )}
                      </button>
                      <div
                        className="h-8 w-8 rounded-lg flex items-center justify-center shrink-0 sm:h-10 sm:w-10"
                        style={{
                          backgroundColor: `${project.color || "#8B5CF6"}20`,
                        }}
                        onClick={(e) => e.stopPropagation()}
                      >
                        {(() => {
                          const Icon = ICON_MAP[project.icon || "FolderKanban"] || FolderKanban;
                          return <Icon className="h-4 w-4 sm:h-5 sm:w-5" style={{ color: project.color || "#8B5CF6" }} />;
                        })()}
                      </div>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium sm:text-base">{project.name}</p>
                        {assigneeMembers.length > 0 ? (
                          <div className="mt-1 flex items-center gap-1.5">
                            <div className="flex -space-x-2">
                              {assigneeMembers.slice(0, 4).map((member) => (
                                <div key={member.id} className="rounded-full border border-background" title={member.name}>
                                  <MemberAvatar
                                    name={member.name}
                                    email={member.email}
                                    userId={member.user_id}
                                    sizeClass="h-4 w-4 sm:h-5 sm:w-5"
                                    textClass="text-[9px]"
                                  />
                                </div>
                              ))}
                            </div>
                            {assigneeMembers.length > 4 && (
                              <span className="text-[10px] text-muted-foreground">+{assigneeMembers.length - 4}</span>
                            )}
                            <span className="max-w-[22ch] truncate text-[10px] text-muted-foreground md:hidden">
                              {assigneeInitials}
                            </span>
                            <span className="hidden max-w-[34ch] truncate text-xs text-muted-foreground md:inline">
                              {assigneeNames}
                            </span>
                          </div>
                        ) : (
                          <p className="text-xs text-muted-foreground truncate">No assignees</p>
                        )}
                      </div>
                      </div>

                      <div className="flex shrink-0 flex-col items-end gap-1">
                        <span className={cn("inline-flex rounded-full border px-2 py-0.5 text-[10px] font-medium", getDeadlineToneClass(deadline.tone))}>
                          {deadline.label}
                        </span>
                        <button
                          type="button"
                          className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-medium capitalize ${getStatusStyles(project.status)}`}
                          onClick={(e) => {
                            e.stopPropagation();
                            handleStatusChange(project);
                          }}
                        >
                          {project.status}
                        </button>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-[11px] text-muted-foreground">
                      <span className="truncate">{getClientDisplayName(project.client_name)}</span>
                      <span className="text-right">Budget: {project.budget ? `$${project.budget.toLocaleString()}` : "-"}</span>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="hidden md:block">
              {desktopView === "list" ? (
                <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/30 text-muted-foreground">
                    <th className="px-4 py-3 text-left font-medium">
                      <button type="button" className="inline-flex items-center gap-1 transition-colors hover:text-foreground" onClick={() => toggleTableSort("project")}>
                        Project
                        {getSortIcon("project")}
                      </button>
                    </th>
                    <th className="px-4 py-3 text-left font-medium">
                      <button type="button" className="inline-flex items-center gap-1 transition-colors hover:text-foreground" onClick={() => toggleTableSort("status")}>
                        Status
                        {getSortIcon("status")}
                      </button>
                    </th>
                    <th className="px-4 py-3 text-left font-medium">
                      <button type="button" className="inline-flex items-center gap-1 transition-colors hover:text-foreground" onClick={() => toggleTableSort("deadline")}>
                        Deadline
                        {getSortIcon("deadline")}
                      </button>
                    </th>
                    <th className="hidden px-4 py-3 text-left font-medium xl:table-cell">Assigned Team Member</th>
                    <th className="hidden px-4 py-3 text-right font-medium xl:table-cell">
                      <button type="button" className="ml-auto inline-flex items-center gap-1 transition-colors hover:text-foreground" onClick={() => toggleTableSort("budget")}>
                        Budget
                        {getSortIcon("budget")}
                      </button>
                    </th>
                    <th className="px-4 py-3 text-right font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {desktopSortedProjects.map((project) => {
                    const assignees = getProjectAssigneeNames(project);
                    const assigneeMembers = getProjectAssignees(project);
                    const deadlineInfo = getDeadlineCopy(project.deadline);
                    return (
                      <tr
                        key={project.id}
                        className={`border-b border-border/70 hover:bg-accent/20 transition-all duration-300 ${highlightProjectId === project.id ? "bg-amber-400/5" : ""}`}
                      >
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-3 min-w-0">
                            <button
                              type="button"
                              className="h-8 w-8 flex items-center justify-center rounded-full border border-border bg-background/60 text-muted-foreground shrink-0 btn-glow"
                              onClick={(e) => {
                                e.stopPropagation();
                                toggleStar(project.id);
                              }}
                              title={starredIds.includes(project.id) ? "Unstar project" : "Star project"}
                            >
                              {starredIds.includes(project.id) ? (
                                <Star className="h-4 w-4 text-amber-400" />
                              ) : (
                                <Star className="h-4 w-4 text-muted-foreground" />
                              )}
                            </button>
                            <div
                              className="h-10 w-10 rounded-lg flex items-center justify-center shrink-0"
                              style={{ backgroundColor: `${project.color || "#8B5CF6"}20` }}
                            >
                              {(() => {
                                const Icon = ICON_MAP[project.icon || "FolderKanban"] || FolderKanban;
                                return <Icon className="h-5 w-5" style={{ color: project.color || "#8B5CF6" }} />;
                              })()}
                            </div>
                            <div className="min-w-0">
                              <button
                                type="button"
                                className="max-w-full truncate text-left font-medium text-foreground hover:text-primary"
                                onClick={() => router.push(`/projects/${project.id}`)}
                                title={`Open ${project.name}`}
                              >
                                {project.name}
                              </button>
                              <p className="text-xs text-muted-foreground truncate">
                                {typeof project.task_count === "number"
                                  ? `${project.task_count} task${project.task_count === 1 ? "" : "s"}`
                                  : "No task count"}
                              </p>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={`inline-flex px-3 py-1 rounded-full text-xs font-medium capitalize ${getStatusStyles(project.status)}`}
                            role="button"
                            onClick={() => handleStatusChange(project)}
                          >
                            {project.status}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-muted-foreground">
                          {project.deadline ? (
                            <div className="flex flex-col gap-1">
                              <span>{project.deadline}</span>
                              <span className={cn("inline-flex w-fit rounded-full border px-2 py-0.5 text-[10px] font-medium", getDeadlineToneClass(deadlineInfo.tone))}>
                                {deadlineInfo.label}
                              </span>
                            </div>
                          ) : (
                            "-"
                          )}
                        </td>
                        <td className="hidden px-4 py-3 text-muted-foreground max-w-80 xl:table-cell">
                          {assigneeMembers.length > 0 ? (
                            <div className="flex items-center gap-2">
                              <div className="flex -space-x-2">
                                {assigneeMembers.slice(0, 5).map((member) => (
                                  <div key={member.id} className="rounded-full border border-background" title={member.name}>
                                    <MemberAvatar
                                      name={member.name}
                                      email={member.email}
                                      userId={member.user_id}
                                      sizeClass="h-6 w-6"
                                      textClass="text-[10px]"
                                    />
                                  </div>
                                ))}
                              </div>
                              <span className="truncate text-xs text-muted-foreground">{assignees.join(", ")}</span>
                            </div>
                          ) : (
                            "-"
                          )}
                        </td>
                        <td className="hidden px-4 py-3 text-right font-mono xl:table-cell">
                          {project.budget ? `$${project.budget.toLocaleString()}` : "-"}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center justify-end gap-2">
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              className="h-8 px-2 text-[11px] lg:h-9 lg:px-3 lg:text-sm"
                              onClick={() => setPreviewProject(project)}
                            >
                              <Eye className="mr-1.5 h-4 w-4" />
                              <span className="hidden md:inline">Preview</span>
                            </Button>
                            <Button
                              type="button"
                              size="sm"
                              className="h-8 px-2 text-[11px] bg-primary text-primary-foreground hover:bg-primary/90 lg:h-9 lg:px-3 lg:text-sm"
                              onClick={() => router.push(`/projects/${project.id}`)}
                            >
                              <span className="hidden md:inline">Open</span>
                            </Button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
                </div>
              ) : (
                <div className="p-3 md:p-4">
                  <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                    {desktopSortedProjects.map((project) => {
                      const assigneeMembers = getProjectAssignees(project);
                      const deadlineInfo = getDeadlineCopy(project.deadline);
                      const progress = getProjectCompletionEstimate(project.status, project.task_count);

                      return (
                        <div
                          key={project.id}
                          className={`rounded-xl border border-border/70 bg-background/60 p-3 transition-all duration-300 hover:border-primary/40 hover:bg-accent/10 ${highlightProjectId === project.id ? "ring-1 ring-amber-400/50 bg-amber-400/5" : ""}`}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <button
                              type="button"
                              className="min-w-0 text-left"
                              onClick={() => router.push(`/projects/${project.id}`)}
                              title={`Open ${project.name}`}
                            >
                              <p className="truncate text-sm font-semibold">{project.name}</p>
                              <p className="mt-0.5 text-[11px] text-muted-foreground">
                                {typeof project.task_count === "number"
                                  ? `${project.task_count} task${project.task_count === 1 ? "" : "s"}`
                                  : "No task count"}
                              </p>
                            </button>

                             <div className="flex items-center gap-1.5">
                               <button
                                 type="button"
                                 className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-border/60 bg-background/70 text-muted-foreground hover:border-primary/50 hover:text-foreground"
                                 onClick={(e) => {
                                   e.stopPropagation();
                                   toggleStar(project.id);
                                 }}
                                 title={starredIds.includes(project.id) ? "Unstar project" : "Star project"}
                               >
                                 <Star className={cn("h-3.5 w-3.5", starredIds.includes(project.id) ? "text-amber-400" : "text-muted-foreground")} />
                               </button>
                               <Button
                                 type="button"
                                 size="sm"
                                 variant="outline"
                                 className="h-7 px-2 text-[11px]"
                                 onClick={() => setPreviewProject(project)}
                               >
                                 Preview
                               </Button>
                               <Button
                                 type="button"
                                 size="sm"
                                 className="h-7 px-2 text-[11px] bg-accent text-accent-foreground hover:bg-accent/90"
                                 onClick={(e) => {
                                   e.stopPropagation();
                                   router.push(`/projects/${project.id}`);
                                 }}
                               >
                                 Open
                               </Button>
                             </div>
                          </div>

                          <div className="mt-2">
                            <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                              <span>Progress</span>
                              <span>{progress}%</span>
                            </div>
                            <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-primary/15">
                              <div className="h-full rounded-full bg-primary" style={{ width: `${progress}%` }} />
                            </div>
                          </div>

                          <div className="mt-2.5 flex items-center justify-between gap-2">
                            <div className="flex -space-x-2">
                              {assigneeMembers.slice(0, 4).map((member) => (
                                <div key={member.id} className="rounded-full border border-background" title={member.name}>
                                  <MemberAvatar
                                    name={member.name}
                                    email={member.email}
                                    userId={member.user_id}
                                    sizeClass="h-6 w-6"
                                    textClass="text-[10px]"
                                  />
                                </div>
                              ))}
                              {assigneeMembers.length > 4 && (
                                <div className="flex h-6 w-6 items-center justify-center rounded-full border border-background bg-muted text-[10px] text-muted-foreground">
                                  +{assigneeMembers.length - 4}
                                </div>
                              )}
                            </div>
                            <span className={cn("inline-flex rounded-full border px-2 py-0.5 text-[10px] font-medium", getDeadlineToneClass(deadlineInfo.tone))}>
                              {deadlineInfo.label}
                            </span>
                          </div>

                          <div className="mt-2 flex flex-wrap items-center gap-1.5">
                            <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-medium capitalize ${getStatusStyles(project.status)}`}>
                              {project.status}
                            </span>
                            {(project.labels || []).slice(0, 2).map((label) => (
                              <span key={label} className="inline-flex rounded-full border border-border/70 bg-accent/30 px-2 py-0.5 text-[10px]">
                                {label}
                              </span>
                            ))}
                          </div>

                           <div className="mt-2.5 flex items-center justify-between gap-2 text-xs text-muted-foreground">
                            <span className="truncate">{getClientDisplayName(project.client_name)}</span>
                            <span className="font-mono">{project.budget ? `$${project.budget.toLocaleString()}` : "-"}</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

       <ProjectPreviewModal
         project={previewProject}
         canEdit={canEdit}
         availableMembers={dedupedMembers}
         onClose={() => setPreviewProject(null)}
         onProjectUpdated={(updated) => {
           setProjects((prev) => prev.map((item) => (item.id === updated.id ? { ...item, ...updated } : item)));
           setPreviewProject((current) => (current && current.id === updated.id ? { ...current, ...updated } : current));
         }}
         onOpenProjectPage={(projectId) => router.push(`/projects/${projectId}`)}
       />

        <ProjectFormModal
          open={addProjectOpen}
          onOpenChange={setAddProjectOpen}
          onSuccess={(project) => {
            handleProjectCreated(project);
            router.refresh();
          }}
          initialMembers={members}
          initialClients={clients}
        />
     </div>
   );
 }
