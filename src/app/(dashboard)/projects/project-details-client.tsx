"use client";

import { useEffect, useMemo, useState, KeyboardEvent } from "react";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import { type DateRange } from "react-day-picker";
import {
  ArrowLeft,
  Check,
  ChevronsUpDown,
  ClipboardList,
  Loader2,
  Save,
  Trash2,
  Users,
  Plus,
  X,
  Briefcase,
  DollarSign,
  Tag,
  AlignLeft,
  CalendarDays,
  XCircle,
  Building2,
} from "lucide-react";

import { useUser } from "@/components/user-provider";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
import { DatePicker } from "@/components/ui/date-picker";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import MemberAvatar from "@/components/member-avatar";

type Member = {
  id: string;
  name: string;
  email: string | null;
  avatar_url?: string | null;
};

type Client = {
  id: string;
  name: string;
};

type ProjectTask = {
  id: string;
  title: string;
  status: "todo" | "in-progress" | "done";
  priority: "low" | "medium" | "high" | "urgent";
  due_date: string | null;
};

type NewProjectTask = {
  title: string;
  priority: "low" | "medium" | "high" | "urgent";
  due_date: string | null;
  assignee_id: string | null;
};

const getClientDisplayName = (clientName?: string | null) => {
  const normalized = clientName?.trim();
  return normalized ? normalized : "Internal project";
};

type ProjectResponse = {
  id: string;
  name: string;
  status: "active" | "in-progress" | "on-hold" | "completed" | "closed";
  start_date: string | null;
  deadline: string | null;
  budget: number | null;
  client_name: string | null;
  description: string | null;
  labels: string[] | null;
  color: string | null;
  icon: string | null;
  project_members?: Array<{ members: Member | null }>;
};

const PROJECT_STATUSES: ProjectResponse["status"][] = [
  "active",
  "in-progress",
  "on-hold",
  "completed",
  "closed",
];

const PRIORITIES: NewProjectTask["priority"][] = ["low", "medium", "high", "urgent"];

const priorityColors = {
  urgent: "bg-rose-500",
  high: "bg-orange-500",
  medium: "bg-blue-500",
  low: "bg-zinc-400",
};

function parseDateValue(value: string | null) {
  if (!value) return undefined;
  const [year, month, day] = value.split("-").map(Number);
  if (!year || !month || !day) return undefined;
  return new Date(year, month - 1, day);
}

function toDateValue(date?: Date) {
  if (!date) return "";
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function toReadableDate(value: string | null) {
  if (!value) return "-";
  const parsed = parseDateValue(value);
  if (!parsed) return value;
  return format(parsed, "MMM d, yyyy");
}

function taskStatusClass(status: ProjectTask["status"]) {
  if (status === "done") return "bg-emerald-500/15 text-emerald-700 border-emerald-500/30";
  if (status === "in-progress") return "bg-sky-500/15 text-sky-700 border-sky-500/30";
  return "bg-amber-500/15 text-amber-700 border-amber-500/30";
}

function taskPriorityClass(priority: ProjectTask["priority"]) {
  if (priority === "urgent") return "bg-rose-500/15 text-rose-700 border-rose-500/30";
  if (priority === "high") return "bg-orange-500/15 text-orange-700 border-orange-500/30";
  if (priority === "medium") return "bg-indigo-500/15 text-indigo-700 border-indigo-500/30";
  return "bg-zinc-500/15 text-zinc-700 border-zinc-500/30";
}

function Label({ children, required }: { children: React.ReactNode; required?: boolean }) {
  return (
    <label className="text-sm font-medium text-foreground">
      {children}
      {required && <span className="text-rose-500 ml-0.5">*</span>}
    </label>
  );
}

function FormField({
  label,
  required,
  error,
  children,
}: {
  label: string;
  required?: boolean;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-2">
      <Label required={required}>{label}</Label>
      {children}
      {error && <p className="text-xs text-rose-500">{error}</p>}
    </div>
  );
}

// Multi-select label input component
function LabelInput({
  labels,
  onChange,
  disabled,
}: {
  labels: string[];
  onChange: (labels: string[]) => void;
  disabled?: boolean;
}) {
  const [inputValue, setInputValue] = useState("");

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (disabled) return;
    
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      addLabel();
    } else if (e.key === "Backspace" && inputValue === "" && labels.length > 0) {
      removeLabel(labels.length - 1);
    }
  };

  const addLabel = () => {
    const trimmed = inputValue.trim().replace(/,/g, "");
    if (trimmed && !labels.includes(trimmed)) {
      onChange([...labels, trimmed]);
    }
    setInputValue("");
  };

  const removeLabel = (index: number) => {
    onChange(labels.filter((_, i) => i !== index));
  };

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2 min-h-[42px] w-full rounded-lg border border-input bg-background px-3 py-2 text-sm transition-colors focus-within:outline-none focus-within:ring-2 focus-within:ring-primary/20 focus-within:border-primary">
        {labels.map((label, index) => (
          <Badge
            key={index}
            variant="secondary"
            className="flex items-center gap-1.5 h-7 px-2.5 py-0.5 text-xs font-medium"
          >
            {label}
            <button
              type="button"
              disabled={disabled}
              onClick={() => removeLabel(index)}
              className="ml-0.5 hover:text-rose-500 transition-colors"
            >
              <X className="h-3 w-3" />
            </button>
          </Badge>
        ))}
        <input
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={handleKeyDown}
          onBlur={addLabel}
          disabled={disabled}
          placeholder={labels.length === 0 ? "Type and press Enter or comma..." : ""}
          className="flex-1 min-w-[150px] bg-transparent outline-none text-sm placeholder:text-muted-foreground disabled:opacity-50"
        />
      </div>
      <p className="text-xs text-muted-foreground">
        Press Enter or comma to add labels, click X to remove
      </p>
    </div>
  );
}

