"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Clock3, Eye, EyeOff, Pencil, Save, X } from "lucide-react";

import MemberAvatar from "@/components/member-avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
  DialogTrigger,
  DialogClose,
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
import { cn } from "@/lib/utils";
import { getAvatarPickerOptions, getNameInitials } from "@/lib/avatar";

type Member = {
  id: string;
  created_at?: string | null;
  user_id?: string | null;
  avatar_url?: string | null;
  name: string;
  email: string | null;
  role: string; // Job Title
  system_role: string | null; // Permissions (null for members without login account)
};

type Project = {
  id: string;
  name: string;
  status: string;
  project_members?: Array<{
    members?:
      | {
          id?: string;
        }
      | Array<{
          id?: string;
        }>
      | null;
  }>;
};

type Task = {
  id: string;
  title: string;
  project_id: string;
  assignee_member_id: string | null;
  status: "todo" | "in-progress" | "done";
  due_date: string | null;
};

type AuthActivityEvent = {
  id: string;
  event_type: string;
  created_at: string;
  email: string | null;
  country: string | null;
  city: string | null;
  user_agent: string | null;
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

type TeamMemberProfileClientProps = {
  initialMember: Member | null;
  initialProjects: Project[];
  initialTasks: Task[];
  initialAuthEvents: AuthActivityEvent[];
  initialHasLoggedIn: boolean;
  initialLastLoginAt: string | null;
  initialAuthActivityMissingTable: boolean;
  initialError: string | null;
  isAdmin: boolean;
};

export default function TeamMemberProfileClient({
  initialMember,
  initialProjects,
  initialTasks,
  initialAuthEvents,
  initialHasLoggedIn,
  initialLastLoginAt,
  initialAuthActivityMissingTable,
  initialError,
  isAdmin,
}: TeamMemberProfileClientProps) {
  const router = useRouter();

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(initialError);
  const [member, setMember] = useState<Member | null>(initialMember);
  const [projects] = useState<Project[]>(initialProjects);
  const [tasks] = useState<Task[]>(initialTasks);
  const [authEvents] = useState<AuthActivityEvent[]>(initialAuthEvents);
  const [hasLoggedIn] = useState(initialHasLoggedIn);
  const [lastLoginAt] = useState<string | null>(initialLastLoginAt);
  const [authActivityMissingTable] = useState(initialAuthActivityMissingTable);
  const [authHistoryOpen, setAuthHistoryOpen] = useState(false);

  const [isEditing, setIsEditing] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [showProfilePictureOptions, setShowProfilePictureOptions] =
    useState(false);
  const [avatarVariant, setAvatarVariant] = useState(0);

  const [editName, setEditName] = useState(initialMember?.name || "");
  const [editEmail, setEditEmail] = useState(initialMember?.email || "");
  const [editJobTitle, setEditJobTitle] = useState(initialMember?.role || "");
  const [editSystemRole, setEditSystemRole] = useState(
    initialMember?.system_role || "viewer",
  );
  const [editAvatarUrl, setEditAvatarUrl] = useState(
    initialMember?.avatar_url || "",
  );
  const [resetPassword, setResetPassword] = useState(false);
  const [editPassword, setEditPassword] = useState("");
  const [editPasswordConfirm, setEditPasswordConfirm] = useState("");
  const [createLoginAccount, setCreateLoginAccount] = useState(false);

  const assignedProjects = useMemo(() => {
    if (!member) return [];
    return projects.filter((project) =>
      (project.project_members || []).some((pm) => {
        if (Array.isArray(pm.members)) {
          return pm.members.some((nested) => nested?.id === member.id);
        }

        return pm.members?.id === member.id;
      }),
    );
  }, [member, projects]);

  const assignedTasks = useMemo(() => {
    if (!member) return [];
    return tasks.filter((task) => task.assignee_member_id === member.id);
  }, [member, tasks]);

  const avatarSeed =
    (editName || editEmail || member?.id || "projecthub-member").trim() ||
    "projecthub-member";
  const avatarOptions = useMemo(
    () => getAvatarPickerOptions(avatarSeed, avatarVariant),
    [avatarSeed, avatarVariant],
  );
  const requiresPassword =
    (member?.user_id && resetPassword) ||
    (!member?.user_id && createLoginAccount);

  const isProjectCompleted = (status: string) => {
    const normalized = status.toLowerCase();
    return (
      normalized.includes("done") ||
      normalized.includes("complete") ||
      normalized.includes("closed")
    );
  };

  const isTaskDone = (status: Task["status"]) => status === "done";
  const now = new Date();
  const activeProjects = assignedProjects.filter(
    (project) => !isProjectCompleted(project.status),
  );
  const completedProjects = assignedProjects.filter((project) =>
    isProjectCompleted(project.status),
  );
  const activeTasks = assignedTasks.filter((task) => !isTaskDone(task.status));
  const completedTasks = assignedTasks.filter((task) =>
    isTaskDone(task.status),
  );
  const overdueTasks = activeTasks.filter((task) => {
    if (!task.due_date) return false;
    const dueDate = new Date(task.due_date);
    return !Number.isNaN(dueDate.getTime()) && dueDate < now;
  });

  const createdAtLabel = member?.created_at
    ? new Date(member.created_at).toLocaleDateString()
    : "Unknown";
  const lastLoginLabel =
    hasLoggedIn && lastLoginAt
      ? new Date(lastLoginAt).toLocaleString()
      : hasLoggedIn
        ? "Has login activity"
        : "Never logged in";

  const resetEditState = () => {
    setIsEditing(false);
    setShowPassword(false);
    setShowConfirmPassword(false);
    setShowProfilePictureOptions(false);
    setAvatarVariant(0);
    setResetPassword(false);
    setCreateLoginAccount(false);
    setEditPassword("");
    setEditPasswordConfirm("");

    if (member) {
      setEditName(member.name);
      setEditEmail(member.email || "");
      setEditJobTitle(member.role || "");
      setEditSystemRole(member.system_role || "viewer");
      setEditAvatarUrl(member.avatar_url || "");
    }
  };

  const saveProfile = async () => {
    if (!member || !isAdmin || !editName.trim()) return;

    const toTitleCase = (str: string) =>
      str.replace(/\w\S*/g, (txt) =>
        txt.charAt(0).toUpperCase() + txt.slice(1).toLowerCase()
      );

    const titleCaseJobTitle = toTitleCase(editJobTitle);

    const trimmedEmail = editEmail.trim();
    if (!member.user_id && createLoginAccount && !trimmedEmail) {
      setError("Email is required to create a login account");
      return;
    }

    if (
      (member.user_id && resetPassword) ||
      (!member.user_id && createLoginAccount)
    ) {
      if (editPassword.length < 8) {
        setError("Password must be at least 8 characters");
        return;
      }
      if (editPassword !== editPasswordConfirm) {
        setError("Password and confirm password must match");
        return;
      }
    }

    setSaving(true);
    setError(null);

    try {
      if (!member.user_id && createLoginAccount) {
        const createRes = await fetch("/api/admin/users", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: editName.trim(),
            email: trimmedEmail,
            password: editPassword,
            system_role: editSystemRole,
            job_title: titleCaseJobTitle,
            avatar_url: editAvatarUrl || null,
          }),
        });

        const createData = await createRes.json().catch(() => null);
        if (!createRes.ok) {
          throw new Error(
            createData?.error || "Failed to create login account",
          );
        }
      } else {
        const response = await fetch(`/api/members/${member.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: editName.trim(),
            email: trimmedEmail || null,
            ...(editJobTitle.trim() ? { role: titleCaseJobTitle } : {}),
            ...(member.user_id ? { system_role: editSystemRole } : {}),
            ...(editAvatarUrl ? { avatar_url: editAvatarUrl } : {}),
            ...(member.user_id && resetPassword
              ? { password: editPassword }
              : {}),
          }),
        });
        const data = await response.json().catch(() => null);
        if (!response.ok || !data) {
          throw new Error(data?.error || "Failed to save member profile");
        }
      }

      const refreshed = await fetch(`/api/members/${member.id}`, {
        cache: "no-store",
      });
      const refreshedData = await refreshed.json().catch(() => null);
      if (!refreshed.ok || !refreshedData) {
        throw new Error(
          refreshedData?.error || "Profile updated but failed to refresh",
        );
      }

      setMember(refreshedData);
      setEditName(refreshedData.name);
      setEditEmail(refreshedData.email || "");
      setEditJobTitle(refreshedData.role);
      setEditSystemRole(refreshedData.system_role);
      setEditAvatarUrl(refreshedData.avatar_url || "");
      resetEditState();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to save member profile",
      );
    } finally {
      setSaving(false);
    }
  };

  if (!member) {
    return (
      <Card>
        <CardContent className="py-10 text-center text-muted-foreground">
          {error || "Member not found"}
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Button variant="outline" onClick={() => router.push("/team")}>
          <ArrowLeft className="mr-2 h-4 w-4" /> Back to Team
        </Button>
        {isAdmin && (
          <div className="flex items-center gap-2">
            {isEditing && (
              <Button
                variant="outline"
                onClick={resetEditState}
                disabled={saving}
              >
                Cancel
              </Button>
            )}
            <Button
              onClick={() => {
                if (!isEditing) {
                  setIsEditing(true);
                  return;
                }
                void saveProfile();
              }}
              disabled={saving || (isEditing && !editName.trim())}
            >
              {isEditing ? (
                <>
                  <Save className="mr-2 h-4 w-4" />{" "}
                  {saving ? "Saving..." : "Save profile"}
                </>
              ) : (
                <>
                  <Pencil className="mr-2 h-4 w-4" /> Edit profile
                </>
              )}
            </Button>
          </div>
        )}
      </div>

      {error && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
          {error}
        </div>
      )}

      <Card className="glass">
        <CardHeader>
          <CardTitle className="text-base">Member Profile</CardTitle>
        </CardHeader>

        <CardContent className="space-y-4">
          {isEditing ? (
            <div className="space-y-4">
              <div className="grid gap-4 lg:grid-cols-2">
                <Card className="border-border/70 shadow-none">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm">Basic info</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="space-y-1.5">
                      <Label htmlFor="member-edit-name">Full name</Label>
                      <Input
                        id="member-edit-name"
                        value={editName}
                        onChange={(event) => setEditName(event.target.value)}
                      />
                    </div>

                    <div className="space-y-1.5">
                      <Label htmlFor="member-edit-email">Email</Label>
                      <Input
                        id="member-edit-email"
                        type="email"
                        value={editEmail}
                        onChange={(event) => setEditEmail(event.target.value)}
                        placeholder="member@example.com"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <Label htmlFor="member-edit-job-title">Job title</Label>
                      <Input
                        id="member-edit-job-title"
                        value={editJobTitle}
                        onChange={(event) =>
                          setEditJobTitle(event.target.value)
                        }
                        placeholder="e.g. Lead Developer"
                        list="job-title-suggestions"
                        className="capitalize"
                      />
                      <datalist id="job-title-suggestions">
                        {JOB_TITLE_OPTIONS.map((title) => (
                          <option
                            key={title}
                            value={
                              title.charAt(0).toUpperCase() + title.slice(1)
                            }
                          />
                        ))}
                      </datalist>
                    </div>

                    <div className="space-y-1.5">
                      <Label htmlFor="member-edit-system-role">
                        System permission
                      </Label>
                      <Select
                        value={editSystemRole}
                        onValueChange={setEditSystemRole}
                        disabled={!member.user_id && !createLoginAccount}
                      >
                        <SelectTrigger id="member-edit-system-role">
                          <SelectValue
                            placeholder={
                              !member.user_id && !createLoginAccount
                                ? "No login account"
                                : "Select permission"
                            }
                          />
                        </SelectTrigger>
                        <SelectContent>
                          {PERMISSION_OPTIONS.map((role) => (
                            <SelectItem
                              key={role}
                              value={role}
                              className="capitalize"
                            >
                              {role}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <p className="text-[10px] text-muted-foreground mt-1 px-1">
                        Determines what this user can do in the application.
                      </p>
                    </div>
                  </CardContent>
                </Card>

                <Card className="border-border/70 shadow-none">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm">Access & security</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant={member.user_id ? "secondary" : "outline"}>
                        {member.user_id
                          ? "Login account linked"
                          : "No login account"}
                      </Badge>
                    </div>

                    {!member.user_id && (
                      <div className="flex items-center gap-2 rounded-md border border-border/70 bg-muted/20 px-3 py-2">
                        <Checkbox
                          id="member-create-account"
                          checked={createLoginAccount}
                          onCheckedChange={(checked) =>
                            setCreateLoginAccount(checked === true)
                          }
                        />
                        <Label
                          htmlFor="member-create-account"
                          className="font-normal"
                        >
                          Create login account for this member
                        </Label>
                      </div>
                    )}

                    {member.user_id && (
                      <div className="flex items-center gap-2 rounded-md border border-border/70 bg-muted/20 px-3 py-2">
                        <Checkbox
                          id="member-reset-password"
                          checked={resetPassword}
                          onCheckedChange={(checked) =>
                            setResetPassword(checked === true)
                          }
                        />
                        <Label
                          htmlFor="member-reset-password"
                          className="font-normal"
                        >
                          Set new password
                        </Label>
                      </div>
                    )}

                    {requiresPassword && (
                      <>
                        <div className="space-y-1.5">
                          <Label htmlFor="member-edit-password">
                            Password (min 8 chars)
                          </Label>
                          <div className="relative">
                            <Input
                              id="member-edit-password"
                              type={showPassword ? "text" : "password"}
                              value={editPassword}
                              onChange={(event) =>
                                setEditPassword(event.target.value)
                              }
                              className="pr-10"
                            />
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="absolute right-1 top-1/2 h-8 w-8 -translate-y-1/2"
                              onClick={() => setShowPassword((value) => !value)}
                              aria-label={
                                showPassword ? "Hide password" : "Show password"
                              }
                            >
                              {showPassword ? (
                                <EyeOff className="h-4 w-4" />
                              ) : (
                                <Eye className="h-4 w-4" />
                              )}
                            </Button>
                          </div>
                        </div>

                        <div className="space-y-1.5">
                          <Label htmlFor="member-edit-password-confirm">
                            Confirm password
                          </Label>
                          <div className="relative">
                            <Input
                              id="member-edit-password-confirm"
                              type={showConfirmPassword ? "text" : "password"}
                              value={editPasswordConfirm}
                              onChange={(event) =>
                                setEditPasswordConfirm(event.target.value)
                              }
                              className="pr-10"
                            />
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="absolute right-1 top-1/2 h-8 w-8 -translate-y-1/2"
                              onClick={() =>
                                setShowConfirmPassword((value) => !value)
                              }
                              aria-label={
                                showConfirmPassword
                                  ? "Hide confirm password"
                                  : "Show confirm password"
                              }
                            >
                              {showConfirmPassword ? (
                                <EyeOff className="h-4 w-4" />
                              ) : (
                                <Eye className="h-4 w-4" />
                              )}
                            </Button>
                          </div>
                        </div>
                      </>
                    )}
                  </CardContent>
                </Card>
              </div>

              <Card className="border-border/70 shadow-none">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between gap-2">
                    <CardTitle className="text-sm">Profile picture</CardTitle>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-8 px-2 text-xs"
                      onClick={() =>
                        setShowProfilePictureOptions((value) => !value)
                      }
                    >
                      {showProfilePictureOptions
                        ? "Hide options"
                        : "Set profile picture"}
                    </Button>
                  </div>
                </CardHeader>

                {showProfilePictureOptions && (
                  <CardContent className="space-y-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-8 px-2 text-xs"
                        onClick={() => setAvatarVariant((v) => v + 1)}
                      >
                        Refresh options
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-8 px-2 text-xs"
                        onClick={() => setEditAvatarUrl("initials")}
                      >
                        Use initials
                      </Button>
                      {editAvatarUrl && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-8 px-2 text-xs"
                          onClick={() => setEditAvatarUrl("")}
                        >
                          Clear
                        </Button>
                      )}
                    </div>

                    <div className="rounded-lg border border-border/60 bg-background/70 p-2">
                      <div className="flex gap-2 overflow-x-auto pb-1">
                        {avatarOptions.map((option, index) => {
                          const isSelected = editAvatarUrl === option;
                          return (
                            <Button
                              key={option}
                              type="button"
                              variant="outline"
                              size="icon"
                              className={cn(
                                "h-auto w-auto shrink-0 p-1",
                                isSelected
                                  ? "border-primary bg-primary/10 shadow-sm"
                                  : "border-border/70 hover:border-primary/40 hover:bg-accent/40",
                              )}
                              onClick={() => setEditAvatarUrl(option)}
                              title={`Select avatar ${index + 1}`}
                            >
                              <span
                                className="h-12 w-12 rounded-md bg-cover bg-center"
                                style={{ backgroundImage: `url(${option})` }}
                                aria-label={`Avatar option ${index + 1}`}
                              />
                            </Button>
                          );
                        })}
                      </div>
                    </div>

                    <p className="text-xs text-muted-foreground">
                      Current:{" "}
                      {editAvatarUrl === "initials"
                        ? getNameInitials(editName, editEmail)
                        : editAvatarUrl
                          ? "Custom avatar selected"
                          : "No selection"}
                    </p>
                    {editAvatarUrl && editAvatarUrl !== "initials" && (
                      <p
                        className="truncate text-xs text-muted-foreground"
                        title={editAvatarUrl}
                      >
                        URL: {editAvatarUrl}
                      </p>
                    )}
                    {!member.user_id && (
                      <p className="text-xs text-muted-foreground">
                        Avatar is saved when this member has a login account.
                      </p>
                    )}
                  </CardContent>
                )}
              </Card>
            </div>
          ) : (
            <div className="grid gap-4 lg:grid-cols-2">
              <Card className="border-border/70 shadow-none">
                <CardContent className="space-y-4 p-4">
                  <div className="flex items-center gap-3">
                    <MemberAvatar
                      name={member.name}
                      email={member.email}
                      userId={member.user_id || null}
                      avatarUrl={member.avatar_url || null}
                      sizeClass="h-14 w-14"
                      textClass="text-base"
                    />
                    <div>
                      <p className="text-base font-semibold">{member.name}</p>
                      <div className="flex flex-wrap items-center gap-2 mt-0.5">
                        <span className="text-sm text-muted-foreground">
                          {member.role}
                        </span>
                        {member.system_role ? (
                          <Badge
                            variant="outline"
                            className="h-4 px-1 text-[10px] capitalize font-normal opacity-70"
                          >
                            {member.system_role}
                          </Badge>
                        ) : (
                          <span className="text-[10px] text-muted-foreground italic">
                            No access
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="grid gap-3 text-sm sm:grid-cols-2">
                    <div>
                      <p className="text-xs uppercase tracking-wide text-muted-foreground">
                        Joined
                      </p>
                      <p className="mt-1 font-medium">{createdAtLabel}</p>
                    </div>
                    <div>
                      <p className="text-xs uppercase tracking-wide text-muted-foreground">
                        Account status
                      </p>
                      <Badge
                        variant={member.user_id ? "secondary" : "outline"}
                        className="mt-1"
                      >
                        {member.user_id ? "User in app" : "No app user"}
                      </Badge>
                    </div>
                    <div className="sm:col-span-2">
                      <p className="text-xs uppercase tracking-wide text-muted-foreground">
                        Email
                      </p>
                      <p className="mt-1 font-medium">
                        {member.email || "No email"}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="border-border/70 shadow-none">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm">Account details</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3 text-sm">
                  <div className="flex items-start justify-between gap-3">
                    <span className="text-muted-foreground">Last login</span>
                    <span className="text-right font-medium">
                      {isAdmin ? lastLoginLabel : "Admin only"}
                    </span>
                  </div>
                  <div className="flex items-start justify-between gap-3">
                    <span className="text-muted-foreground">Login linked</span>
                    <span className="text-right font-medium">
                      {member.user_id ? "Yes" : "No"}
                    </span>
                  </div>
                  <div className="flex items-start justify-between gap-3">
                    <span className="text-muted-foreground">Member ID</span>
                    <span className="text-right font-medium">{member.id}</span>
                  </div>
                  {isAdmin && (
                    <div className="pt-1">
                      <Dialog
                        open={authHistoryOpen}
                        onOpenChange={setAuthHistoryOpen}
                      >
                        <DialogTrigger asChild>
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-8 px-2 text-xs"
                          >
                            <Clock3 className="mr-1.5 h-3.5 w-3.5" />
                            Open sign-in history
                          </Button>
                        </DialogTrigger>
                        <DialogContent className="sm:max-w-3xl max-h-[90vh] flex flex-col p-0 overflow-hidden">
                          <div className="shrink-0 flex items-center justify-between border-b bg-background px-6 py-4">
                            <div>
                              <DialogTitle>Sign-in history</DialogTitle>
                              <DialogDescription>
                                Login and session activity for{" "}
                                {member.email || member.name}.
                              </DialogDescription>
                            </div>
                          </div>

                          <div className="flex-1 overflow-y-auto px-6 py-4 space-y-2 min-h-0">
                            {authActivityMissingTable ? (
                              <p className="text-sm text-muted-foreground">
                                Auth activity table is not set up yet. Run
                                `sql/migrate_auth_activity.sql`.
                              </p>
                            ) : authEvents.length === 0 ? (
                              <p className="text-sm text-muted-foreground">
                                No sign-in events recorded for this user yet.
                              </p>
                            ) : (
                              authEvents.map((event) => (
                                <Card
                                  key={event.id}
                                  className="border-border/70 shadow-none"
                                >
                                  <CardContent className="space-y-1.5 p-3">
                                    <div className="flex flex-wrap items-center justify-between gap-2">
                                      <Badge
                                        variant="outline"
                                        className="capitalize"
                                      >
                                        {event.event_type.replaceAll("_", " ")}
                                      </Badge>
                                      <span className="text-xs text-muted-foreground">
                                        {new Date(
                                          event.created_at,
                                        ).toLocaleString()}
                                      </span>
                                    </div>
                                    <p className="text-xs text-muted-foreground">
                                      Email:{" "}
                                      {event.email ||
                                        member.email ||
                                        "Unavailable"}
                                    </p>
                                    <p className="text-xs text-muted-foreground">
                                      {event.city || event.country
                                        ? `Location: ${[event.city, event.country].filter(Boolean).join(", ")}`
                                        : "Location unavailable"}
                                    </p>
                                    {event.user_agent && (
                                      <p className="line-clamp-2 text-xs text-muted-foreground">
                                        Device: {event.user_agent}
                                      </p>
                                    )}
                                  </CardContent>
                                </Card>
                              ))
                            )}
                          </div>

                          <div className="shrink-0 flex items-center justify-end border-t bg-background px-6 py-4">
                            <DialogClose asChild>
                              <Button variant="outline" size="sm">
                                <X className="mr-2 h-4 w-4" />
                                Close
                              </Button>
                            </DialogClose>
                          </div>
                        </DialogContent>
                      </Dialog>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="glass">
        <CardHeader>
          <CardTitle className="text-base">Statistics</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap justify-center gap-x-6 gap-y-4">
            <div className="text-center">
              <p className="text-xs text-muted-foreground">Active projects</p>
              <p className="text-2xl font-semibold">{activeProjects.length}</p>
            </div>
            <div className="text-center">
              <p className="text-xs text-muted-foreground">
                Completed projects
              </p>
              <p className="text-2xl font-semibold">
                {completedProjects.length}
              </p>
            </div>
            <div className="text-center">
              <p className="text-xs text-muted-foreground">Active tasks</p>
              <p className="text-2xl font-semibold">{activeTasks.length}</p>
            </div>
            <div className="text-center">
              <p className="text-xs text-muted-foreground">Completed tasks</p>
              <p className="text-2xl font-semibold">{completedTasks.length}</p>
            </div>
            <div className="text-center">
              <p className="text-xs text-muted-foreground">Overdue tasks</p>
              <p className="text-2xl font-semibold">{overdueTasks.length}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="glass">
          <CardHeader>
            <CardTitle className="text-base">Active projects</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {activeProjects.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No active projects.
              </p>
            ) : (
              activeProjects.map((project) => (
                <div
                  key={project.id}
                  className="flex items-center justify-between rounded-md border border-border/70 px-3 py-2"
                >
                  <p className="text-sm font-medium">{project.name}</p>
                  <Badge variant="outline" className="capitalize">
                    {project.status}
                  </Badge>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <Card className="glass">
          <CardHeader>
            <CardTitle className="text-base">
              Personal tasks (not done)
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {activeTasks.length === 0 ? (
              <p className="text-sm text-muted-foreground">No active tasks.</p>
            ) : (
              activeTasks.slice(0, 8).map((task) => (
                <div
                  key={task.id}
                  className="rounded-md border border-border/70 px-3 py-2"
                >
                  <p className="text-sm font-medium">{task.title}</p>
                  <p className="text-xs text-muted-foreground">
                    Status: <span className="capitalize">{task.status}</span>
                    {task.due_date ? ` • Due ${task.due_date}` : ""}
                  </p>
                </div>
              ))
            )}
            {activeTasks.length > 8 && (
              <p className="text-xs text-muted-foreground">
                Showing 8 of {activeTasks.length} active tasks.
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
