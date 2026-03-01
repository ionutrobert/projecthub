"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  Eye,
  EyeOff,
  LayoutGrid,
  List,
  Mail,
  Pencil,
  Plus,
  Search,
  Shield,
  UserPlus,
  Users,
  XCircle,
  AlertCircle,
} from "lucide-react";

import MemberAvatar from "@/components/member-avatar";
import { useUser } from "@/components/user-provider";
import { useTheme } from "@/components/theme-provider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { getAvatarPickerOptions, getNameInitials } from "@/lib/avatar";

type Member = {
  id: string;
  user_id?: string | null;
  avatar_url?: string | null;
  name: string;
  email: string | null;
  role: string; // Job Title
  system_role: string; // Permission
};

type Project = {
  id: string;
  name: string;
  project_members?: Array<{
    members?: {
      id?: string;
    } | null;
  }>;
};

type Task = {
  id: string;
  assignee_member_id: string | null;
  status: "todo" | "in-progress" | "done";
};

const PERMISSION_OPTIONS = ["admin", "member", "viewer"];
const JOB_TITLE_OPTIONS = [
  "developer",
  "designer",
  "pm",
  "accountant",
  "marketing",
  "sales",
  "ops",
  "finance",
];

type TeamViewMode = "list" | "card";
type TeamSortKey = "member" | "email" | "role" | "projects" | "tasks";