// Client picker with clear button
function ClientPicker({
  value,
  onChange,
  clients,
  disabled,
}: {
  value: string;
  onChange: (value: string) => void;
  clients: Client[];
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);

  const selectedClient = clients.find((c) => c.name === value);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          disabled={disabled}
          aria-expanded={open}
          className="h-11 w-full justify-between hover:bg-accent/50"
        >
          {selectedClient ? (
            <span className="flex items-center gap-2 truncate">
              <Building2 className="h-4 w-4 text-muted-foreground" />
              {selectedClient.name}
            </span>
          ) : (
            <span className="text-muted-foreground truncate">Select a client</span>
          )}
          <div className="flex items-center gap-1">
            {selectedClient && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onChange("");
                }}
                className="p-1 hover:bg-accent rounded"
              >
                <XCircle className="h-3.5 w-3.5 text-muted-foreground hover:text-foreground" />
              </button>
            )}
            <ChevronsUpDown className="h-4 w-4 shrink-0 opacity-50" />
          </div>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
        <Command>
          <CommandInput placeholder="Search clients..." className="h-11" />
          <CommandList className="max-h-[200px]">
            <CommandEmpty>No client found.</CommandEmpty>
            <CommandGroup>
              {clients.map((client) => (
                <CommandItem
                  key={client.id}
                  value={client.name}
                  onSelect={(val) => {
                    onChange(val);
                    setOpen(false);
                  }}
                >
                  <Check
                    className={cn(
                      "mr-2 h-4 w-4",
                      selectedClient?.id === client.id ? "opacity-100" : "opacity-0",
                    )}
                  />
                  <Building2 className="mr-2 h-4 w-4 text-muted-foreground" />
                  <span className="truncate">{client.name}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

// Member picker with avatars
function MemberPicker({
  selectedIds,
  onChange,
  members,
  disabled,
}: {
  selectedIds: string[];
  onChange: (ids: string[]) => void;
  members: Member[];
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);

  const selectedMembers = members.filter((m) => selectedIds.includes(m.id));

  const toggleMember = (id: string) => {
    if (selectedIds.includes(id)) {
      onChange(selectedIds.filter((i) => i !== id));
    } else {
      onChange([...selectedIds, id]);
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          disabled={disabled}
          aria-expanded={open}
          className="h-11 w-full justify-between hover:bg-accent/50"
        >
          {selectedMembers.length > 0 ? (
            <div className="flex items-center gap-2 truncate">
              <div className="flex -space-x-2">
                {selectedMembers.slice(0, 3).map((member) => (
                  <MemberAvatar
                    key={member.id}
                    name={member.name}
                    email={member.email}
                    avatarUrl={member.avatar_url}
                    sizeClass="h-6 w-6"
                    textClass="text-[8px]"
                  />
                ))}
                {selectedMembers.length > 3 && (
                  <div className="flex h-6 w-6 items-center justify-center rounded-full bg-muted text-[8px]">
                    +{selectedMembers.length - 3}
                  </div>
                )}
              </div>
              <span className="text-sm text-muted-foreground">
                {selectedMembers.length} selected
              </span>
            </div>
          ) : (
            <span className="text-muted-foreground">Select team members</span>
          )}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[360px] p-0" align="start">
        <Command>
          <CommandInput placeholder="Search members..." className="h-11" />
          <CommandList className="max-h-[250px]">
            <CommandEmpty>No members found.</CommandEmpty>
            <CommandGroup>
              {members.map((member) => (
                <CommandItem
                  key={member.id}
                  value={`${member.name} ${member.email || ""}`}
                  onSelect={() => toggleMember(member.id)}
                >
                  <Check
                    className={cn(
                      "mr-2 h-4 w-4",
                      selectedIds.includes(member.id) ? "opacity-100" : "opacity-0",
                    )}
                  />
                  <MemberAvatar
                    name={member.name}
                    email={member.email}
                    avatarUrl={member.avatar_url}
                    sizeClass="h-8 w-8"
                    textClass="text-[10px]"
                  />
                  <div className="ml-2 flex flex-col">
                    <span className="text-sm font-medium">{member.name}</span>
                    {member.email && (
                      <span className="text-xs text-muted-foreground">{member.email}</span>
                    )}
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
          {selectedIds.length > 0 && (
            <div className="border-t p-2">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => onChange([])}
                className="w-full text-xs text-muted-foreground hover:text-foreground"
              >
                Clear selection
              </Button>
            </div>
          )}
        </Command>
      </PopoverContent>
    </Popover>
  );
}

export default function ProjectDetailsClient({
  projectId,
  mode,
}: {
  projectId?: string;
  mode: "create" | "view";
}) {
  const router = useRouter();
  const { profile } = useUser();

  const isAdmin = profile?.role === "admin";
  const canEdit = profile?.role === "admin" || profile?.role === "member";

  const [loading, setLoading] = useState(mode === "view");
  const [saving, setSaving] = useState(false);
  const [members, setMembers] = useState<Member[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [editEnabled, setEditEnabled] = useState(mode === "create");
  const [tasksExpanded, setTasksExpanded] = useState(true);
  const [projectTasks, setProjectTasks] = useState<ProjectTask[]>([]);
  const [tasksLoading, setTasksLoading] = useState(mode === "view");
  const [projectMemberNames, setProjectMemberNames] = useState<string[]>([]);

  // Form state
  const [name, setName] = useState("");
  const [nameError, setNameError] = useState("");
  const [status, setStatus] = useState<ProjectResponse["status"]>("active");
  const [startDate, setStartDate] = useState("");
  const [deadline, setDeadline] = useState("");
  const [budget, setBudget] = useState("");
  const [clientName, setClientName] = useState("");
  const [description, setDescription] = useState("");
  const [labelItems, setLabelItems] = useState<string[]>([]);
  const [memberIds, setMemberIds] = useState<string[]>([]);
  const [dateRange, setDateRange] = useState<DateRange | undefined>(undefined);

  // New: Tasks to create with project
  const [addTasksMode, setAddTasksMode] = useState(false);
  const [newTasks, setNewTasks] = useState<NewProjectTask[]>([]);
  const [newTaskTitle, setNewTaskTitle] = useState("");
  const [newTaskPriority, setNewTaskPriority] = useState<NewProjectTask["priority"]>("medium");
  const [newTaskDueDate, setNewTaskDueDate] = useState<Date | undefined>(undefined);
  const [newTaskAssigneeId, setNewTaskAssigneeId] = useState<string | null>(null);

  const selectedMemberCount = useMemo(() => memberIds.length, [memberIds]);
  const selectedMembers = useMemo(
    () => members.filter((member) => memberIds.includes(member.id)),
    [members, memberIds],
  );
  const isViewMode = mode === "view" && !editEnabled;
  const displayAssignees =
    selectedMembers.length > 0 ? selectedMembers.map((member) => member.name) : projectMemberNames;

  useEffect(() => {
    const loadLookups = async () => {
      const [membersResponse, clientsResponse] = await Promise.all([
        fetch("/api/members", { cache: "no-store" }),
        fetch("/api/clients", { cache: "no-store" }),
      ]);
      const [membersData, clientsData] = await Promise.all([
        membersResponse.json().catch(() => []),
        clientsResponse.json().catch(() => []),
      ]);
      setMembers(Array.isArray(membersData) ? membersData : []);
      setClients(Array.isArray(clientsData) ? clientsData : []);
    };

    void loadLookups();
  }, []);

  useEffect(() => {
    if (mode !== "view" || !projectId) return;

    const loadProject = async () => {
      setLoading(true);
      const response = await fetch(`/api/projects/${projectId}`, { cache: "no-store" });
      const data = (await response.json().catch(() => null)) as ProjectResponse | null;

      if (response.ok && data) {
        setName(data.name || "");
        setStatus(data.status || "active");
        setStartDate(data.start_date || "");
        setDeadline(data.deadline || "");
        setBudget(data.budget != null ? String(data.budget) : "");
        setClientName(data.client_name || "");
        setDescription(data.description || "");
        setLabelItems((data.labels || []).join(", ").split(",").filter(Boolean).map(s => s.trim()));
        const from = parseDateValue(data.start_date);
        const to = parseDateValue(data.deadline);
        setDateRange(from || to ? { from, to } : undefined);
        setMemberIds(
          (data.project_members || [])
            .map((item) => item.members?.id)
            .filter((id): id is string => Boolean(id)),
        );
        setProjectMemberNames(
          Array.from(
            new Set(
              (data.project_members || [])
                .map((item) => item.members?.name)
                .filter((value): value is string => Boolean(value)),
            ),
          ),
        );
      }

      setLoading(false);
    };

    void loadProject();
  }, [mode, projectId]);

  useEffect(() => {
    if (mode !== "view" || !projectId) {
      setProjectTasks([]);
      setTasksLoading(false);
      return;
    }

    setTasksExpanded(false);
    setTasksLoading(true);
    const loadTasks = async () => {
      try {
        const response = await fetch(`/api/tasks?projectId=${projectId}`, { cache: "no-store" });
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
  }, [mode, projectId]);

  const handleAddTask = () => {
    if (!newTaskTitle.trim()) return;
    setNewTasks((prev) => [
      ...prev,
      {
        title: newTaskTitle.trim(),
        priority: newTaskPriority,
        due_date: newTaskDueDate ? format(newTaskDueDate, "yyyy-MM-dd") : null,
        assignee_id: newTaskAssigneeId,
      },
    ]);
    setNewTaskTitle("");
    setNewTaskPriority("medium");
    setNewTaskDueDate(undefined);
    setNewTaskAssigneeId(null);
  };

  const handleRemoveTask = (index: number) => {
    setNewTasks((prev) => prev.filter((_, i) => i !== index));
  };

  const onSave = async () => {
    if (!canEdit || !editEnabled) return;
    
    if (!name.trim()) {
      setNameError("Project name is required");
      return;
    }
    setNameError("");

    const payload = {
      name: name.trim(),
      status,
      start_date: startDate || null,
      deadline: deadline || null,
      budget: budget ? Number(budget) : null,
      client_name: clientName.trim() || null,
      description: description.trim() || null,
      labels: labelItems,
      member_ids: memberIds,
    };

    setSaving(true);
    const endpoint = mode === "create" ? "/api/projects" : `/api/projects/${projectId}`;
    const method = mode === "create" ? "POST" : "PUT";

    const response = await fetch(endpoint, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const data = await response.json().catch(() => null);

    if (!response.ok) {
      setSaving(false);
      alert(data?.error || "Failed to save project");
      return;
    }

    // If creating new project with tasks
    if (mode === "create" && data?.id && newTasks.length > 0) {
      const taskPromises = newTasks.map((task) =>
        fetch("/api/tasks", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ...task,
            project_id: data.id,
            status: "todo",
          }),
        })
      );
      await Promise.all(taskPromises);
    }

    setSaving(false);

    if (mode === "create" && data?.id) {
      router.push(`/projects/${data.id}`);
      return;
    }

    setEditEnabled(false);
  };

  const onDelete = async () => {
    if (!projectId || !isAdmin) return;
    if (!confirm("Delete this project? This cannot be undone.")) return;

    const response = await fetch(`/api/projects/${projectId}`, { method: "DELETE" });
    if (response.ok) {
      router.push("/projects");
      return;
    }

    const data = await response.json().catch(() => null);
    alert(data?.error || "Failed to delete project");
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Button variant="outline" onClick={() => router.push("/projects")} className="gap-2">
          <ArrowLeft className="h-4 w-4" /> Back to Projects
        </Button>

        {mode === "view" && canEdit && (
          <div className="flex items-center gap-2">
            <Button variant={editEnabled ? "secondary" : "outline"} onClick={() => setEditEnabled((v) => !v)}>
              {editEnabled ? "Stop Editing" : "Edit Project"}
            </Button>
            {isAdmin && editEnabled && (
              <Button variant="destructive" onClick={onDelete} className="gap-2">
                <Trash2 className="h-4 w-4" /> Delete
              </Button>
            )}
          </div>
        )}
      </div>

      <Card className="glass border-border/60">
        <CardHeader className="pb-4">
          <CardTitle className="text-2xl font-semibold">
            {mode === "create" ? "Create New Project" : name || "Project Details"}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : isViewMode ? (
            <div className="space-y-6">
              {/* Stats Grid */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                <div className="rounded-xl border border-border/70 bg-gradient-to-br from-background/60 to-background/30 p-4">
                  <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    <Briefcase className="h-3.5 w-3.5" />
                    Status
                  </div>
                  <p className="mt-2 text-lg font-semibold capitalize">{status.replace("-", " ")}</p>
                </div>
                <div className="rounded-xl border border-border/70 bg-gradient-to-br from-background/60 to-background/30 p-4">
                  <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    <CalendarDays className="h-3.5 w-3.5" />
                    Timeline
                  </div>
                  <p className="mt-2 text-lg font-semibold">{toReadableDate(startDate)}</p>
                  <p className="text-xs text-muted-foreground">to {toReadableDate(deadline)}</p>
                </div>
                <div className="rounded-xl border border-border/70 bg-gradient-to-br from-background/60 to-background/30 p-4">
                  <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    <DollarSign className="h-3.5 w-3.5" />
                    Budget
                  </div>
                  <p className="mt-2 text-lg font-semibold">
                    {budget ? `$${Number(budget).toLocaleString()}` : "-"}
                  </p>
                </div>
                <div className="rounded-xl border border-border/70 bg-gradient-to-br from-background/60 to-background/30 p-4">
                  <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    <ClipboardList className="h-3.5 w-3.5" />
                    Tasks
                  </div>
                  <p className="mt-2 text-lg font-semibold">{tasksLoading ? "..." : projectTasks.length}</p>
                </div>
              </div>

              <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
                <div className="space-y-6">
                  {/* Tasks Section */}
                  <div className="rounded-xl border border-border/70 bg-gradient-to-br from-background/60 to-background/30 p-5">
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2 text-sm font-medium">
                        <ClipboardList className="h-4 w-4 text-muted-foreground" />
                        Task List
                      </div>
                      {projectId && (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="h-8"
                          onClick={() => router.push(`/tasks?projectId=${projectId}`)}
                        >
                          Open board
                        </Button>
                      )}
                    </div>

                    {tasksLoading ? (
                      <div className="mt-4 flex items-center justify-center py-8">
                        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                      </div>
                    ) : projectTasks.length === 0 ? (
                      <p className="mt-4 text-sm text-muted-foreground">No tasks linked to this project yet.</p>
                    ) : (
                      <div className="mt-4">
                        <div className="space-y-2 sm:hidden">
                          {projectTasks.map((task) => (
                            <div key={task.id} className="rounded-lg border border-border/60 bg-background/50 p-3">
                              <p className="text-sm font-medium leading-snug">{task.title}</p>
                              <div className="mt-2 flex flex-wrap items-center gap-1.5">
                                <Badge variant="outline" className={cn("capitalize text-[11px]", taskStatusClass(task.status))}>
                                  {task.status.replace("-", " ")}
                                </Badge>
                                <Badge variant="outline" className={cn("capitalize text-[11px]", taskPriorityClass(task.priority))}>
                                  {task.priority}
                                </Badge>
                              </div>
                              <p className="mt-2 text-xs text-muted-foreground">Due: {toReadableDate(task.due_date)}</p>
                            </div>
                          ))}
                        </div>

                        <div className="hidden sm:block">
                          <Table>
                            <TableHeader>
                              <TableRow className="hover:bg-transparent">
                                <TableHead className="h-9 text-xs">Task</TableHead>
                                <TableHead className="h-9 text-xs">Status</TableHead>
                                <TableHead className="h-9 text-xs">Priority</TableHead>
                                <TableHead className="h-9 text-xs">Due</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {projectTasks.map((task) => (
                                <TableRow key={task.id} className="hover:bg-accent/50">
                                  <TableCell className="py-3 text-sm font-medium">{task.title}</TableCell>
                                  <TableCell className="py-3">
                                    <Badge variant="outline" className={cn("capitalize text-xs", taskStatusClass(task.status))}>
                                      {task.status.replace("-", " ")}
                                    </Badge>
                                  </TableCell>
                                  <TableCell className="py-3">
                                    <Badge variant="outline" className={cn("capitalize text-xs", taskPriorityClass(task.priority))}>
                                      {task.priority}
                                    </Badge>
                                  </TableCell>
                                  <TableCell className="py-3 text-xs text-muted-foreground">
                                    {toReadableDate(task.due_date)}
                                  </TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Description */}
                  <div className="rounded-xl border border-border/70 bg-gradient-to-br from-background/60 to-background/30 p-5">
                    <div className="flex items-center gap-2 text-sm font-medium mb-3">
                      <AlignLeft className="h-4 w-4 text-muted-foreground" />
                      Description
                    </div>
                    <p className="text-sm text-muted-foreground leading-relaxed">
                      {description || "No description provided."}
                    </p>
                  </div>
                </div>

                <div className="space-y-4">
                  {/* Client */}
                  <div className="rounded-xl border border-border/70 bg-gradient-to-br from-background/60 to-background/30 p-5">
                    <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-muted-foreground mb-3">
                      Client
                    </div>
                    <p className="text-sm font-medium">{getClientDisplayName(clientName)}</p>
                  </div>

                  {/* Team */}
                  <div className="rounded-xl border border-border/70 bg-gradient-to-br from-background/60 to-background/30 p-5">
                    <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-muted-foreground mb-3">
                      <Users className="h-3.5 w-3.5" />
                      Assigned Team
                    </div>
                    <div className="space-y-2">
                      {displayAssignees.length > 0 ? (
                        <div className="flex flex-wrap gap-2">
                          {displayAssignees.map((memberName) => (
                            <div
                              key={memberName}
                              className="inline-flex items-center gap-2 rounded-lg border border-border/70 bg-background/60 px-3 py-1.5 text-xs"
                            >
                              <Users className="h-3 w-3 text-muted-foreground" />
                              {memberName}
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-sm text-muted-foreground">No members assigned.</p>
                      )}
                    </div>
                  </div>

                  {/* Labels */}
                  <div className="rounded-xl border border-border/70 bg-gradient-to-br from-background/60 to-background/30 p-5">
                    <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-muted-foreground mb-3">
                      <Tag className="h-3.5 w-3.5" />
                      Labels
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {labelItems.length > 0 ? (
                        labelItems.map((label) => (
                          <Badge key={label} variant="outline" className="text-xs">
                            {label}
                          </Badge>
                        ))
                      ) : (
                        <p className="text-sm text-muted-foreground">No labels.</p>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-8">
              {/* Project Basic Info */}
              <div className="space-y-6">
                <div className="flex items-center gap-2 text-lg font-semibold">
                  <Briefcase className="h-5 w-5 text-primary" />
                  Project Information
                </div>
                
                <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                  <FormField label="Project Name" required error={nameError}>
                    <input
                      value={name}
                      onChange={(e) => {
                        setName(e.target.value);
                        if (nameError) setNameError("");
                      }}
                      disabled={!editEnabled}
                      placeholder="Enter project name"
                      className={cn(
                        "h-11 w-full rounded-lg border bg-background px-4 py-2 text-sm transition-colors",
                        "placeholder:text-muted-foreground",
                        "focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary",
                        nameError ? "border-rose-500" : "border-input",
                      )}
                    />
                  </FormField>

                  <FormField label="Status">
                    <select
                      value={status}
                      onChange={(e) => setStatus(e.target.value as ProjectResponse["status"])}
                      disabled={!editEnabled}
                      className="h-11 w-full rounded-lg border border-input bg-background px-4 py-2 text-sm transition-colors focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                    >
                      {PROJECT_STATUSES.map((item) => (
                        <option key={item} value={item}>
                          {item.replace("-", " ").charAt(0).toUpperCase() + item.replace("-", " ").slice(1)}
                        </option>
                      ))}
                    </select>
                  </FormField>
                </div>
              </div>

              {/* Date & Budget */}
              <div className="space-y-6">
                <div className="flex items-center gap-2 text-lg font-semibold">
                  <CalendarDays className="h-5 w-5 text-primary" />
                  Timeline & Budget
                </div>

                <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                  <FormField label="Project Date Range">
                    <DateRangePicker
                      date={dateRange}
                      onDateChange={(range) => {
                        setDateRange(range);
                        setStartDate(toDateValue(range?.from));
                        setDeadline(toDateValue(range?.to));
                      }}
                    />
                    {dateRange?.from && (
                      <div className="flex items-center gap-2 mt-2">
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setDateRange(undefined);
                            setStartDate("");
                            setDeadline("");
                          }}
                          className="h-7 text-xs text-muted-foreground hover:text-foreground"
                        >
                          <X className="mr-1 h-3 w-3" />
                          Clear dates
                        </Button>
                      </div>
                    )}
                  </FormField>

                  <FormField label="Budget">
                    <div className="relative">
                      <span className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
                      <input
                        type="number"
                        value={budget}
                        onChange={(e) => setBudget(e.target.value)}
                        disabled={!editEnabled}
                        placeholder="0.00"
                        className="h-11 w-full rounded-lg border border-input bg-background pl-8 pr-4 py-2 text-sm transition-colors focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                      />
                    </div>
                  </FormField>
                </div>
              </div>

              {/* Client & Labels */}
              <div className="space-y-6">
                <div className="flex items-center gap-2 text-lg font-semibold">
                  <Users className="h-5 w-5 text-primary" />
                  Client & Organization
                </div>

                <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                  <FormField label="Client">
                    <ClientPicker
                      value={clientName}
                      onChange={setClientName}
                      clients={clients}
                      disabled={!editEnabled}
                    />
                  </FormField>

                  <FormField label="Labels">
                    <LabelInput
                      labels={labelItems}
                      onChange={setLabelItems}
                      disabled={!editEnabled}
                    />
                  </FormField>
                </div>
              </div>

              {/* Team Members */}
              <div className="space-y-4">
                <FormField label="Assigned Members">
                  <MemberPicker
                    selectedIds={memberIds}
                    onChange={setMemberIds}
                    members={members}
                    disabled={!editEnabled}
                  />

                  {/* Selected members with avatars */}
                  {selectedMembers.length > 0 && (
                    <div className="mt-3 flex flex-wrap gap-2">
                      {selectedMembers.map((member) => (
                        <button
                          key={member.id}
                          type="button"
                          disabled={!editEnabled}
                          onClick={() => setMemberIds((prev) => prev.filter((id) => id !== member.id))}
                          className="group flex items-center gap-2 rounded-full border border-border/60 bg-background/60 pl-1.5 pr-3 py-1 text-sm transition-all hover:border-rose-500/50 hover:bg-rose-500/10"
                        >
                          <MemberAvatar
                            name={member.name}
                            email={member.email}
                            avatarUrl={member.avatar_url}
                            sizeClass="h-6 w-6"
                            textClass="text-[9px]"
                          />
                          <span className="text-xs font-medium">{member.name}</span>
                          <X className="h-3.5 w-3.5 text-muted-foreground group-hover:text-rose-500 transition-colors" />
                        </button>
                      ))}
                    </div>
                  )}
                </FormField>
              </div>

              {/* Description */}
              <div className="space-y-3">
                <FormField label="Description">
                  <textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    disabled={!editEnabled}
                    placeholder="Add a description for this project..."
                    rows={4}
                    className="w-full rounded-lg border border-input bg-background px-4 py-3 text-sm transition-colors focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary placeholder:text-muted-foreground resize-none"
                  />
                </FormField>
              </div>

              {/* Add Tasks Section (Create Mode Only) */}
              {mode === "create" && (
                <div className="space-y-4 rounded-xl border border-dashed border-border/60 bg-gradient-to-br from-background/30 to-background/10 p-6">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-lg font-semibold">
                      <ClipboardList className="h-5 w-5 text-primary" />
                      Add Tasks
                    </div>
                    {!addTasksMode && (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => setAddTasksMode(true)}
                        className="gap-2"
                      >
                        <Plus className="h-4 w-4" />
                        Add tasks now
                      </Button>
                    )}
                  </div>

                  {addTasksMode ? (
                    <div className="space-y-4">
                      <p className="text-sm text-muted-foreground">
                        Add tasks that will be created along with this project.
                      </p>

                      {/* New task form */}
                      <div className="flex flex-col gap-3 rounded-lg border border-border/60 bg-background/50 p-4">
                        <div className="flex flex-col gap-3 sm:flex-row">
                          <input
                            value={newTaskTitle}
                            onChange={(e) => setNewTaskTitle(e.target.value)}
                            placeholder="Task title"
                            className="flex-1 h-10 rounded-lg border border-input bg-background px-3 py-2 text-sm transition-colors focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                          />
                          <select
                            value={newTaskPriority}
                            onChange={(e) => setNewTaskPriority(e.target.value as NewProjectTask["priority"])}
                            className="h-10 rounded-lg border border-input bg-background px-3 py-2 text-sm transition-colors focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                          >
                            {PRIORITIES.map((p) => (
                              <option key={p} value={p} className="capitalize">
                                {p.charAt(0).toUpperCase() + p.slice(1)}
                              </option>
                            ))}
                          </select>
                          <div className="w-[180px] shrink-0">
                            <DatePicker
                              date={newTaskDueDate}
                              onDateChange={setNewTaskDueDate}
                              placeholder="Due date (optional)"
                            />
                          </div>
                          <select
                            value={newTaskAssigneeId || ""}
                            onChange={(e) => setNewTaskAssigneeId(e.target.value || null)}
                            className="h-10 rounded-lg border border-input bg-background px-3 py-2 text-sm transition-colors focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                          >
                            <option value="">Assignee (optional)</option>
                            {members.map((member) => (
                              <option key={member.id} value={member.id}>
                                {member.name}
                              </option>
                            ))}
                          </select>
                          <Button
                            type="button"
                            onClick={handleAddTask}
                            disabled={!newTaskTitle.trim()}
                            size="sm"
                            className="h-10 gap-1"
                          >
                            <Plus className="h-4 w-4" />
                            Add
                          </Button>
                        </div>
                      </div>

                      {/* Added tasks list */}
                      {newTasks.length > 0 && (
                        <div className="space-y-2">
                          <p className="text-sm font-medium">
                            {newTasks.length} task{newTasks.length !== 1 ? "s" : ""} to create
                          </p>
                          {newTasks.map((task, index) => (
                            <div
                              key={index}
                              className="flex items-center justify-between gap-3 rounded-lg border border-border/60 bg-background px-4 py-3"
                            >
                              <div className="flex items-center gap-3 min-w-0">
                                <div className={cn("h-2.5 w-2.5 rounded-full shrink-0", priorityColors[task.priority])} />
                                <span className="truncate text-sm font-medium">{task.title}</span>
                                <Badge variant="outline" className="shrink-0 text-xs capitalize">
                                  {task.priority}
                                </Badge>
                                {task.due_date && (
                                  <span className="shrink-0 text-xs text-muted-foreground">
                                    Due {toReadableDate(task.due_date)}
                                  </span>
                                )}
                                {task.assignee_id && (
                                  <span className="shrink-0 text-xs text-muted-foreground">
                                    {members.find(m => m.id === task.assignee_id)?.name || "Unknown"}
                                  </span>
                                )}
                              </div>
                              <button
                                type="button"
                                onClick={() => handleRemoveTask(index)}
                                className="shrink-0 p-1 text-muted-foreground hover:text-rose-500 transition-colors"
                              >
                                <X className="h-4 w-4" />
                              </button>
                            </div>
                          ))}
                        </div>
                      )}

                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setAddTasksMode(false);
                          setNewTasks([]);
                        }}
                      >
                        Done adding tasks
                      </Button>
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      You can add tasks now or create them later from the project page.
                    </p>
                  )}
                </div>
              )}

              {/* View Mode Tasks */}
              {mode === "view" && (
                <div className="rounded-xl border border-dashed border-border/60 bg-gradient-to-br from-background/30 to-background/10 p-5">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-2 text-sm font-medium">
                      <ClipboardList className="h-4 w-4 text-muted-foreground" />
                      Project Tasks
                    </div>
                    {projectId && (
                      <div className="flex items-center gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => router.push(`/tasks?projectId=${projectId}`)}
                        >
                          Open Tasks Board
                        </Button>
                        <button
                          type="button"
                          className="text-xs text-primary underline-offset-2 hover:underline"
                          onClick={() => setTasksExpanded((open) => !open)}
                        >
                          {tasksExpanded ? "Hide task list" : "Show task list"}
                        </button>
                      </div>
                    )}
                  </div>
                  <p className="mt-2 text-xs text-muted-foreground">
                    {tasksLoading
                      ? "Loading tasks..."
                      : `${projectTasks.length} task${projectTasks.length === 1 ? "" : "s"} linked to this project`}
                  </p>

                  {tasksExpanded && (
                    <div className="mt-4 space-y-2">
                      {projectTasks.length === 0 ? (
                        <p className="text-xs text-muted-foreground">No tasks found for this project.</p>
                      ) : (
                        projectTasks.map((task) => (
                          <div
                            key={task.id}
                            className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border/60 bg-background px-3 py-2.5 text-xs"
                          >
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-sm font-medium">{task.title}</p>
                              <p className="text-muted-foreground">
                                {task.priority.toUpperCase()} {task.due_date ? `• Due ${task.due_date}` : ""}
                              </p>
                            </div>
                            <span className="capitalize text-muted-foreground shrink-0">{task.status}</span>
                          </div>
                        ))
                      )}
                    </div>
                  )}
                </div>
              )}

              {canEdit && editEnabled && (
                <div className="flex justify-end pt-4">
                  <Button onClick={onSave} disabled={saving} size="lg" className="gap-2 px-8">
                    {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                    {mode === "create" ? "Create Project" : "Save Changes"}
                  </Button>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
