"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { type DateRange } from "react-day-picker";

import { useUser } from "@/components/user-provider";
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
  Check,
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

interface ProjectTaskPreview {
  id: string;
  title: string;
  status: "todo" | "in-progress" | "done";
  priority: "low" | "medium" | "high" | "urgent";
  due_date: string | null;
}

const PROJECT_STATUSES: Project["status"][] = [
  "active",
  "in-progress",
  "on-hold",
  "completed",
  "closed",
];

const PROJECT_STATUS_BADGE_CLASS: Record<Project["status"], string> = {
  active: "bg-emerald-500/15 text-emerald-200 border-emerald-500/40",
  "in-progress": "bg-blue-500/15 text-blue-200 border-blue-500/40",
  "on-hold": "bg-amber-500/15 text-amber-200 border-amber-500/40",
  completed: "bg-violet-500/15 text-violet-200 border-violet-500/40",
  closed: "bg-zinc-500/15 text-zinc-200 border-zinc-500/40",
};

const getClientDisplayName = (clientName?: string | null) => {
  const normalized = clientName?.trim();
  return normalized ? normalized : "Internal project";
};

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
  const [loading, setLoading] = useState(true);
  const [loadingError, setLoadingError] = useState<string | null>(null);
  const [previewProject, setPreviewProject] = useState<Project | null>(null);
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
  const memberFilterRef = useRef<HTMLDivElement | null>(null);
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

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        memberFilterRef.current &&
        !memberFilterRef.current.contains(event.target as Node)
      ) {
        setMemberFilterOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

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

  // Load data on auth ready and filter changes (functions declared above)
  useEffect(() => {
    if (!userLoading) {
      fetchProjects();
      fetchMembers();
      fetchStars();
    }
  }, [userLoading, fetchProjects, fetchMembers, fetchStars]);

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

  const hasActiveFilters =
    filter !== "all" || debouncedSearch.trim().length > 0 || selectedMemberIds.length > 0;

  if (userLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Projects</h1>
          <p className="text-muted-foreground text-sm sm:text-base">
            Manage your projects and track progress.
          </p>
        </div>
        {canEdit && (
          <Button
            onClick={() => {
              router.push("/projects/new");
            }}
            className="gap-2 w-fit"
          >
            <Plus className="h-4 w-4" /> Add Project
          </Button>
        )}
      </div>

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
          <option value="all">All Status</option>
          <option value="active">Active</option>
          <option value="in-progress">In Progress</option>
          <option value="on-hold">On Hold</option>
          <option value="completed">Completed</option>
          <option value="closed">Closed</option>
        </select>
        <div className="relative min-w-56" ref={memberFilterRef}>
          <button
            type="button"
            onClick={() => setMemberFilterOpen((open) => !open)}
            className="h-10 w-full rounded-lg border border-input bg-background px-3 text-left text-sm"
          >
            {selectedMemberIds.length === 0
              ? "Filter by assignees"
              : `${selectedMemberIds.length} assignee${selectedMemberIds.length > 1 ? "s" : ""} selected`}
          </button>

          {memberFilterOpen && (
            <div className="absolute z-20 mt-2 max-h-72 w-full overflow-auto rounded-lg border border-border bg-card p-2 shadow-xl">
              {dedupedMembers.length === 0 ? (
                <p className="px-2 py-1 text-xs text-muted-foreground">No team members available</p>
              ) : (
                dedupedMembers.map((member) => {
                  const checked = selectedMemberIds.includes(member.id);
                  return (
                    <button
                      key={member.id}
                      type="button"
                      onClick={() => {
                        setSelectedMemberIds((prev) =>
                          prev.includes(member.id)
                            ? prev.filter((id) => id !== member.id)
                            : [...prev, member.id],
                        );
                      }}
                      className="flex w-full items-center justify-between rounded-md px-2 py-2 text-left text-sm hover:bg-accent/60"
                    >
                      <span className="truncate">{member.name}</span>
                      {checked && <Check className="h-4 w-4 text-primary" />}
                    </button>
                  );
                })
              )}
              <div className="mt-2 border-t border-border pt-2">
                <button
                  type="button"
                  onClick={() => setSelectedMemberIds([])}
                  className="w-full rounded-md px-2 py-1 text-left text-xs text-muted-foreground hover:bg-accent/60"
                >
                  Clear selection
                </button>
              </div>
            </div>
          )}
        </div>
        <select
          value={sortMode}
          onChange={(e) => setSortMode(e.target.value as typeof sortMode)}
          className="h-10 px-3 rounded-lg border border-input bg-background text-sm"
        >
          <option value="priority">Priority (Starred, Mine, Due Date)</option>
          <option value="due_date">Due Date</option>
          <option value="name">Name</option>
          <option value="custom">Custom Order</option>
        </select>
      </div>

      {hasActiveFilters && (
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

              <button
                type="button"
                onClick={() => {
                  setFilter("all");
                  setSearch("");
                  setDebouncedSearch("");
                  setSpotlightProjectId("");
                  setSelectedMemberIds([]);
                  setMobileFiltersOpen(false);
                }}
                className="inline-flex items-center gap-1 rounded-full border border-border bg-muted/40 px-3 py-1 text-xs text-muted-foreground"
              >
                Clear all
              </button>
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
                  <p className="mt-1 text-sm text-muted-foreground">
                    {spotlightProject.description || "No description available."}
                  </p>
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
            <div className="divide-y divide-border md:hidden">
              {sortedProjects.map((project, index) => {
                const assignees = getProjectAssigneeNames(project);
                return (
                  <div
                    key={project.id}
                    className={`flex flex-col gap-3 p-4 hover:bg-accent/20 transition-all duration-300 card-hover animate-slide-up cursor-pointer ${highlightProjectId === project.id ? "ring-1 ring-amber-400/50 bg-amber-400/5" : ""}`}
                    style={{ animationDelay: `${index * 50}ms` }}
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
                        style={{
                          backgroundColor: `${project.color || "#8B5CF6"}20`,
                        }}
                        onClick={(e) => e.stopPropagation()}
                      >
                        {(() => {
                          const Icon = ICON_MAP[project.icon || "FolderKanban"] || FolderKanban;
                          return <Icon className="h-5 w-5" style={{ color: project.color || "#8B5CF6" }} />;
                        })()}
                      </div>
                      <div className="min-w-0">
                        <p className="font-medium truncate">{project.name}</p>
                        <p className="text-xs text-muted-foreground truncate">
                          Assignee: {assignees.length > 0 ? assignees.join(", ") : "-"}
                        </p>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
                      <span>Deadline: {project.deadline || "-"}</span>
                      <span className="text-right">Budget: {project.budget ? `$${project.budget.toLocaleString()}` : "-"}</span>
                    </div>

                    <div className="flex items-center justify-between gap-2">
                      <span
                        className={`px-3 py-1 rounded-full text-xs font-medium capitalize ${getStatusStyles(project.status)}`}
                        role="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleStatusChange(project);
                        }}
                      >
                        {project.status}
                      </span>
                      <span className="text-xs text-muted-foreground">Click for preview</span>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/30 text-muted-foreground">
                    <th className="px-4 py-3 text-left font-medium">Project</th>
                    <th className="px-4 py-3 text-left font-medium">Status</th>
                    <th className="px-4 py-3 text-left font-medium">Deadline</th>
                    <th className="px-4 py-3 text-left font-medium">Assigned Team Member</th>
                    <th className="px-4 py-3 text-right font-medium">Budget</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedProjects.map((project, index) => {
                    const assignees = getProjectAssigneeNames(project);
                    return (
                      <tr
                        key={project.id}
                        className={`border-b border-border/70 cursor-pointer hover:bg-accent/20 transition-all duration-300 animate-slide-up ${highlightProjectId === project.id ? "bg-amber-400/5" : ""}`}
                        style={{ animationDelay: `${index * 50}ms` }}
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
                              <p className="font-medium truncate">{project.name}</p>
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
                            onClick={(e) => {
                              e.stopPropagation();
                              handleStatusChange(project);
                            }}
                          >
                            {project.status}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-muted-foreground">{project.deadline || "-"}</td>
                        <td className="px-4 py-3 text-muted-foreground max-w-80 truncate">
                          {assignees.length > 0 ? assignees.join(", ") : "-"}
                        </td>
                        <td className="px-4 py-3 text-right font-mono">
                          {project.budget ? `$${project.budget.toLocaleString()}` : "-"}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      <ProjectQuickPreviewModal
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
    </div>
  );
}

function ProjectQuickPreviewModal({
  project,
  canEdit,
  availableMembers,
  onClose,
  onProjectUpdated,
  onOpenProjectPage,
}: {
  project: Project | null;
  canEdit: boolean;
  availableMembers: Member[];
  onClose: () => void;
  onProjectUpdated: (project: Project) => void;
  onOpenProjectPage: (projectId: string) => void;
}) {
  const router = useRouter();
  const [tasksLoading, setTasksLoading] = useState(false);
  const [tasksExpanded, setTasksExpanded] = useState(false);
  const [descriptionExpanded, setDescriptionExpanded] = useState(false);
  const [projectTasks, setProjectTasks] = useState<ProjectTaskPreview[]>([]);
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

  const parseIsoDate = (value: string): Date | undefined => {
    if (!value) return undefined;
    const parsed = new Date(`${value}T00:00:00`);
    return Number.isNaN(parsed.getTime()) ? undefined : parsed;
  };

  const serializeIsoDate = (value: Date | undefined): string => {
    if (!value) return "";
    const year = value.getFullYear();
    const month = String(value.getMonth() + 1).padStart(2, "0");
    const day = String(value.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  };

  const formatDateLabel = (value?: string | null) => {
    if (!value) return "-";
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return value;
    return parsed.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
  };

  const getTimelineProgress = (startDate?: string | null, deadline?: string | null) => {
    if (!startDate || !deadline) return { hasTimeline: false, progress: 0, daysLeft: null as number | null };
    const start = new Date(startDate);
    const end = new Date(deadline);
    const now = new Date();
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end <= start) {
      return { hasTimeline: false, progress: 0, daysLeft: null as number | null };
    }
    const totalMs = end.getTime() - start.getTime();
    const elapsedMs = Math.min(Math.max(now.getTime() - start.getTime(), 0), totalMs);
    const progress = Math.round((elapsedMs / totalMs) * 100);
    const daysLeft = Math.ceil((end.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    return { hasTimeline: true, progress, daysLeft };
  };

  useEffect(() => {
    if (!project) return;
    const onEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };
    window.addEventListener("keydown", onEscape);
    return () => window.removeEventListener("keydown", onEscape);
  }, [project, onClose]);

  useEffect(() => {
    if (!project) return;

    setQuickEditMode(false);
    setTasksExpanded(false);
    setDescriptionExpanded(false);
    setQuickEditName(project.name || "");
    setQuickEditStatus(project.status || "active");
    setQuickEditStartDate(project.start_date || "");
    setQuickEditDeadline(project.deadline || "");
    setQuickEditBudget(typeof project.budget === "number" ? String(project.budget) : "");
    setQuickEditClient(project.client_name || "");
    setQuickEditDescription(project.description || "");
    setQuickEditMemberIds(
      (project.project_members || [])
        .map((pm) => pm.members?.id)
        .filter((id): id is string => Boolean(id))
    );
    setQuickEditLabels(project.labels || []);
    setQuickEditLabelInput("");
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

    void loadTasks();
  }, [project]);

  if (!project) return null;

  const dateRange: DateRange | undefined = {
    from: parseIsoDate(quickEditStartDate),
    to: parseIsoDate(quickEditDeadline),
  };

  const taskCount = typeof project.task_count === "number" ? project.task_count : projectTasks.length;
  const longDescription = project.description || "";
  const shouldClampDescription = longDescription.length > 220;
  const descriptionText =
    shouldClampDescription && !descriptionExpanded
      ? `${longDescription.slice(0, 220).trimEnd()}...`
      : longDescription;
  const timeline = getTimelineProgress(project.start_date || null, project.deadline || null);

  const saveQuickEdit = async () => {
    if (!project || !quickEditName.trim()) return;
    setQuickEditSaving(true);
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
          member_ids: quickEditMemberIds,
          labels: quickEditLabels,
        }),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok || !data) return;
      onProjectUpdated({ ...project, ...data });
      setQuickEditMode(false);
    } finally {
      setQuickEditSaving(false);
    }
  };

  const toggleQuickEditMember = (memberId: string) => {
    setQuickEditMemberIds((prev) =>
      prev.includes(memberId) ? prev.filter((id) => id !== memberId) : [...prev, memberId]
    );
  };

  const addQuickEditLabel = () => {
    const normalized = quickEditLabelInput.trim().replace(/,/g, "");
    if (!normalized) return;
    setQuickEditLabels((prev) => (prev.includes(normalized) ? prev : [...prev, normalized]));
    setQuickEditLabelInput("");
  };

  return (
    <Dialog open={Boolean(project)} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="z-[220] sm:max-w-[min(94vw,1100px)] max-h-[90vh] overflow-y-auto border-primary/35 bg-background/95 p-0 [&>button]:hidden">
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
            onClick={onClose}
          >
            <span className="text-base leading-none">×</span>
          </button>
          <div className="md:flex md:items-start md:justify-between md:gap-4">
            <div>
            <p className="text-xs uppercase tracking-wide text-primary">Project Preview</p>
            {quickEditMode ? (
              <Input value={quickEditName} onChange={(e) => setQuickEditName(e.target.value)} className="mt-1 h-10 text-xl font-semibold" />
            ) : (
              <CardTitle className="mt-1 text-2xl">{project.name}</CardTitle>
            )}
            </div>
            <div className="mt-3 min-w-0 md:mt-0 md:w-72">
              <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Project timeline progress</p>
              {timeline.hasTimeline ? (
                <>
                  <div className="mt-2 h-2 overflow-hidden rounded-full bg-primary/10">
                    <div className="h-full rounded-full bg-primary" style={{ width: `${Math.max(4, Math.min(100, timeline.progress))}%` }} />
                  </div>
                  <div className="mt-1 flex items-center justify-between text-[11px] text-muted-foreground">
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
        </CardHeader>
        <CardContent className="pt-4">
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-lg border border-border/70 bg-background/50 p-3">
              <Label className="block text-[11px] uppercase tracking-wide text-muted-foreground">Status</Label>
              {quickEditMode ? (
                <Select value={quickEditStatus} onValueChange={(value) => setQuickEditStatus(value as Project["status"])}>
                  <SelectTrigger className="mt-1 h-9 text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="in-progress">In progress</SelectItem>
                    <SelectItem value="on-hold">On hold</SelectItem>
                    <SelectItem value="completed">Completed</SelectItem>
                    <SelectItem value="closed">Closed</SelectItem>
                  </SelectContent>
                </Select>
              ) : (
                <Badge className={cn("mt-1 border text-[11px] capitalize", PROJECT_STATUS_BADGE_CLASS[project.status])}>
                  {project.status}
                </Badge>
              )}
            </div>
            <div className="rounded-lg border border-border/70 bg-background/50 p-3">
              <Label className="text-[11px] uppercase tracking-wide text-muted-foreground">Date Range</Label>
              {quickEditMode ? (
                <DateRangePicker
                  numberOfMonths={2}
                  showPresets={false}
                  className="mt-1"
                  date={dateRange}
                  onDateChange={(range) => {
                    setQuickEditStartDate(serializeIsoDate(range?.from));
                    setQuickEditDeadline(serializeIsoDate(range?.to));
                  }}
                />
              ) : <p className="mt-1 text-sm font-medium">{formatDateLabel(project.start_date)} to {formatDateLabel(project.deadline)}</p>}
            </div>
            <div className="rounded-lg border border-border/70 bg-background/50 p-3">
              <Label className="text-[11px] uppercase tracking-wide text-muted-foreground">Budget</Label>
              {quickEditMode ? (
                <Input type="number" min="0" className="mt-1 h-9 text-sm" value={quickEditBudget} onChange={(e) => setQuickEditBudget(e.target.value)} />
              ) : <p className="mt-1 text-sm font-medium">{project.budget ? `$${project.budget.toLocaleString()}` : "-"}</p>}
            </div>
            <div className="rounded-lg border border-border/70 bg-background/50 p-3">
              <Label className="text-[11px] uppercase tracking-wide text-muted-foreground">Client</Label>
              {quickEditMode ? (
                <Input className="mt-1 h-9 text-sm" value={quickEditClient} onChange={(e) => setQuickEditClient(e.target.value)} />
              ) : <p className="mt-1 text-sm font-medium">{getClientDisplayName(project.client_name)}</p>}
            </div>

            <div className="rounded-lg border border-border/70 bg-background/50 p-3 md:col-span-2">
              <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Assigned Team</p>
              {quickEditMode ? (
                <div className="mt-2 space-y-2">
                  <div className="grid max-h-40 gap-1 overflow-y-auto rounded-md border border-border/60 p-2">
                    {availableMembers.map((member) => {
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
                </div>
              ) : project.project_members && project.project_members.length > 0 ? (
                <div className="mt-2 flex flex-wrap gap-2">
                  {project.project_members
                    .map((pm) => pm.members)
                    .filter((member): member is Member => Boolean(member))
                    .map((member) => (
                        <button
                          key={`${member.user_id || member.email || member.name}`}
                          type="button"
                          onClick={() => router.push(`/team/${member.id}`)}
                          className="inline-flex items-center gap-2 rounded-full border border-border/70 bg-background/70 px-2 py-1"
                        >
                        <MemberAvatar
                          name={member.name}
                          email={member.email}
                          userId={member.user_id || undefined}
                          sizeClass="h-6 w-6"
                          textClass="text-[10px]"
                        />
                        <span className="text-xs font-medium">{member.name || member.email || "Member"}</span>
                        </button>
                      ))}
                </div>
              ) : (
                <p className="mt-1 text-sm font-medium">No members assigned</p>
              )}
            </div>
            <div className="rounded-lg border border-border/70 bg-background/50 p-3 md:col-span-2 xl:col-span-2">
              <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Labels</p>
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
                  {(project.labels || []).length > 0 ? (
                    (project.labels || []).map((label) => (
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
                <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Tasks</p>
                <button
                  type="button"
                  className="text-xs text-primary underline-offset-2 hover:underline"
                  onClick={() => setTasksExpanded((open) => !open)}
                >
                  {tasksExpanded ? "Collapse task timeline" : "Expand task timeline preview"}
                </button>
              </div>
              <p className="mt-1 text-sm text-muted-foreground">
                {tasksLoading
                  ? "Loading tasks..."
                  : `${taskCount} task${taskCount === 1 ? "" : "s"} linked to this project. Expand to preview and open each task.`}
              </p>
              <div className="mt-2">
                <Button size="sm" variant="outline" onClick={() => router.push(`/tasks?projectId=${project.id}`)}>
                  Open project tasks
                </Button>
              </div>
              {tasksExpanded && (
                <div className="mt-3 space-y-2">
                  {projectTasks.length === 0 ? (
                    <p className="text-xs text-muted-foreground">No tasks found.</p>
                  ) : (
                    projectTasks.slice(0, 6).map((task) => (
                      <button
                        key={task.id}
                        type="button"
                        onClick={() => router.push(`/tasks?projectId=${project.id}&taskId=${task.id}`)}
                        className="flex w-full items-center justify-between rounded-md border border-border/60 px-2 py-1.5 text-left text-xs hover:bg-accent/30"
                      >
                        <span className="truncate pr-3">{task.title}</span>
                        <span className="shrink-0 capitalize text-muted-foreground">{task.status}</span>
                      </button>
                    ))
                  )}
                </div>
              )}
            </div>

            <div className="rounded-lg border border-border/70 bg-background/50 p-3 md:col-span-2 xl:col-span-4">
              <Label className="text-[11px] uppercase tracking-wide text-muted-foreground">Description</Label>
              {quickEditMode ? (
                <Textarea className="mt-1 text-sm" rows={4} value={quickEditDescription} onChange={(e) => setQuickEditDescription(e.target.value)} />
              ) : (
                <>
                  <p className="mt-1 text-sm text-muted-foreground">{descriptionText || "No description available."}</p>
                  {shouldClampDescription && (
                    <button type="button" className="mt-2 text-xs text-primary underline-offset-2 hover:underline" onClick={() => setDescriptionExpanded((open) => !open)}>
                      {descriptionExpanded ? "Show less" : "Show more"}
                    </button>
                  )}
                </>
              )}
            </div>
          </div>
        </CardContent>
        <CardFooter className="sticky bottom-0 z-20 flex flex-col gap-2 border-t border-border/60 bg-background/90 p-3 sm:flex-row sm:items-center sm:justify-between sm:p-4">
          <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center">
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
            {canEdit && (
              quickEditMode ? (
                <Button
                  size="sm"
                  className="w-full sm:w-auto"
                  onClick={saveQuickEdit}
                  disabled={quickEditSaving || !quickEditName.trim()}
                >
                  {quickEditSaving ? "Saving..." : "Save quick edit"}
                </Button>
              ) : (
                <Button size="sm" variant="outline" className="w-full sm:w-auto" onClick={() => setQuickEditMode(true)}>
                  Quick Edit
                </Button>
              )
            )}
            <Button size="sm" variant="outline" className="w-full sm:w-auto" onClick={() => onOpenProjectPage(project.id)}>
              Open Project Page
            </Button>
          </div>
        </CardFooter>
      </Card>
      </DialogContent>
    </Dialog>
  );
}