export default function TeamPage() {
  const router = useRouter();
  const {
    profile,
    impersonation,
    clearImpersonation,
    loading: userLoading,
  } = useUser();
  const { accentColor } = useTheme();
  const currentRole = profile?.role || "viewer";
  const actualRole = profile?.actual_role || currentRole;
  const canEdit = currentRole === "admin" || currentRole === "member";
  const isAdmin = actualRole === "admin";
  const userId = profile?.id;

  const [members, setMembers] = useState<Member[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newPasswordConfirm, setNewPasswordConfirm] = useState("");
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showNewPasswordConfirm, setShowNewPasswordConfirm] = useState(false);
  const [newJobTitle, setNewJobTitle] = useState("");
  const [newSystemRole, setNewSystemRole] = useState("member");
  const [newAvatarUrl, setNewAvatarUrl] = useState("");
  const [showOptionalFields, setShowOptionalFields] = useState(false);
  const [avatarVariant, setAvatarVariant] = useState(0);
  const [createLoginAccount, setCreateLoginAccount] = useState(true);
  const [saving, setSaving] = useState(false);
  const [modalError, setModalError] = useState<string>("");
  const [draftJobTitles, setDraftJobTitles] = useState<Record<string, string>>(
    {},
  );
  const [draftSystemRoles, setDraftSystemRoles] = useState<
    Record<string, string>
  >({});
  const [draftNames, setDraftNames] = useState<Record<string, string>>({});
  const [editingMemberId, setEditingMemberId] = useState<string | null>(null);
  const [savingMemberId, setSavingMemberId] = useState<string | null>(null);
  const [impersonatingMemberId, setImpersonatingMemberId] = useState<
    string | null
  >(null);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("__all__");
  const [jobTitleFilter, setJobTitleFilter] = useState<string>("__all__");
  const [previewMember, setPreviewMember] = useState<Member | null>(null);
  const [teamView, setTeamView] = useState<TeamViewMode>(() => {
    if (typeof window === "undefined") return "list";
    const saved = window.sessionStorage.getItem("projecthub-team-view-mode");
    return saved === "card" || saved === "list" ? saved : "list";
  });
  const [sortKey, setSortKey] = useState<TeamSortKey>("member");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");
  const [viewportWidth, setViewportWidth] = useState<number>(() =>
    typeof window === "undefined" ? 1280 : window.innerWidth,
  );
  const [listPage, setListPage] = useState(1);
  const [cardVisibleCount, setCardVisibleCount] = useState(10);

  const resetCreateForm = () => {
    setModalError("");
    setNewName("");
    setNewEmail("");
    setNewPassword("");
    setNewPasswordConfirm("");
    setShowNewPassword(false);
    setShowNewPasswordConfirm(false);
    setNewJobTitle("");
    setNewSystemRole("member");
    setNewAvatarUrl("");
    setShowOptionalFields(false);
    setAvatarVariant(0);
    setCreateLoginAccount(true);
  };

  const avatarSeed =
    (newName || newEmail || "projecthub-member").trim() || "projecthub-member";
  const avatarOptions = useMemo(
    () => getAvatarPickerOptions(avatarSeed, avatarVariant),
    [avatarSeed, avatarVariant],
  );

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

  const filteredMembers = useMemo(() => {
    // Server-side filtering already applied for search and jobTitle.
    // Apply only system_role (roleFilter) client-side.
    return dedupedMembers.filter((member) => {
      const matchesRole =
        roleFilter === "__all__" ||
        member.system_role === roleFilter;
      return matchesRole;
    });
  }, [dedupedMembers, roleFilter]);

  const roleStats = useMemo(() => {
    return {
      total: dedupedMembers.length,
      admin: dedupedMembers.filter((m) => m.system_role === "admin").length,
      member: dedupedMembers.filter((m) => m.system_role === "member").length,
      viewer: dedupedMembers.filter((m) => m.system_role === "viewer").length,
    };
  }, [dedupedMembers]);

  const uniqueJobTitles = useMemo(() => {
    const titles = new Set<string>();
    dedupedMembers.forEach((member) => {
      if (member.role) {
        titles.add(member.role);
      }
    });
    return Array.from(titles).sort((a, b) => a.localeCompare(b));
  }, [dedupedMembers]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.sessionStorage.setItem("projecthub-team-view-mode", teamView);
  }, [teamView]);

  useEffect(() => {
    const onResize = () => setViewportWidth(window.innerWidth);
    onResize();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  useEffect(() => {
    if (userLoading) return;
    if (profile) return;

    setTeamView("list");
    if (typeof window !== "undefined") {
      window.sessionStorage.removeItem("projecthub-team-view-mode");
    }
  }, [profile, userLoading]);

  const getProjectCountForMember = (memberId: string) => {
    return projects.filter((project) =>
      (project.project_members || []).some((pm) => pm.members?.id === memberId),
    ).length;
  };

  const getTaskStatsForMember = (memberId: string) => {
    const memberTasks = tasks.filter(
      (task) => task.assignee_member_id === memberId,
    );
    return {
      total: memberTasks.length,
      inProgress: memberTasks.filter((task) => task.status === "in-progress")
        .length,
      done: memberTasks.filter((task) => task.status === "done").length,
    };
  };

  const projectCountByMember = useMemo(() => {
    const map = new Map<string, number>();
    for (const project of projects) {
      const seen = new Set<string>();
      for (const pm of project.project_members || []) {
        const memberId = pm.members?.id;
        if (!memberId || seen.has(memberId)) continue;
        seen.add(memberId);
        map.set(memberId, (map.get(memberId) || 0) + 1);
      }
    }
    return map;
  }, [projects]);

  const taskCountByMember = useMemo(() => {
    const map = new Map<string, number>();
    for (const task of tasks) {
      if (!task.assignee_member_id) continue;
      map.set(
        task.assignee_member_id,
        (map.get(task.assignee_member_id) || 0) + 1,
      );
    }
    return map;
  }, [tasks]);

  const sortedMembers = useMemo(() => {
    const rows = [...filteredMembers];
    const factor = sortDirection === "asc" ? 1 : -1;

    rows.sort((a, b) => {
      if (sortKey === "member") return a.name.localeCompare(b.name) * factor;
      if (sortKey === "email")
        return (a.email || "").localeCompare(b.email || "") * factor;
      if (sortKey === "role") return a.role.localeCompare(b.role) * factor;
      if (sortKey === "projects") {
        return (
          ((projectCountByMember.get(a.id) || 0) -
            (projectCountByMember.get(b.id) || 0)) *
          factor
        );
      }
      return (
        ((taskCountByMember.get(a.id) || 0) -
          (taskCountByMember.get(b.id) || 0)) *
        factor
      );
    });

    return rows;
  }, [
    filteredMembers,
    sortDirection,
    sortKey,
    projectCountByMember,
    taskCountByMember,
  ]);

  const isPc = viewportWidth >= 1280;
  const listPageSize = isPc ? 9 : 10;
  const cardBaseCount = isPc && teamView === "card" ? 12 : 10;
  const listTotalPages = Math.max(
    1,
    Math.ceil(sortedMembers.length / listPageSize),
  );
  const pagedListMembers = useMemo(() => {
    const start = (listPage - 1) * listPageSize;
    return sortedMembers.slice(start, start + listPageSize);
  }, [sortedMembers, listPage, listPageSize]);
  const visibleCardMembers = useMemo(
    () => sortedMembers.slice(0, cardVisibleCount),
    [sortedMembers, cardVisibleCount],
  );

  useEffect(() => {
    setListPage(1);
    setCardVisibleCount(cardBaseCount);
  }, [search, roleFilter, sortKey, sortDirection, teamView, cardBaseCount]);

  useEffect(() => {
    setListPage((current) => Math.min(current, listTotalPages));
  }, [listTotalPages]);

  const fetchMembers = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // Build query params for server-side filtering
      const params = new URLSearchParams();
      if (search.trim()) params.append("search", search.trim());
      if (jobTitleFilter && jobTitleFilter !== "__all__") {
        params.append("jobTitle", jobTitleFilter);
      }
      // Note: system_role filter is applied client-side for now

      const [membersResponse, projectsResponse, tasksResponse] =
        await Promise.all([
          fetch(`/api/members?${params.toString()}`, { next: { revalidate: 30 } }),
          fetch("/api/projects", { next: { revalidate: 30 } }),
          fetch("/api/tasks", { next: { revalidate: 30 } }),
        ]);

      const [membersData, projectsData, tasksData] = await Promise.all([
        membersResponse.json().catch(() => []),
        projectsResponse.json().catch(() => []),
        tasksResponse.json().catch(() => []),
      ]);

      if (!membersResponse.ok) {
        setError(membersData?.error || "Failed to load team members");
        setMembers([]);
        setProjects([]);
        setTasks([]);
        return;
      }

      setMembers(Array.isArray(membersData) ? membersData : []);
      setProjects(Array.isArray(projectsData) ? projectsData : []);
      setTasks(Array.isArray(tasksData) ? tasksData : []);
    } catch {
      setError("Failed to load team members");
      setMembers([]);
      setProjects([]);
      setTasks([]);
    } finally {
      setLoading(false);
    }
  }, [search, jobTitleFilter]);

  useEffect(() => {
    if (!userLoading) {
      void fetchMembers();
    }
  }, [userLoading, fetchMembers]);

  useEffect(() => {
    setDraftJobTitles(
      members.reduce<Record<string, string>>((acc, member) => {
        acc[member.id] = member.role;
        return acc;
      }, {}),
    );

    setDraftSystemRoles(
      members.reduce<Record<string, string>>((acc, member) => {
        acc[member.id] = member.system_role;
        return acc;
      }, {}),
    );

    setDraftNames(
      members.reduce<Record<string, string>>((acc, member) => {
        acc[member.id] = member.name;
        return acc;
      }, {}),
    );
  }, [members]);

  const handleCreateMember = async () => {
    // Clear previous errors
    setModalError("")

    // Validation
    if (!newName.trim()) {
      setModalError("Full name is required")
      return
    }

    if (!newJobTitle.trim()) {
      setModalError("Job title is required")
      return
    }

    // Transform to title case
    const toTitleCase = (str: string) =>
      str.replace(/\w\S*/g, (txt) =>
        txt.charAt(0).toUpperCase() + txt.slice(1).toLowerCase()
      )

    const titleCaseName = toTitleCase(newName.trim())
    const titleCaseJobTitle = toTitleCase(newJobTitle.trim())

    if (createLoginAccount) {
      if (!newEmail.trim()) {
        setModalError("Email is required when creating a login account")
        return
      }
      if (newPassword.length < 8) {
        setModalError("Password must be at least 8 characters")
        return
      }
      if (newPassword !== newPasswordConfirm) {
        setModalError("Passwords do not match")
        return
      }
    }

    setSaving(true)
    setModalError("")
    try {
      // Validation
      if (!newName.trim()) {
        setModalError("Full name is required")
        setSaving(false)
        return
      }
      if (!newJobTitle.trim()) {
        setModalError("Job title is required")
        setSaving(false)
        return
      }
      if (createLoginAccount) {
        if (!newEmail.trim()) {
          setModalError("Email is required when creating login account")
          setSaving(false)
          return
        }
        if (!newPassword) {
          setModalError("Password is required")
          setSaving(false)
          return
        }
      }

      const endpoint = createLoginAccount ? "/api/admin/users" : "/api/members"
      const payload = createLoginAccount
        ? {
            name: titleCaseName,
            email: newEmail.trim(),
            password: newPassword,
            system_role: newSystemRole,
            job_title: titleCaseJobTitle,
            avatar_url: newAvatarUrl.trim() || null,
          }
        : {
            name: titleCaseName,
            email: newEmail.trim() || null,
            role: titleCaseJobTitle,
          }

      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })
      const data = await response.json()
      if (!response.ok) {
        setModalError(data?.error || "Failed to create member")
        return
      }

      await fetchMembers()
      setShowCreate(false)
      resetCreateForm()
    } catch {
      setModalError("Failed to create member")
    } finally {
      setSaving(false)
    }
  }

const updateMemberQuickEdits = async (
    member: Member,
    name: string,
    role: string,
    system_role: string,
  ) => {
    const trimmedName = name.trim();
    if (!trimmedName) {
      setError("Member name cannot be empty");
      return;
    }

    const toTitleCase = (str: string) =>
      str.replace(/\w\S*/g, (txt) =>
        txt.charAt(0).toUpperCase() + txt.slice(1).toLowerCase()
      );

    const titleCaseRole = toTitleCase(role);

    const hasChanges = 
      trimmedName !== member.name ||
      titleCaseRole !== member.role ||
      (system_role || "") !== (member.system_role || "");

    if (!hasChanges) {
      setEditingMemberId(null);
      return;
    }

    const previous = members;
    setMembers((prev) =>
      prev.map((item) =>
        item.id === member.id
          ? { ...item, name: trimmedName, role: titleCaseRole, system_role }
          : item,
      ),
    );
    const response = await fetch(`/api/members/${member.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: trimmedName,
        role: titleCaseRole,
        ...(system_role && { system_role }),
      }),
    });

    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      setError(data?.error || "Failed to update member role");
      setMembers(previous);
    }
    setSavingMemberId(null);
    setEditingMemberId(null);
    setDraftNames((prev) => {
      const next = { ...prev };
      delete next[member.id];
      return next;
    });
    setDraftJobTitles((prev) => {
      const next = { ...prev };
      delete next[member.id];
      return next;
    });
    setDraftSystemRoles((prev) => {
      const next = { ...prev };
      delete next[member.id];
      return next;
    });
  };

  const startImpersonation = async (member: Member) => {
    if (!isAdmin) return;
    if (!member.user_id) {
      setError(
        "This member does not have a login account yet. Create a login account first.",
      );
      return;
    }

    setError(null);
    setImpersonatingMemberId(member.id);

    try {
      const response = await fetch("/api/admin/impersonation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          role: member.role,
          memberName: member.name,
          memberId: member.id,
        }),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        setError(data?.error || "Failed to start impersonation");
        return;
      }

      window.location.reload();
    } catch {
      setError("Failed to start impersonation");
    } finally {
      setImpersonatingMemberId(null);
    }
  };

  const stopImpersonation = async () => {
    setError(null);
    try {
      await clearImpersonation();
      window.location.reload();
    } catch {
      setError("Failed to stop impersonation");
    }
  };

  const toggleSort = (key: TeamSortKey) => {
    if (sortKey === key) {
      setSortDirection((prev) => (prev === "asc" ? "desc" : "asc"));
      return;
    }
    setSortKey(key);
    setSortDirection("asc");
  };

  const getSortIcon = (key: TeamSortKey) => {
    if (sortKey !== key)
      return <ArrowUpDown className="h-3.5 w-3.5 opacity-50" />;
    return sortDirection === "asc" ? (
      <ArrowUp className="h-3.5 w-3.5" />
    ) : (
      <ArrowDown className="h-3.5 w-3.5" />
    );
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-start justify-between gap-3 sm:items-center sm:gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">
            Team
          </h1>
          <p className="text-muted-foreground text-sm sm:text-base">
            Manage users, roles, and impersonation controls.
          </p>
        </div>
        {canEdit && (
          <Button
            className="w-fit shrink-0"
            onClick={() => setShowCreate(true)}
          >
            <UserPlus className="mr-2 h-4 w-4" />
            Add Member
          </Button>
        )}
      </div>

      {canEdit && (
          <Dialog
            open={showCreate}
            onOpenChange={(open) => {
              setShowCreate(open)
              if (open) {
                setModalError("")
              } else {
                resetCreateForm()
              }
            }}
          >
          <DialogContent className="max-h-[90vh] overflow-hidden p-0 sm:max-w-xl">
            <DialogHeader className="px-6 pb-2 pt-6">
              <DialogTitle>Create team member</DialogTitle>
              <DialogDescription>
                Add a member quickly. Use optional fields for richer profile
                setup.
              </DialogDescription>
            </DialogHeader>

            {/* Error alert - sticky outside scroll area */}
            {modalError && (
              <div className="mx-6 mb-4 flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
                <AlertCircle className="h-4 w-4" />
                <span>{modalError}</span>
              </div>
            )}

            <div className="max-h-[calc(90vh-10rem)] overflow-y-auto px-6 py-2 pb-6">
              <div className="grid gap-3 sm:grid-cols-2">
                {/* Full name - required */}
                  <div className="space-y-1.5 sm:col-span-2">
                    <Label htmlFor="member-name">
                      Full name <span className="text-destructive">*</span>
                    </Label>
                    <Input
                      id="member-name"
                      value={newName}
                      onChange={(e) => setNewName(e.target.value)}
                      placeholder="Jane Doe"
                      required
                      aria-required="true"
                      className="capitalize"
                    />
                  </div>

                {/* Email */}
                <div className="space-y-1.5">
                  <Label htmlFor="member-email">
                    Email {createLoginAccount ? "(required)" : "(optional)"}
                  </Label>
                  <Input
                    id="member-email"
                    type="email"
                    value={newEmail}
                    onChange={(e) => setNewEmail(e.target.value)}
                    placeholder="jane@example.com"
                    required={createLoginAccount}
                    aria-required={createLoginAccount}
                  />
                </div>

                {/* Job Title */}
                <div className="space-y-1.5">
                  <Label htmlFor="member-job-title">
                    Job Title <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="member-job-title"
                    value={newJobTitle}
                    onChange={(e) => setNewJobTitle(e.target.value)}
                    placeholder="e.g. Designer"
                    list="new-job-title-suggestions"
                    className="capitalize"
                    required
                  />
                  <datalist id="new-job-title-suggestions">
                    {JOB_TITLE_OPTIONS.map((title) => (
                      <option
                        key={title}
                        value={title.charAt(0).toUpperCase() + title.slice(1)}
                      />
                    ))}
                  </datalist>
                </div>

                {/* Permission - only when creating login account */}
                {createLoginAccount && (
                  <div className="space-y-1.5">
                    <Label htmlFor="member-system-role">Permission</Label>
                    <Select
                      value={newSystemRole}
                      onValueChange={setNewSystemRole}
                    >
                      <SelectTrigger id="member-system-role">
                        <SelectValue placeholder="Select permission" />
                      </SelectTrigger>
                      <SelectContent>
                        {PERMISSION_OPTIONS.map((role) => (
                          <SelectItem key={role} value={role} className="capitalize">
                            {role}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                {/* Create login account checkbox */}
                <div className="space-y-1.5 sm:col-span-2">
                  <div className="flex items-center gap-2">
                    <Checkbox
                      id="member-create-login"
                      checked={createLoginAccount}
                      onCheckedChange={(checked) => {
                        setCreateLoginAccount(checked === true)
                        if (!checked) {
                          // Clear password fields when unchecking
                          setNewPassword("")
                          setNewPasswordConfirm("")
                        }
                      }}
                    />
                    <Label
                      htmlFor="member-create-login"
                      className="text-sm font-normal"
                    >
                      Create login account (email auto-confirmed)
                    </Label>
                  </div>
                </div>

                {/* Password - only when creating login account */}
                {createLoginAccount && (
                  <div className="space-y-1.5 sm:col-span-2">
                    <Label htmlFor="member-password">
                      Password <span className="text-destructive">*</span>
                    </Label>
                    <div className="relative">
                      <Input
                        id="member-password"
                        type={showNewPassword ? "text" : "password"}
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        placeholder="Min. 8 characters"
                        className="pr-10"
                        required
                        minLength={8}
                        aria-required="true"
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="absolute right-1 top-1/2 h-8 w-8 -translate-y-1/2"
                        onClick={() => setShowNewPassword(!showNewPassword)}
                        aria-label={showNewPassword ? "Hide password" : "Show password"}
                      >
                        {showNewPassword ? (
                          <EyeOff className="h-4 w-4" />
                        ) : (
                          <Eye className="h-4 w-4" />
                        )}
                      </Button>
                    </div>
                  </div>
                )}

                {/* Confirm Password - only when creating login account */}
                {createLoginAccount && (
                  <div className="space-y-1.5 sm:col-span-2">
                    <Label htmlFor="member-password-confirm">
                      Confirm password <span className="text-destructive">*</span>
                    </Label>
                    <div className="relative">
                      <Input
                        id="member-password-confirm"
                        type={showNewPasswordConfirm ? "text" : "password"}
                        value={newPasswordConfirm}
                        onChange={(e) => setNewPasswordConfirm(e.target.value)}
                        placeholder="Re-enter password"
                        className="pr-10"
                        required
                        aria-required="true"
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="absolute right-1 top-1/2 h-8 w-8 -translate-y-1/2"
                        onClick={() => setShowNewPasswordConfirm(!showNewPasswordConfirm)}
                        aria-label={
                          showNewPasswordConfirm
                            ? "Hide confirm password"
                            : "Show confirm password"
                        }
                      >
                        {showNewPasswordConfirm ? (
                          <EyeOff className="h-4 w-4" />
                        ) : (
                          <Eye className="h-4 w-4" />
                        )}
                      </Button>
                    </div>
                  </div>
                )}

                {/* Optional profile picture section - only for login accounts */}
                {createLoginAccount && (
                  <div className="col-span-2">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-8 px-2 text-xs"
                      onClick={() => setShowOptionalFields(!showOptionalFields)}
                    >
                      {showOptionalFields
                        ? "Hide profile picture"
                        : "Set profile picture"}
                    </Button>

                    {showOptionalFields && (
                      <div className="mt-3 rounded-lg border border-border/70 bg-muted/20 p-3">
                        <div className="space-y-3">
                          <div className="flex items-center justify-between">
                            <Label className="text-sm">Profile picture</Label>
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              className="h-8 px-2 text-xs"
                              onClick={() => setAvatarVariant((v) => v + 1)}
                            >
                              Refresh options
                            </Button>
                          </div>

                          <div className="flex items-center gap-2">
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              className="h-8 px-2 text-xs"
                              onClick={() => setNewAvatarUrl("initials")}
                            >
                              Use initials
                            </Button>
                            {newAvatarUrl && (
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                className="h-8 px-2 text-xs"
                                onClick={() => setNewAvatarUrl("")}
                              >
                                Clear
                              </Button>
                            )}
                          </div>

                          <div className="rounded-lg border border-border/60 bg-background/70 p-2">
                            <div className="flex gap-2 overflow-x-auto pb-1">
                              {avatarOptions.map((option, index) => {
                                const isSelected = newAvatarUrl === option;
                                return (
                                  <button
                                    key={option}
                                    type="button"
                                    className={cn(
                                      "shrink-0 rounded-lg border p-1 transition-all",
                                      "focus:outline-none focus:ring-2 focus:ring-primary/40",
                                      isSelected
                                        ? "border-primary bg-primary/10 shadow-sm"
                                        : "border-border/70 hover:border-primary/40 hover:bg-accent/40",
                                    )}
                                    onClick={() => setNewAvatarUrl(option)}
                                    title={`Select avatar ${index + 1}`}
                                  >
                                    <div
                                      className="h-12 w-12 rounded-md bg-cover bg-center"
                                      style={{ backgroundImage: `url(${option})` }}
                                      aria-label={`Avatar option ${index + 1}`}
                                    />
                                  </button>
                                );
                              })}
                            </div>
                          </div>

                          <p className="text-xs text-muted-foreground">
                            Current:{" "}
                            {newAvatarUrl === "initials"
                              ? getNameInitials(newName, newEmail)
                              : newAvatarUrl
                                ? "Custom avatar selected"
                                : "No selection"}
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            <DialogFooter className="sticky bottom-0 z-10 border-t border-border/60 bg-background/95 px-6 pb-6 pt-3 backdrop-blur supports-[backdrop-filter]:bg-background/80">
              <Button
                variant="outline"
                onClick={() => {
                  setShowCreate(false)
                  resetCreateForm()
                }}
              >
                Cancel
              </Button>
              <Button
                onClick={handleCreateMember}
                disabled={saving || !newName.trim()}
              >
                <Plus className="mr-2 h-4 w-4" />
                {saving
                  ? "Saving..."
                  : createLoginAccount
                    ? "Create User"
                    : "Create Member"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {error && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
          {error}
        </div>
      )}

      {impersonation && (
        <div className="rounded-lg border border-amber-400/30 bg-amber-500/10 p-3 text-sm text-amber-700 dark:text-amber-300">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p>
              Impersonating{" "}
              <span className="font-medium">
                {impersonation.memberName || "user"}
              </span>{" "}
              as{" "}
              <span className="font-medium capitalize">
                {impersonation.role}
              </span>
              .
            </p>
            <Button
              variant="outline"
              size="sm"
              className="h-8"
              onClick={stopImpersonation}
            >
              Stop impersonating
            </Button>
          </div>
        </div>
      )}

      {loading ? (
        <Card>
          <CardContent className="p-6 text-sm text-muted-foreground">
            Loading team members...
          </CardContent>
        </Card>
      ) : dedupedMembers.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center gap-2 py-10 text-muted-foreground">
            <Users className="h-10 w-10" />
            <p>No team members yet.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          <div className="grid grid-cols-4 gap-1.5 sm:grid-cols-2 sm:gap-2 md:grid-cols-4 md:gap-3">
            <Card className="border-border/70 bg-card/80 shadow-sm">
              <CardContent className="flex justify-center p-2 sm:block sm:p-3 md:p-3.5">
                <div className="text-center sm:text-left">
                  <p className="text-[9px] uppercase tracking-wide text-muted-foreground sm:text-[11px]">
                    Total
                  </p>
                  <div className="mt-1 inline-flex items-center gap-1.5 sm:gap-2">
                    <p className="text-base font-semibold leading-none sm:text-xl md:text-2xl">
                      {roleStats.total}
                    </p>
                    <div className="rounded-full bg-primary/10 p-1 text-primary sm:p-1.5">
                      <Users className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border-border/70 bg-card/80 shadow-sm">
              <CardContent className="flex justify-center p-2 sm:block sm:p-3 md:p-3.5">
                <div className="text-center sm:text-left">
                  <p className="text-[9px] uppercase tracking-wide text-muted-foreground sm:text-[11px]">
                    Admins
                  </p>
                  <div className="mt-1 inline-flex items-center gap-1.5 sm:gap-2">
                    <p className="text-base font-semibold leading-none sm:text-xl md:text-2xl">
                      {roleStats.admin}
                    </p>
                    <div className="rounded-full bg-amber-500/10 p-1 text-amber-600 dark:text-amber-400 sm:p-1.5">
                      <Shield className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border-border/70 bg-card/80 shadow-sm">
              <CardContent className="flex justify-center p-2 sm:block sm:p-3 md:p-3.5">
                <div className="text-center sm:text-left">
                  <p className="text-[9px] uppercase tracking-wide text-muted-foreground sm:text-[11px]">
                    Members
                  </p>
                  <div className="mt-1 inline-flex items-center gap-1.5 sm:gap-2">
                    <p className="text-base font-semibold leading-none sm:text-xl md:text-2xl">
                      {roleStats.member}
                    </p>
                    <div className="rounded-full bg-emerald-500/10 p-1 text-emerald-600 dark:text-emerald-400 sm:p-1.5">
                      <Users className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border-border/70 bg-card/80 shadow-sm">
              <CardContent className="flex justify-center p-2 sm:block sm:p-3 md:p-3.5">
                <div className="text-center sm:text-left">
                  <p className="text-[9px] uppercase tracking-wide text-muted-foreground sm:text-[11px]">
                    Viewers
                  </p>
                  <div className="mt-1 inline-flex items-center gap-1.5 sm:gap-2">
                    <p className="text-base font-semibold leading-none sm:text-xl md:text-2xl">
                      {roleStats.viewer}
                    </p>
                    <div className="rounded-full bg-zinc-500/10 p-1 text-zinc-600 dark:text-zinc-400 sm:p-1.5">
                      <Eye className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

{(() => {
            const standardRoles = new Set(JOB_TITLE_OPTIONS);
            const extraRoles = dedupedMembers.reduce<Record<string, number>>(
              (acc, member) => {
                if (standardRoles.has(member.role.toLowerCase())) return acc;
                const roleKey = member.role || "Unassigned";
                acc[roleKey] = (acc[roleKey] || 0) + 1;
                return acc;
              },
              {},
            );

            const extraEntries = Object.entries(extraRoles);
            if (extraEntries.length === 0) return null;

            return (
              <div className="rounded-lg border border-border/70 bg-card/80 p-2 shadow-sm sm:p-3 md:p-3.5">
                <p className="mb-2 text-[10px] uppercase tracking-wide text-muted-foreground sm:text-[11px]">
                  Custom job titles
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {extraEntries.map(([role, count]) => (
                    <Badge
                      key={role}
                      variant="outline"
                      className="text-[11px] capitalize"
                    >
                      {role}: {count}
                    </Badge>
                  ))}
                </div>
              </div>
            );
          })()}

          <Card className="glass">
            <CardHeader className="flex flex-col gap-2 border-b border-border/60 py-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <CardTitle className="text-base">Team Directory</CardTitle>
                <p className="text-xs text-muted-foreground">
                  Browse team members quickly and sort by role, projects, or
                  task load.
                </p>
              </div>
              <div className="hidden items-center gap-1 rounded-md border p-0.5 md:flex">
                <Button
                  variant={teamView === "list" ? "default" : "ghost"}
                  size="sm"
                  className={cn(
                    "h-8 gap-1.5 px-2.5 text-xs",
                    teamView === "list" &&
                      "bg-primary text-primary-foreground hover:bg-primary/90",
                  )}
                  onClick={() => setTeamView("list")}
                >
                  <List className="h-4 w-4" />
                  <span>List</span>
                </Button>
                <Button
                  variant={teamView === "card" ? "default" : "ghost"}
                  size="sm"
                  className={cn(
                    "h-8 gap-1.5 px-2.5 text-xs",
                    teamView === "card" &&
                      "bg-primary text-primary-foreground hover:bg-primary/90",
                  )}
                  onClick={() => setTeamView("card")}
                >
                  <LayoutGrid className="h-4 w-4" />
                  <span>Card</span>
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
               <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                 <div className="relative flex-1">
                   <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                   <input
                     value={search}
                     onChange={(event) => setSearch(event.target.value)}
                     placeholder="Search name, email, or role"
                     className="h-9 w-full rounded-md border border-input bg-background pl-9 pr-3 text-sm"
                   />
                 </div>
                 <select
                   value={roleFilter}
                   onChange={(event) => setRoleFilter(event.target.value)}
                   className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm sm:w-40"
                 >
                   <option value="__all__">All roles</option>
                   {PERMISSION_OPTIONS.map((role) => (
                     <option key={role} value={role}>
                       {role.charAt(0).toUpperCase() + role.slice(1)}
                     </option>
                   ))}
                 </select>
                 <select
                   value={jobTitleFilter}
                   onChange={(event) => setJobTitleFilter(event.target.value)}
                   className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm sm:w-40"
                 >
                   <option value="__all__">All job titles</option>
                   {uniqueJobTitles.map((title) => (
                     <option key={title} value={title.toLowerCase()}>
                       {title}
                     </option>
                   ))}
                 </select>
               </div>

              {sortedMembers.length === 0 ? (
                <div className="rounded-lg border border-border/60 p-6 text-center text-sm text-muted-foreground">
                  No matching team members.
                </div>
              ) : (
                <>
                  <div className="space-y-2 md:hidden">
                    {visibleCardMembers.map((member) => {
                      const projectCount =
                        projectCountByMember.get(member.id) || 0;
                      const taskCount = taskCountByMember.get(member.id) || 0;
                      return (
                        <button
                          key={member.id}
                          type="button"
                          onClick={() => setPreviewMember(member)}
                          className="w-full rounded-lg border border-border/70 bg-background/60 p-3 text-left transition-colors hover:bg-accent/30"
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex min-w-0 items-center gap-2">
                              <MemberAvatar
                                name={member.name}
                                email={member.email}
                                userId={member.user_id || null}
                                avatarUrl={member.avatar_url || null}
                                sizeClass="h-8 w-8"
                                textClass="text-[11px]"
                              />
                              <div className="min-w-0">
                                <p className="truncate text-sm font-medium">
                                  {member.name}
                                </p>
                                <p className="truncate text-xs text-muted-foreground">
                                  {member.email || "No email"}
                                </p>
                              </div>
                            </div>
                            <div className="flex flex-col items-end gap-1">
                              <Badge
                                variant="outline"
                                className="text-[10px] capitalize font-medium"
                              >
                                {member.role}
                              </Badge>
                              {member.system_role ? (
                                <Badge
                                  variant="secondary"
                                  className="text-[9px] h-4 px-1 opacity-70"
                                >
                                  {member.system_role}
                                </Badge>
                              ) : (
                                <span className="text-[9px] text-muted-foreground italic">
                                  No access
                                </span>
                              )}
                            </div>
                          </div>
                          <div className="mt-2 flex flex-wrap items-center gap-1.5 text-[11px]">
                            <Badge variant="secondary" className="text-[10px]">
                              {projectCount} projects
                            </Badge>
                            <Badge variant="secondary" className="text-[10px]">
                              {taskCount} tasks
                            </Badge>
                          </div>
                        </button>
                      );
                    })}
                    {sortedMembers.length > cardVisibleCount && (
                      <Button
                        type="button"
                        variant="outline"
                        className="w-full"
                        onClick={() =>
                          setCardVisibleCount((count) => count + 10)
                        }
                      >
                        Show more
                      </Button>
                    )}
                  </div>

                  {teamView === "card" ? (
                    <div className="hidden gap-3 md:grid md:grid-cols-2 xl:grid-cols-3">
                      {visibleCardMembers.map((member) => {
                        const projectCount =
                          projectCountByMember.get(member.id) || 0;
                        const taskCount = taskCountByMember.get(member.id) || 0;
                        return (
                          <div
                            key={member.id}
                            className="rounded-lg border border-border/70 bg-background/60 p-3"
                          >
                            <button
                              type="button"
                              className="flex w-full items-center gap-2 text-left"
                              onClick={() => setPreviewMember(member)}
                            >
                              <MemberAvatar
                                name={member.name}
                                email={member.email}
                                userId={member.user_id || null}
                                avatarUrl={member.avatar_url || null}
                                sizeClass="h-9 w-9"
                                textClass="text-[11px]"
                              />
                              <div className="min-w-0">
                                <p className="truncate text-sm font-medium">
                                  {member.name}
                                </p>
                                <p className="truncate text-xs text-muted-foreground">
                                  {member.email || "No email"}
                                </p>
                              </div>
                            </button>
                            <div className="mt-2 flex items-center justify-between">
                              <Badge
                                variant="outline"
                                className="text-[11px] capitalize"
                              >
                                {member.role}
                              </Badge>
                              <span className="text-xs text-muted-foreground">
                                {projectCount} projects • {taskCount} tasks
                              </span>
                            </div>
                          </div>
                        );
                      })}
                      {sortedMembers.length > cardVisibleCount && (
                        <div className="md:col-span-2 xl:col-span-3">
                          <Button
                            type="button"
                            variant="outline"
                            className="w-full"
                            onClick={() =>
                              setCardVisibleCount((count) => count + 10)
                            }
                          >
                            Show more
                          </Button>
                        </div>
                      )}
                    </div>
                  ) : (
                    <Table className="hidden md:table">
                      <TableHeader>
                        <TableRow>
                          <TableHead className="h-9">
                            <button
                              type="button"
                              className="inline-flex items-center gap-1 transition-colors hover:text-foreground"
                              onClick={() => toggleSort("member")}
                            >
                              Member {getSortIcon("member")}
                            </button>
                          </TableHead>
                          <TableHead className="hidden h-9 lg:table-cell">
                            <button
                              type="button"
                              className="inline-flex items-center gap-1 transition-colors hover:text-foreground"
                              onClick={() => toggleSort("email")}
                            >
                              Email {getSortIcon("email")}
                            </button>
                          </TableHead>
                          <TableHead className="h-9">
                            <button
                              type="button"
                              className="inline-flex items-center gap-1 transition-colors hover:text-foreground"
                              onClick={() => toggleSort("role")}
                            >
                              Role {getSortIcon("role")}
                            </button>
                          </TableHead>
                          <TableHead className="h-9 text-right">
                            <button
                              type="button"
                              className="ml-auto inline-flex items-center gap-1 transition-colors hover:text-foreground"
                              onClick={() => toggleSort("projects")}
                            >
                              Projects {getSortIcon("projects")}
                            </button>
                          </TableHead>
                          <TableHead className="h-9 text-right">
                            <button
                              type="button"
                              className="ml-auto inline-flex items-center gap-1 transition-colors hover:text-foreground"
                              onClick={() => toggleSort("tasks")}
                            >
                              Tasks {getSortIcon("tasks")}
                            </button>
                          </TableHead>
                          <TableHead className="h-9 text-right">
                            Actions
                          </TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {pagedListMembers.map((member) => {
                          const draftJobTitle =
                            draftJobTitles[member.id] !== undefined 
                              ? draftJobTitles[member.id] 
                              : member.role;
                          const draftSystemRole =
                            draftSystemRoles[member.id] !== undefined 
                              ? draftSystemRoles[member.id] 
                              : member.system_role ?? "";
                          const draftName =
                            draftNames[member.id] !== undefined 
                              ? draftNames[member.id] 
                              : member.name;
                          const jobTitleChanged = draftJobTitle !== member.role;
                          const systemRoleChanged =
                            draftSystemRole !== member.system_role;
                          const nameChanged = draftName.trim() !== member.name;
                          const isRowEditing = editingMemberId === member.id;
                          const isImpersonatingThisMember =
                            impersonation?.memberId === member.id;
                          const projectCount =
                            projectCountByMember.get(member.id) || 0;
                          const taskCount =
                            taskCountByMember.get(member.id) || 0;

                          return (
                            <TableRow
                              key={member.id}
                              className={cn(
                                "cursor-pointer",
                                isRowEditing && "cursor-default",
                              )}
                              onClick={() => {
                                if (!isRowEditing) {
                                  router.push(`/team/${member.id}`);
                                }
                              }}
                            >
                              <TableCell className="py-2">
                                <div className="flex items-center gap-2 min-h-[66px]">
                                  <MemberAvatar
                                    name={member.name}
                                    email={member.email}
                                    userId={member.user_id || null}
                                    avatarUrl={member.avatar_url || null}
                                    sizeClass="h-8 w-8"
                                    textClass="text-[11px]"
                                  />
                                  <div className="min-w-0 flex items-center h-8">
                                    {isRowEditing ? (
                                        <Input
                                          value={draftName}
                                          onChange={(event) =>
                                            setDraftNames((prev) => ({
                                              ...prev,
                                              [member.id]: event.target.value,
                                            }))
                                          }
                                          onClick={(event) =>
                                            event.stopPropagation()
                                          }
                                          className="h-8 w-[160px] min-w-[160px] text-xs px-2 shrink-0"
                                        />
                                      ) : (
                                        <p className="truncate text-sm font-medium min-w-[120px]">
                                          {member.name}
                                        </p>
                                      )}
                                  </div>
                                </div>
                              </TableCell>
                              <TableCell className="hidden py-2 text-sm text-muted-foreground lg:table-cell">
                                <span className="inline-flex items-center gap-1">
                                  <Mail className="h-3 w-3" />
                                  {member.email || "No email"}
                                </span>
                              </TableCell>
                              <TableCell className="py-2">
                                <div className="flex min-h-[66px] flex-col justify-center">
                                  {isRowEditing ? (
                                    <div
                                      className="flex flex-col gap-1.5"
                                      onClick={(e) => e.stopPropagation()}
                                    >
                                      <Input
                                        value={draftJobTitle}
                                        onChange={(e) =>
                                          setDraftJobTitles((prev) => ({
                                            ...prev,
                                            [member.id]: e.target.value,
                                          }))
                                        }
                                        onClick={(e) => e.stopPropagation()}
                                        className="h-5 text-[10px] w-[110px] min-w-[110px] px-1.5 shrink-0 capitalize"
                                        placeholder="Job Title"
                                      />
                                      <Select
                                        value={draftSystemRole}
                                        onValueChange={(val) =>
                                          setDraftSystemRoles((prev) => ({
                                            ...prev,
                                            [member.id]: val,
                                          }))
                                        }
                                        disabled={!member.user_id}
                                      >
                                        <SelectTrigger
                                          className="h-5 text-[10px] py-0 px-1.5 w-[110px] min-w-[110px] shrink-0"
                                          onClick={(e) => e.stopPropagation()}
                                          title={
                                            !member.user_id
                                              ? "This member doesn't have a login account yet"
                                              : undefined
                                          }
                                        >
                                          <SelectValue
                                            placeholder={
                                              !member.user_id
                                                ? "No login"
                                                : "Permission"
                                            }
                                          />
                                        </SelectTrigger>
                                        <SelectContent>
                                          {PERMISSION_OPTIONS.map((opt) => (
                                            <SelectItem
                                              key={opt}
                                              value={opt}
                                              className="text-[10px] capitalize"
                                            >
                                              {opt}
                                            </SelectItem>
                                          ))}
                                        </SelectContent>
                                      </Select>
                                    </div>
                                  ) : (
                                    <div className="flex flex-col gap-1 items-start">
                                      <Badge
                                        variant="outline"
                                        className="text-[10px] capitalize font-medium h-5 px-1.5"
                                      >
                                        {member.role}
                                      </Badge>
                                      {member.system_role ? (
                                        <Badge
                                          variant="secondary"
                                          className="text-[10px] capitalize font-medium h-5 px-1.5"
                                        >
                                          {member.system_role}
                                        </Badge>
                                      ) : (
                                        <Badge
                                          variant="destructive"
                                          className="text-[10px] h-5 px-1.5 font-normal opacity-60"
                                        >
                                          No access
                                        </Badge>
                                      )}
                                    </div>
                                  )}
                                </div>
                              </TableCell>
                              <TableCell className="py-2 text-right text-sm">
                                {projectCount}
                              </TableCell>
                              <TableCell className="py-2 text-right text-sm">
                                {taskCount}
                              </TableCell>
                              <TableCell className="py-2">
                                <div
                                  className="flex items-center justify-end gap-2"
                                  onClick={(event) => event.stopPropagation()}
                                >
                                  {isAdmin && (
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      className="h-8 px-2 text-xs"
                                      onClick={() => setPreviewMember(member)}
                                    >
                                      <Eye className="mr-1 h-3.5 w-3.5" />
                                      Preview
                                    </Button>
                                  )}
                                  {canEdit && (
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      className={cn(
                                        "h-8 px-2 text-xs w-[84px] shrink-0 gap-1",
                                        isRowEditing && "bg-primary hover:bg-primary/90 border-primary",
                                      )}
                                      style={isRowEditing ? { backgroundColor: accentColor, borderColor: accentColor } : undefined}
                                      onClick={() => {
                                        if (isRowEditing) {
                                          if (
                                            jobTitleChanged ||
                                            systemRoleChanged ||
                                            nameChanged
                                          ) {
                                            updateMemberQuickEdits(
                                              member,
                                              draftName,
                                              draftJobTitle,
                                              draftSystemRole,
                                            );
                                          }
                                          setEditingMemberId(null);
                                          setDraftNames((prev) => {
                                            const next = { ...prev };
                                            delete next[member.id];
                                            return next;
                                          });
                                          setDraftJobTitles((prev) => {
                                            const next = { ...prev };
                                            delete next[member.id];
                                            return next;
                                          });
                                          setDraftSystemRoles((prev) => {
                                            const next = { ...prev };
                                            delete next[member.id];
                                            return next;
                                          });
                                        } else {
                                          setDraftNames((prev) => ({
                                            ...prev,
                                            [member.id]: member.name,
                                          }));
                                          setDraftJobTitles((prev) => ({
                                            ...prev,
                                            [member.id]: member.role,
                                          }));
                                          setDraftSystemRoles((prev) => ({
                                            ...prev,
                                            [member.id]: member.system_role,
                                          }));
                                          setEditingMemberId(member.id);
                                        }
                                      }}
                                      disabled={savingMemberId === member.id}
                                    >
                                      {!isRowEditing ? (
                                        <>
                                          <Pencil className="mr-1 h-3.5 w-3.5" />
                                          Edit
                                        </>
                                      ) : savingMemberId === member.id ? (
                                        "Saving..."
                                      ) : (nameChanged || jobTitleChanged || (member.user_id && systemRoleChanged)) ? (
                                        <>
                                          <Pencil className="mr-1 h-3.5 w-3.5" />
                                          Save
                                        </>
                                      ) : (
                                        <>
                                          <XCircle className="mr-1 h-3.5 w-3.5" />
                                          Cancel
                                        </>
                                      )}
                                    </Button>
                                  )}
                                  {isAdmin && (
                                    <Button
                                      variant={
                                        isImpersonatingThisMember
                                          ? "secondary"
                                          : "outline"
                                      }
                                      size="sm"
                                      className="h-8 px-2 text-xs"
                                      disabled={
                                        impersonatingMemberId === member.id ||
                                        !member.user_id
                                      }
                                      onClick={() => startImpersonation(member)}
                                      title={
                                        !member.user_id
                                          ? "No login account linked"
                                          : "Impersonate this user"
                                      }
                                    >
                                      <Eye className="mr-1 h-3.5 w-3.5" />
                                      {impersonatingMemberId === member.id
                                        ? "Starting..."
                                        : "Impersonate"}
                                    </Button>
                                  )}
                                  {(canEdit || userId === member.user_id) && (
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      className="h-8 px-2 text-xs"
                                      onClick={() =>
                                        router.push(`/team/${member.id}`)
                                      }
                                    >
                                      Detail
                                    </Button>
                                  )}
                                </div>
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  )}

                  {teamView === "list" &&
                    sortedMembers.length > listPageSize && (
                      <div className="hidden items-center justify-between pt-2 text-sm md:flex">
                        <p className="text-muted-foreground">
                          Showing {(listPage - 1) * listPageSize + 1}-
                          {Math.min(
                            listPage * listPageSize,
                            sortedMembers.length,
                          )}{" "}
                          of {sortedMembers.length}
                        </p>
                        <div className="flex items-center gap-2">
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            disabled={listPage <= 1}
                            onClick={() =>
                              setListPage((page) => Math.max(1, page - 1))
                            }
                          >
                            Previous
                          </Button>
                          <span className="text-xs text-muted-foreground">
                            Page {listPage} of {listTotalPages}
                          </span>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            disabled={listPage >= listTotalPages}
                            onClick={() =>
                              setListPage((page) =>
                                Math.min(listTotalPages, page + 1),
                              )
                            }
                          >
                            Next
                          </Button>
                        </div>
                      </div>
                    )}
                </>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      <Dialog
        open={!!previewMember}
        onOpenChange={(open) => !open && setPreviewMember(null)}
      >
        <DialogContent className="sm:max-w-2xl">
          {previewMember && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <MemberAvatar
                    name={previewMember.name}
                    email={previewMember.email}
                    userId={previewMember.user_id || null}
                    avatarUrl={previewMember.avatar_url || null}
                    sizeClass="h-8 w-8"
                    textClass="text-[11px]"
                  />
                  <span>{previewMember.name}</span>
                </DialogTitle>
                <DialogDescription>
                  Quick member overview. Open full profile for deeper details
                  and admin edits.
                </DialogDescription>
              </DialogHeader>

              <div className="grid gap-3 py-2 sm:grid-cols-3">
                <Card>
                  <CardContent className="p-3">
                    <p className="text-xs text-muted-foreground">
                      Projects assigned
                    </p>
                    <p className="text-xl font-semibold">
                      {getProjectCountForMember(previewMember.id)}
                    </p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-3">
                    <p className="text-xs text-muted-foreground">
                      Tasks assigned
                    </p>
                    <p className="text-xl font-semibold">
                      {getTaskStatsForMember(previewMember.id).total}
                    </p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-3">
                    <p className="text-xs text-muted-foreground">Tasks done</p>
                    <p className="text-xl font-semibold">
                      {getTaskStatsForMember(previewMember.id).done}
                    </p>
                  </CardContent>
                </Card>
              </div>

              <div className="space-y-2 rounded-lg border border-border/70 bg-muted/20 p-3 text-sm">
                <p>
                  <span className="text-muted-foreground">Email:</span>{" "}
                  {previewMember.email || "No email"}
                </p>
                <p>
                  <span className="text-muted-foreground">Job Title:</span>{" "}
                  <span className="capitalize">{previewMember.role}</span>
                </p>
                <p>
                  <span className="text-muted-foreground">Permission:</span>{" "}
                  <span className="capitalize">
                    {previewMember.system_role}
                  </span>
                </p>
                <p>
                  <span className="text-muted-foreground">
                    In progress tasks:
                  </span>{" "}
                  {getTaskStatsForMember(previewMember.id).inProgress}
                </p>
              </div>

              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={() => setPreviewMember(null)}
                >
                  Close
                </Button>
                <Button
                  onClick={() => {
                    const id = previewMember.id;
                    if (typeof window !== "undefined") {
                      try {
                        window.sessionStorage.setItem(
                          `team-member-preview:${id}`,
                          JSON.stringify(previewMember),
                        );
                      } catch {
                        // no-op
                      }

                      window.location.assign(`/team/${id}`);
                    }
                    setPreviewMember(null);
                  }}
                >
                  View full profile
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
