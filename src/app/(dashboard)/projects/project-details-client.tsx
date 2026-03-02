"use client";

import { useEffect, useMemo, useRef, useState, KeyboardEvent } from "react";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import { type DateRange } from "react-day-picker";
import {
  ArrowLeft,
  Code,
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
  CalendarDays,
  XCircle,
  Building2,
  Activity,
  Database,
  FolderKanban,
  Globe,
  CircleHelp,
  Mail,
  Settings,
  Shield,
  Zap,
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
import { Input } from "@/components/ui/input";
import { Label as UiLabel } from "@/components/ui/label";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { renderMarkdownHtml } from "@/lib/markdown";
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
  assignee_member_id?: string | null;
};

type NewProjectTask = {
  title: string;
  priority: "low" | "medium" | "high" | "urgent";
  due_date: string | null;
  assignee_id: string | null;
};

type ActivityFeedItem = {
  id: string;
  timestamp: string;
  title: string;
  detail: string;
  tone: "neutral" | "success" | "warn";
};

type ProjectDetailsTab = "tasks" | "members" | "activities" | "about";

function isProjectDetailsTab(value: string): value is ProjectDetailsTab {
  return (
    value === "tasks" ||
    value === "members" ||
    value === "activities" ||
    value === "about"
  );
}

type ProjectTimelineBucket =
  | "overdue"
  | "today"
  | "upcoming"
  | "later"
  | "done"
  | "no_due";

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

const PRIORITIES: NewProjectTask["priority"][] = [
  "low",
  "medium",
  "high",
  "urgent",
];

const STATUS_COLORS: Record<ProjectResponse["status"], string> = {
  active: "bg-emerald-500",
  "in-progress": "bg-blue-500",
  "on-hold": "bg-amber-500",
  completed: "bg-violet-500",
  closed: "bg-zinc-500",
};

const PROJECT_ICON_MAP: Record<
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
  if (status === "done")
    return "bg-emerald-500/15 text-emerald-700 border-emerald-500/30";
  if (status === "in-progress")
    return "bg-sky-500/15 text-sky-700 border-sky-500/30";
  return "bg-amber-500/15 text-amber-700 border-amber-500/30";
}

function taskPriorityClass(priority: ProjectTask["priority"]) {
  if (priority === "urgent")
    return "bg-rose-500/15 text-rose-700 border-rose-500/30";
  if (priority === "high")
    return "bg-orange-500/15 text-orange-700 border-orange-500/30";
  if (priority === "medium")
    return "bg-indigo-500/15 text-indigo-700 border-indigo-500/30";
  return "bg-zinc-500/15 text-zinc-700 border-zinc-500/30";
}

function projectStatusClass(status: ProjectResponse["status"]) {
  if (status === "active" || status === "in-progress") return "status-active";
  if (status === "on-hold") return "status-on-hold";
  if (status === "completed" || status === "closed") return "status-completed";
  return "";
}

function getMultilinePreviewData(text: string, maxLines = 4, maxChars = 360) {
  const normalized = text.replace(/\r\n/g, "\n");
  const lines = normalized.split("\n");

  let usedChars = 0;
  const selected: string[] = [];

  for (const line of lines) {
    if (selected.length >= maxLines) break;
    const remaining = maxChars - usedChars;
    if (remaining <= 0) break;

    if (line.length <= remaining) {
      selected.push(line);
      usedChars += line.length + 1;
      continue;
    }

    selected.push(line.slice(0, remaining));
    usedChars = maxChars;
    break;
  }

  const preview = selected.join("\n");
  const truncated =
    normalized.length > preview.length || lines.length > selected.length;

  return {
    preview: truncated ? `${preview.replace(/\s+$/, "")}...` : preview,
    truncated,
  };
}

function getProjectTaskDueInfo(
  dueDate: string | null,
  status: ProjectTask["status"],
) {
  if (!dueDate) {
    return {
      label: "No due date",
      bucket: "no_due" as ProjectTimelineBucket,
      tone: "text-muted-foreground",
    };
  }

  const due = new Date(dueDate);
  if (Number.isNaN(due.getTime())) {
    return {
      label: "Invalid due date",
      bucket: "no_due" as ProjectTimelineBucket,
      tone: "text-muted-foreground",
    };
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  due.setHours(0, 0, 0, 0);

  const diffDays = Math.round((due.getTime() - today.getTime()) / 86400000);

  if (status === "done") {
    return {
      label: diffDays >= 0 ? "Completed" : "Completed (was overdue)",
      bucket: "done" as ProjectTimelineBucket,
      tone: "text-emerald-600 dark:text-emerald-400",
    };
  }

  if (diffDays < 0) {
    return {
      label: `Overdue by ${Math.abs(diffDays)} day${Math.abs(diffDays) === 1 ? "" : "s"}`,
      bucket: "overdue" as ProjectTimelineBucket,
      tone: "text-destructive",
    };
  }

  if (diffDays === 0) {
    return {
      label: "Due today",
      bucket: "today" as ProjectTimelineBucket,
      tone: "text-orange-600 dark:text-orange-400",
    };
  }

  if (diffDays <= 7) {
    return {
      label: `Due in ${diffDays} day${diffDays === 1 ? "" : "s"}`,
      bucket: "upcoming" as ProjectTimelineBucket,
      tone: "text-blue-600 dark:text-blue-400",
    };
  }

  return {
    label: `Due in ${diffDays} days`,
    bucket: "later" as ProjectTimelineBucket,
    tone: "text-muted-foreground",
  };
}

function Label({
  children,
  required,
}: {
  children: React.ReactNode;
  required?: boolean;
}) {
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
    } else if (
      e.key === "Backspace" &&
      inputValue === "" &&
      labels.length > 0
    ) {
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
          placeholder={
            labels.length === 0 ? "Type and press Enter or comma..." : ""
          }
          className="flex-1 min-w-[150px] bg-transparent outline-none text-sm placeholder:text-muted-foreground disabled:opacity-50"
        />
      </div>
      <p className="text-xs text-muted-foreground">
        Press Enter or comma to add labels, click X to remove
      </p>
    </div>
  );
}

function MarkdownEditor({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  const inputRef = useRef<HTMLTextAreaElement | null>(null);

  const wrapSelection = (before: string, after = before) => {
    const el = inputRef.current;
    if (!el) return;
    const start = el.selectionStart;
    const end = el.selectionEnd;
    const selected = value.slice(start, end);
    const next = `${value.slice(0, start)}${before}${selected}${after}${value.slice(end)}`;
    onChange(next);
    requestAnimationFrame(() => {
      el.focus();
      el.selectionStart = start + before.length;
      el.selectionEnd = end + before.length;
    });
  };

  const insertPrefix = (prefix: string) => {
    const el = inputRef.current;
    if (!el) return;
    const start = el.selectionStart;
    const end = el.selectionEnd;
    const selected = value.slice(start, end);
    const next = `${value.slice(0, start)}${prefix}${selected}${value.slice(end)}`;
    onChange(next);
    requestAnimationFrame(() => {
      el.focus();
      el.selectionStart = start + prefix.length;
      el.selectionEnd = end + prefix.length;
    });
  };

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-1 rounded-md border border-border/60 bg-muted/30 p-1">
        <Button
          type="button"
          size="sm"
          variant="ghost"
          className="h-7 px-2 text-xs"
          onClick={() => wrapSelection("**")}
        >
          Bold
        </Button>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          className="h-7 px-2 text-xs"
          onClick={() => wrapSelection("*")}
        >
          Italic
        </Button>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          className="h-7 px-2 text-xs"
          onClick={() => wrapSelection("`")}
        >
          Code
        </Button>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          className="h-7 px-2 text-xs"
          onClick={() => wrapSelection("[", "](https://)")}
        >
          Link
        </Button>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          className="h-7 px-2 text-xs"
          onClick={() => insertPrefix("# ")}
        >
          H1
        </Button>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          className="h-7 px-2 text-xs"
          onClick={() => insertPrefix("- ")}
        >
          List
        </Button>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          className="h-7 px-2 text-xs"
          onClick={() => insertPrefix("> ")}
        >
          Quote
        </Button>
      </div>

      <div className="grid gap-2 lg:grid-cols-2">
        <textarea
          ref={inputRef}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Write project description in Markdown..."
          rows={8}
          className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary resize-y"
        />
        <div className="rounded-lg border border-border/70 bg-background/60 p-3">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Preview
          </p>
          <div
            className="prose prose-sm max-w-none text-xs text-muted-foreground sm:text-sm"
            dangerouslySetInnerHTML={{
              __html: value.trim()
                ? renderMarkdownHtml(value)
                : '<p class="text-muted-foreground">Nothing to preview yet.</p>',
            }}
          />
        </div>
      </div>
    </div>
  );
}

// Client picker with clear button
function ClientPicker({
  value,
  onChange,
  clients,
  disabled,
  size = "default",
}: {
  value: string;
  onChange: (value: string) => void;
  clients: Client[];
  disabled?: boolean;
  size?: "default" | "compact";
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
          className={cn(
            "w-full justify-between hover:bg-accent/50",
            size === "compact" ? "h-8 px-2 text-xs sm:h-9 sm:text-sm" : "h-11",
          )}
        >
          {selectedClient ? (
            <span className="flex items-center gap-2 truncate">
              <Building2 className="h-4 w-4 text-muted-foreground" />
              {selectedClient.name}
            </span>
          ) : (
            <span className="text-muted-foreground truncate">
              Select a client
            </span>
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
      <PopoverContent
        className="w-[--radix-popover-trigger-width] max-h-[300px] overflow-y-auto p-0"
        align="start"
      >
        <Command>
          <CommandInput
            placeholder="Search clients..."
            className={cn(
              size === "compact" ? "h-9" : "h-11",
              "no-global-focus-ring border-0 outline-none ring-0 focus:ring-0 focus-visible:ring-0 focus-visible:outline-none",
            )}
          />
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
                      selectedClient?.id === client.id
                        ? "opacity-100"
                        : "opacity-0",
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
                    ring={false}
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
      <PopoverContent
        className="w-[360px] max-h-[300px] overflow-y-auto p-0"
        align="start"
      >
        <Command>
          <CommandInput
            placeholder="Search members..."
            className="h-11 no-global-focus-ring border-0 outline-none ring-0 focus:ring-0 focus-visible:ring-0 focus-visible:outline-none"
          />
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
                      selectedIds.includes(member.id)
                        ? "opacity-100"
                        : "opacity-0",
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
                      <span className="text-xs text-muted-foreground">
                        {member.email}
                      </span>
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
  const [notFound, setNotFound] = useState(false);

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
  const [formMessage, setFormMessage] = useState<{
    type: "error" | "success";
    text: string;
  } | null>(null);
  const [newClientName, setNewClientName] = useState("");
  const [newClientSaving, setNewClientSaving] = useState(false);
  const [descriptionExpanded, setDescriptionExpanded] = useState(false);
  const [isDesktopWide, setIsDesktopWide] = useState(false);
  const [projectActivities, setProjectActivities] = useState<
    ActivityFeedItem[]
  >([]);
  const [activitiesLoading, setActivitiesLoading] = useState(false);
  const [activitiesHasMore, setActivitiesHasMore] = useState(false);
  const [projectColor, setProjectColor] = useState("#8B5CF6");
  const [projectIcon, setProjectIcon] = useState("FolderKanban");
  const [activeTab, setActiveTab] = useState<ProjectDetailsTab>(() => {
    if (typeof window === "undefined") return "tasks";
    const stored = window.sessionStorage.getItem(
      "projecthub-project-details-active-tab",
    );
    return stored && isProjectDetailsTab(stored) ? stored : "tasks";
  });
  const [membersEditMode, setMembersEditMode] = useState(false);
  const [aboutEditMode, setAboutEditMode] = useState(false);
  const [savingMembers, setSavingMembers] = useState(false);
  const [savingAbout, setSavingAbout] = useState(false);

  // New: Tasks to create with project
  const [addTasksMode, setAddTasksMode] = useState(false);
  const [newTasks, setNewTasks] = useState<NewProjectTask[]>([]);
  const [newTaskTitle, setNewTaskTitle] = useState("");
  const [newTaskPriority, setNewTaskPriority] =
    useState<NewProjectTask["priority"]>("medium");
  const [newTaskDueDate, setNewTaskDueDate] = useState<Date | undefined>(
    undefined,
  );
  const [newTaskAssigneeId, setNewTaskAssigneeId] = useState<string | null>(
    null,
  );

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.sessionStorage.setItem(
      "projecthub-project-details-active-tab",
      activeTab,
    );
  }, [activeTab]);

  const selectedMembers = useMemo(
    () => members.filter((member) => memberIds.includes(member.id)),
    [members, memberIds],
  );
  const memberNameById = useMemo(() => {
    const map = new Map<string, string>();
    for (const member of members) {
      map.set(member.id, member.name);
    }
    return map;
  }, [members]);
  const taskAssigneeSummary = useMemo(() => {
    const counts = new Map<string, number>();
    for (const task of projectTasks) {
      if (!task.assignee_member_id) continue;
      counts.set(
        task.assignee_member_id,
        (counts.get(task.assignee_member_id) || 0) + 1,
      );
    }

    return [...counts.entries()].map(([memberId, count]) => ({
      memberId,
      memberName: memberNameById.get(memberId) || "Unknown member",
      count,
    }));
  }, [projectTasks, memberNameById]);
  const isViewMode = mode === "view" && !editEnabled;
  const displayAssignees =
    selectedMembers.length > 0
      ? selectedMembers.map((member) => member.name)
      : projectMemberNames;
  const descriptionPreview = useMemo(() => {
    const maxLines = isDesktopWide ? 20 : 4;
    const maxChars = isDesktopWide ? 3000 : 360;
    return getMultilinePreviewData(description || "", maxLines, maxChars);
  }, [description, isDesktopWide]);
  const ProjectIcon = PROJECT_ICON_MAP[projectIcon] || FolderKanban;

  useEffect(() => {
    const updateDesktopFlag = () => {
      setIsDesktopWide(window.innerWidth >= 1024);
    };

    updateDesktopFlag();
    window.addEventListener("resize", updateDesktopFlag);
    return () => window.removeEventListener("resize", updateDesktopFlag);
  }, []);

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
      setNotFound(false);
      const response = await fetch(`/api/projects/${projectId}`, {
        cache: "no-store",
      });
      const data = (await response
        .json()
        .catch(() => null)) as ProjectResponse | null;

      if (response.ok && data) {
        setName(data.name || "");
        setStatus(data.status || "active");
        setStartDate(data.start_date || "");
        setDeadline(data.deadline || "");
        setBudget(data.budget != null ? String(data.budget) : "");
        setClientName(data.client_name || "");
        setDescription(data.description || "");
        setProjectColor(data.color || "#8B5CF6");
        setProjectIcon(data.icon || "FolderKanban");
        setDescriptionExpanded(false);
        setLabelItems(
          (data.labels || [])
            .join(", ")
            .split(",")
            .filter(Boolean)
            .map((s) => s.trim()),
        );
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
      } else {
        setNotFound(true);
      }

      setLoading(false);
    };

    void loadProject();
  }, [mode, projectId]);

  useEffect(() => {
    if (mode !== "view" || !projectId || notFound) {
      setProjectTasks([]);
      setTasksLoading(false);
      return;
    }

    setTasksExpanded(false);
    setTasksLoading(true);
    const loadTasks = async () => {
      try {
        const response = await fetch(`/api/tasks?projectId=${projectId}`, {
          cache: "no-store",
        });
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
  }, [mode, projectId, notFound]);

  useEffect(() => {
    if (mode !== "view" || !projectId || notFound) {
      setProjectActivities([]);
      setActivitiesLoading(false);
      setActivitiesHasMore(false);
      return;
    }

    setActivitiesLoading(true);
    const loadActivities = async () => {
      try {
        const response = await fetch(
          `/api/projects/${projectId}/activities?offset=0&limit=8`,
          { cache: "no-store" },
        );
        const data = await response.json().catch(() => null);
        if (!response.ok || !data || !Array.isArray(data.activities)) {
          setProjectActivities([]);
          setActivitiesHasMore(false);
          return;
        }

        setProjectActivities(data.activities as ActivityFeedItem[]);
        setActivitiesHasMore(Boolean(data.hasMore));
      } catch {
        setProjectActivities([]);
        setActivitiesHasMore(false);
      } finally {
        setActivitiesLoading(false);
      }
    };

    void loadActivities();
  }, [mode, projectId, notFound]);

  const loadMoreActivities = async () => {
    if (!projectId || activitiesLoading || !activitiesHasMore) return;
    setActivitiesLoading(true);
    try {
      const response = await fetch(
        `/api/projects/${projectId}/activities?offset=${projectActivities.length}&limit=8`,
        { cache: "no-store" },
      );
      const data = await response.json().catch(() => null);
      if (!response.ok || !data || !Array.isArray(data.activities)) {
        setActivitiesHasMore(false);
        return;
      }

      setProjectActivities((prev) => {
        const seen = new Set(prev.map((item) => item.id));
        const next = (data.activities as ActivityFeedItem[]).filter(
          (item) => !seen.has(item.id),
        );
        return [...prev, ...next];
      });
      setActivitiesHasMore(Boolean(data.hasMore));
    } finally {
      setActivitiesLoading(false);
    }
  };

  const saveMembersDetails = async () => {
    if (!projectId || !canEdit) return;
    setFormMessage(null);
    setSavingMembers(true);
    try {
      const response = await fetch(`/api/projects/${projectId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ member_ids: memberIds }),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) {
        setFormMessage({
          type: "error",
          text: data?.error || "Failed to update members",
        });
        return;
      }

      setProjectMemberNames(
        members
          .filter((member) => memberIds.includes(member.id))
          .map((member) => member.name),
      );
      setMembersEditMode(false);
      setFormMessage({ type: "success", text: "Members updated." });
    } finally {
      setSavingMembers(false);
    }
  };

  const saveAboutDetails = async () => {
    if (!projectId || !canEdit) return;
    if (!name.trim()) {
      setNameError("Project name is required");
      return;
    }

    setFormMessage(null);
    setSavingAbout(true);
    try {
      const response = await fetch(`/api/projects/${projectId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          status,
          start_date: startDate || null,
          deadline: deadline || null,
          budget: budget ? Number(budget) : null,
          client_name: clientName.trim() || null,
          description: description.trim() || null,
          labels: labelItems,
        }),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) {
        setFormMessage({
          type: "error",
          text: data?.error || "Failed to update project details",
        });
        return;
      }

      setAboutEditMode(false);
      setFormMessage({ type: "success", text: "Project details updated." });
    } finally {
      setSavingAbout(false);
    }
  };

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
    setFormMessage(null);

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
    const endpoint =
      mode === "create" ? "/api/projects" : `/api/projects/${projectId}`;
    const method = mode === "create" ? "POST" : "PUT";

    const response = await fetch(endpoint, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const data = await response.json().catch(() => null);

    if (!response.ok) {
      setSaving(false);
      setFormMessage({
        type: "error",
        text: data?.error || "Failed to save project",
      });
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
        }),
      );
      await Promise.all(taskPromises);
    }

    setSaving(false);

    if (mode === "create" && data?.id) {
      setFormMessage({
        type: "success",
        text: "Project created successfully.",
      });
      router.push(`/projects/${data.id}`);
      return;
    }

    setFormMessage({ type: "success", text: "Project saved." });
    setEditEnabled(false);
  };

  const onDelete = async () => {
    if (!projectId || !isAdmin) return;
    setFormMessage(null);
    if (!confirm("Delete this project? This cannot be undone.")) return;

    const response = await fetch(`/api/projects/${projectId}`, {
      method: "DELETE",
    });
    if (response.ok) {
      router.push(`/projects?deleted=${encodeURIComponent(name)}`);
      return;
    }

    const data = await response.json().catch(() => null);
    setFormMessage({
      type: "error",
      text: data?.error || "Failed to delete project",
    });
  };

  const onQuickCreateClient = async () => {
    if (!canEdit || !newClientName.trim()) return;
    setFormMessage(null);
    setNewClientSaving(true);
    const response = await fetch("/api/clients", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newClientName.trim() }),
    });
    const data = await response.json().catch(() => null);

    if (!response.ok || !data) {
      setNewClientSaving(false);
      setFormMessage({
        type: "error",
        text: data?.error || "Failed to create client",
      });
      return;
    }

    setClients((prev) =>
      [...prev, data].sort((a, b) => a.name.localeCompare(b.name)),
    );
    setClientName(data.name);
    setNewClientName("");
    setFormMessage({ type: "success", text: `Client \"${data.name}\" added.` });
    setNewClientSaving(false);
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {formMessage && (
        <div
          className={cn(
            "rounded-lg border p-3 text-sm",
            formMessage.type === "error"
              ? "border-destructive/30 bg-destructive/10 text-destructive"
              : "border-emerald-400/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
          )}
        >
          {formMessage.text}
        </div>
      )}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Button
          variant="outline"
          onClick={() => router.push("/projects")}
          className="gap-2"
        >
          <ArrowLeft className="h-4 w-4" /> Back to Projects
        </Button>

        {mode === "view" && <div />}
      </div>

      <Card
        className={cn(
          isViewMode
            ? "border-0 bg-transparent shadow-none"
            : "glass border-border/60",
        )}
      >
        {!(mode === "view" && isViewMode) && (
          <CardHeader className="pb-4">
            <CardTitle className="text-2xl font-semibold">
              {mode === "create"
                ? "Create New Project"
                : name || "Project Details"}
            </CardTitle>
          </CardHeader>
        )}
        <CardContent className={cn(isViewMode && "p-0")}>
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : notFound ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <p className="text-lg font-medium text-muted-foreground">
                Project not found
              </p>
              <p className="text-sm text-muted-foreground mt-1">
                The project you&apos;re looking for doesn&apos;t exist or has
                been deleted.
              </p>
              <Button
                variant="outline"
                className="mt-4"
                onClick={() => router.push("/projects")}
              >
                Back to Projects
              </Button>
            </div>
          ) : isViewMode ? (
            <div className="space-y-4">
              <div className="rounded-xl border border-border/70 bg-gradient-to-br from-background/60 to-background/30 p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex min-w-0 items-center gap-2.5">
                    <div
                      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-border/60"
                      style={{ backgroundColor: `${projectColor}20` }}
                    >
                      <ProjectIcon
                        className="h-4 w-4"
                        style={{ color: projectColor }}
                      />
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-lg font-semibold">
                        {name || "Project Details"}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {projectTasks.length} tasks
                      </p>
                    </div>
                  </div>
                  <span
                    className={cn(
                      "inline-flex rounded-full px-2.5 py-1 text-xs font-medium capitalize",
                      projectStatusClass(status),
                    )}
                  >
                    {status.replace("-", " ")}
                  </span>
                </div>
              </div>

              <Tabs
                value={activeTab}
                onValueChange={(value) =>
                  isProjectDetailsTab(value) && setActiveTab(value)
                }
                defaultValue="tasks"
                className="space-y-3"
              >
                <TabsList className="grid h-auto w-full grid-cols-4 gap-1 border-0 bg-transparent p-0 lg:flex lg:items-center lg:justify-start lg:gap-2 lg:px-1 lg:rounded-none">
                  <TabsTrigger
                    value="tasks"
                    className="relative h-10 flex-col items-center justify-center gap-0.5 rounded-md border border-border/60 bg-muted/30 px-1 text-[9px] font-medium data-[state=active]:border-primary data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-sm data-[state=active]:ring-1 data-[state=active]:ring-primary/60 sm:h-10 sm:flex-row sm:justify-start sm:gap-2 sm:px-2 sm:text-xs lg:h-9 lg:flex-none lg:gap-1.5 lg:px-2.5 lg:text-sm lg:hover:bg-accent/40"
                  >
                    <ClipboardList className="h-3.5 w-3.5" />
                    <span>Tasks</span>
                    <Badge
                      variant="secondary"
                      className="absolute right-0.5 top-0.5 inline-flex h-3.5 min-w-3.5 items-center justify-center px-1 text-[8px] leading-none tabular-nums sm:static sm:h-5 sm:min-w-5 sm:px-1.5 sm:text-[10px]"
                    >
                      {projectTasks.length}
                    </Badge>
                  </TabsTrigger>
                  <TabsTrigger
                    value="members"
                    className="relative h-10 flex-col items-center justify-center gap-0.5 rounded-md border border-border/60 bg-muted/30 px-1 text-[9px] font-medium data-[state=active]:border-primary data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-sm data-[state=active]:ring-1 data-[state=active]:ring-primary/60 sm:h-10 sm:flex-row sm:justify-start sm:gap-2 sm:px-2 sm:text-xs lg:h-9 lg:flex-none lg:gap-1.5 lg:px-2.5 lg:text-sm lg:hover:bg-accent/40"
                  >
                    <Users className="h-3.5 w-3.5" />
                    <span>Members</span>
                    <Badge
                      variant="secondary"
                      className="absolute right-0.5 top-0.5 inline-flex h-3.5 min-w-3.5 items-center justify-center px-1 text-[8px] leading-none tabular-nums sm:static sm:h-5 sm:min-w-5 sm:px-1.5 sm:text-[10px]"
                    >
                      {displayAssignees.length}
                    </Badge>
                  </TabsTrigger>
                  <TabsTrigger
                    value="activities"
                    className="relative h-10 flex-col items-center justify-center gap-0.5 rounded-md border border-border/60 bg-muted/30 px-1 text-[9px] font-medium data-[state=active]:border-primary data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-sm data-[state=active]:ring-1 data-[state=active]:ring-primary/60 sm:h-10 sm:flex-row sm:justify-start sm:gap-2 sm:px-2 sm:text-xs lg:h-9 lg:flex-none lg:gap-1.5 lg:px-2.5 lg:text-sm lg:hover:bg-accent/40"
                  >
                    <Activity className="h-3.5 w-3.5" />
                    <span>Activities</span>
                    <Badge
                      variant="secondary"
                      className="absolute right-0.5 top-0.5 inline-flex h-3.5 min-w-3.5 items-center justify-center px-1 text-[8px] leading-none tabular-nums sm:static sm:h-5 sm:min-w-5 sm:px-1.5 sm:text-[10px]"
                    >
                      {projectActivities.length}
                    </Badge>
                  </TabsTrigger>
                  <TabsTrigger
                    value="about"
                    className="h-10 flex-col items-center justify-center gap-0.5 rounded-md border border-border/60 bg-muted/30 px-1 text-[9px] font-medium data-[state=active]:border-primary data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-sm data-[state=active]:ring-1 data-[state=active]:ring-primary/60 sm:h-10 sm:flex-row sm:justify-start sm:gap-2 sm:px-2 sm:text-xs lg:h-9 lg:flex-none lg:gap-1.5 lg:px-2.5 lg:text-sm lg:hover:bg-accent/40"
                  >
                    <CircleHelp className="h-3.5 w-3.5" />
                    <span>About</span>
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="tasks" className="space-y-2.5 sm:space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <p className="hidden text-sm text-muted-foreground sm:block">
                      Most relevant tasks first (overdue, active, then
                      remaining).
                    </p>
                    {projectId && (
                      <Button
                        size="sm"
                        className="h-8 bg-primary px-2.5 text-xs text-primary-foreground hover:bg-primary/90 sm:h-9 sm:px-3 sm:text-sm"
                        onClick={() =>
                          router.push(`/tasks?projectId=${projectId}`)
                        }
                      >
                        Open in Tasks
                      </Button>
                    )}
                  </div>

                  {tasksLoading ? (
                    <div className="rounded-xl border border-border/70 bg-gradient-to-br from-background/60 to-background/30 p-5">
                      <div className="flex items-center justify-center py-8">
                        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                      </div>
                    </div>
                  ) : projectTasks.length === 0 ? (
                    <div className="rounded-xl border border-border/70 bg-gradient-to-br from-background/60 to-background/30 p-5">
                      <p className="text-sm text-muted-foreground">
                        No tasks linked to this project yet.
                      </p>
                    </div>
                  ) : (
                    <div className="rounded-xl border border-border/70 bg-gradient-to-br from-background/60 to-background/30 p-4 sm:p-5 lg:p-6">
                      {(() => {
                        const bucketOrder: ProjectTimelineBucket[] = [
                          "overdue",
                          "today",
                          "upcoming",
                          "later",
                          "done",
                          "no_due",
                        ];
                        const bucketLabel: Record<
                          ProjectTimelineBucket,
                          string
                        > = {
                          overdue: "Overdue",
                          today: "Due Today",
                          upcoming: "Due in 1-7 Days",
                          later: "Later",
                          done: "Completed",
                          no_due: "No Due Date",
                        };

                        const bucketed = projectTasks.reduce<
                          Record<ProjectTimelineBucket, ProjectTask[]>
                        >(
                          (acc, task) => {
                            const dueInfo = getProjectTaskDueInfo(
                              task.due_date,
                              task.status,
                            );
                            acc[dueInfo.bucket].push(task);
                            return acc;
                          },
                          {
                            overdue: [],
                            today: [],
                            upcoming: [],
                            later: [],
                            done: [],
                            no_due: [],
                          },
                        );

                        return (
                          <div className="space-y-4 lg:space-y-5">
                            {bucketOrder.map((bucket) => {
                              const tasksInBucket = bucketed[bucket];
                              if (tasksInBucket.length === 0) return null;

                              return (
                                <div key={bucket} className="space-y-2.5">
                                  <div className="flex items-center justify-between">
                                    <h3 className="text-sm font-semibold">
                                      {bucketLabel[bucket]}
                                    </h3>
                                    <Badge
                                      variant="outline"
                                      className="text-xs"
                                    >
                                      {tasksInBucket.length}
                                    </Badge>
                                  </div>

                                  <div className="relative pl-4">
                                    <div
                                      className="pointer-events-none absolute bottom-2 left-1 top-2 w-px bg-border/70"
                                      aria-hidden="true"
                                    />
                                    <div className="space-y-2.5 lg:space-y-3">
                                      {tasksInBucket
                                        .slice()
                                        .sort((a, b) => {
                                          const aDue =
                                            parseDateValue(
                                              a.due_date || "",
                                            )?.getTime() ||
                                            Number.POSITIVE_INFINITY;
                                          const bDue =
                                            parseDateValue(
                                              b.due_date || "",
                                            )?.getTime() ||
                                            Number.POSITIVE_INFINITY;
                                          return aDue - bDue;
                                        })
                                        .map((task) => {
                                          const dueInfo = getProjectTaskDueInfo(
                                            task.due_date,
                                            task.status,
                                          );
                                          return (
                                            <div
                                              key={task.id}
                                              className="relative pl-4"
                                            >
                                              <span
                                                className={cn(
                                                  "absolute left-[-6px] top-3 h-3 w-3 rounded-full border-2 border-background",
                                                  dueInfo.bucket ===
                                                    "overdue" &&
                                                    "bg-destructive",
                                                  dueInfo.bucket === "today" &&
                                                    "bg-orange-500",
                                                  dueInfo.bucket ===
                                                    "upcoming" && "bg-blue-500",
                                                  dueInfo.bucket === "later" &&
                                                    "bg-muted-foreground",
                                                  dueInfo.bucket === "done" &&
                                                    "bg-emerald-500",
                                                  dueInfo.bucket === "no_due" &&
                                                    "bg-zinc-400",
                                                )}
                                                aria-hidden="true"
                                              />
                                              <button
                                                type="button"
                                                onClick={() => {
                                                  if (projectId) {
                                                    router.push(
                                                      `/tasks?projectId=${projectId}&taskId=${task.id}`,
                                                    );
                                                    return;
                                                  }
                                                  router.push(
                                                    `/tasks?taskId=${task.id}`,
                                                  );
                                                }}
                                                className="w-full rounded-lg border border-border/70 bg-card px-3 py-2.5 text-left transition-colors hover:bg-accent/30 lg:px-4 lg:py-3"
                                              >
                                                <div className="flex flex-wrap items-start justify-between gap-2">
                                                  <p
                                                    className={cn(
                                                      "text-sm font-medium",
                                                      task.status === "done" &&
                                                        "line-through text-muted-foreground",
                                                    )}
                                                  >
                                                    {task.title}
                                                  </p>
                                                  <Badge
                                                    variant="outline"
                                                    className={cn(
                                                      "capitalize text-[11px]",
                                                      taskPriorityClass(
                                                        task.priority,
                                                      ),
                                                    )}
                                                  >
                                                    {task.priority}
                                                  </Badge>
                                                </div>
                                                <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                                                  <Badge
                                                    variant="outline"
                                                    className={cn(
                                                      "capitalize text-[10px]",
                                                      taskStatusClass(
                                                        task.status,
                                                      ),
                                                    )}
                                                  >
                                                    {task.status.replace(
                                                      "-",
                                                      " ",
                                                    )}
                                                  </Badge>
                                                  <span className="inline-flex items-center gap-1 rounded-full border border-border/60 bg-muted/30 px-1.5 py-0.5 text-foreground/90">
                                                    <Users className="h-3 w-3" />
                                                    {task.assignee_member_id
                                                      ? memberNameById.get(
                                                          task.assignee_member_id,
                                                        ) || "Unknown"
                                                      : "Unassigned"}
                                                  </span>
                                                  <span
                                                    className={cn(dueInfo.tone)}
                                                  >
                                                    {dueInfo.label}
                                                  </span>
                                                </div>
                                              </button>
                                            </div>
                                          );
                                        })}
                                    </div>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        );
                      })()}
                    </div>
                  )}
                </TabsContent>

                <TabsContent
                  value="members"
                  className="space-y-2.5 sm:space-y-3"
                >
                  <div className="flex items-center justify-between gap-2">
                    <p className="hidden text-sm text-muted-foreground sm:block">
                      Assigned team members for this project.
                    </p>
                    {canEdit && (
                      <Button
                        size="sm"
                        variant={membersEditMode ? "destructive" : "default"}
                        className={
                          membersEditMode
                            ? "h-8 px-2.5 text-xs sm:h-9 sm:px-3 sm:text-sm"
                            : "h-8 bg-primary px-2.5 text-xs text-primary-foreground hover:bg-primary/90 sm:h-9 sm:px-3 sm:text-sm"
                        }
                        onClick={() => setMembersEditMode((open) => !open)}
                      >
                        {membersEditMode ? "Cancel" : "Edit Members"}
                      </Button>
                    )}
                  </div>

                  {membersEditMode ? (
                    <div className="space-y-2.5 sm:space-y-3">
                      <div className="grid max-h-56 gap-1 overflow-y-auto rounded-md border border-border/60 p-2">
                        {members.map((member) => {
                          const selected = memberIds.includes(member.id);
                          return (
                            <button
                              key={member.id}
                              type="button"
                              onClick={() => {
                                setMemberIds((prev) =>
                                  prev.includes(member.id)
                                    ? prev.filter((id) => id !== member.id)
                                    : [...prev, member.id],
                                );
                              }}
                              className={cn(
                                "flex items-center justify-between rounded-md border px-2 py-1.5 text-left text-xs transition-colors",
                                selected
                                  ? "border-primary/50 bg-primary/10 text-foreground"
                                  : "border-border/60 bg-background hover:bg-accent/30",
                              )}
                            >
                              <span className="truncate">{member.name}</span>
                              <span className="text-muted-foreground">
                                {selected ? "Assigned" : "Assign"}
                              </span>
                            </button>
                          );
                        })}
                      </div>
                      <div className="flex justify-end">
                        <Button
                          size="sm"
                          className="h-8 px-2.5 text-xs sm:h-9 sm:px-3 sm:text-sm"
                          onClick={saveMembersDetails}
                          disabled={savingMembers}
                        >
                          {savingMembers ? "Saving..." : "Save Members"}
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="rounded-xl border border-border/70 bg-gradient-to-br from-background/60 to-background/30 p-4 sm:p-5">
                      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        Project members
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {selectedMembers.length > 0 ? (
                          selectedMembers.map((member) => (
                            <button
                              key={member.id}
                              type="button"
                              onClick={() => router.push(`/team/${member.id}`)}
                              className="inline-flex items-center gap-2 rounded-full border border-border/70 bg-background/60 px-2 py-1 text-xs hover:border-primary/50 hover:bg-primary/10"
                            >
                              <MemberAvatar
                                name={member.name}
                                email={member.email}
                                avatarUrl={member.avatar_url}
                                sizeClass="h-6 w-6"
                                textClass="text-[9px]"
                              />
                              {member.name}
                            </button>
                          ))
                        ) : (
                          <p className="text-sm text-muted-foreground">
                            No members assigned.
                          </p>
                        )}
                      </div>

                      <p className="mb-2 mt-4 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        Task assignees
                      </p>
                      <div className="space-y-2">
                        {taskAssigneeSummary.length > 0 ? (
                          taskAssigneeSummary.map((summary) => (
                            <button
                              key={summary.memberId}
                              type="button"
                              onClick={() =>
                                router.push(`/team/${summary.memberId}`)
                              }
                              className="flex w-full items-center justify-between rounded-md border border-border/60 bg-background/60 p-2 text-left transition-colors hover:border-primary/50 hover:bg-primary/10"
                            >
                              <p className="text-xs font-medium sm:text-sm">
                                {summary.memberName}
                              </p>
                              <Badge variant="outline" className="text-[10px]">
                                {summary.count} task
                                {summary.count === 1 ? "" : "s"}
                              </Badge>
                            </button>
                          ))
                        ) : (
                          <p className="text-sm text-muted-foreground">
                            No task assignees yet.
                          </p>
                        )}
                      </div>
                    </div>
                  )}
                </TabsContent>

                <TabsContent
                  value="activities"
                  className="space-y-2.5 sm:space-y-3"
                >
                  <div className="rounded-xl border border-border/70 bg-gradient-to-br from-background/60 to-background/30 p-4 sm:p-5">
                    {activitiesLoading && projectActivities.length === 0 ? (
                      <div className="flex items-center justify-center py-8">
                        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                      </div>
                    ) : projectActivities.length === 0 ? (
                      <p className="text-sm text-muted-foreground">
                        No activity available yet.
                      </p>
                    ) : (
                      <>
                        <div className="relative pl-4 sm:pl-5">
                          <div className="pointer-events-none absolute bottom-2 left-[5px] top-1 w-px bg-border/70 sm:left-[7px]" />
                          <div className="space-y-2 sm:space-y-3">
                            {projectActivities.map((activity) => (
                              <div key={activity.id} className="relative">
                                <span
                                  className={cn(
                                    "pointer-events-none absolute -left-[15px] top-2.5 h-3 w-3 rounded-full border border-border bg-background sm:-left-[20px] sm:top-3 sm:h-3.5 sm:w-3.5",
                                    activity.tone === "success" &&
                                      "bg-emerald-400/80",
                                    activity.tone === "warn" &&
                                      "bg-amber-400/80",
                                    activity.tone === "neutral" &&
                                      "bg-zinc-400/80",
                                  )}
                                />
                                <div className="rounded-lg border border-border/60 bg-background/60 px-2.5 py-2 sm:px-3">
                                  <div className="flex flex-wrap items-center justify-between gap-2">
                                    <p className="text-xs font-semibold sm:text-sm">
                                      {activity.title}
                                    </p>
                                    <span className="text-[10px] text-muted-foreground sm:text-[11px]">
                                      {new Date(
                                        activity.timestamp,
                                      ).toLocaleString()}
                                    </span>
                                  </div>
                                  <p className="mt-1 text-xs text-muted-foreground">
                                    {activity.detail}
                                  </p>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>

                        {activitiesHasMore && (
                          <div className="mt-3 flex justify-end">
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              className="h-8 px-2.5 text-xs sm:h-9 sm:px-3 sm:text-sm"
                              onClick={loadMoreActivities}
                              disabled={activitiesLoading}
                            >
                              {activitiesLoading ? "Loading..." : "Load more"}
                            </Button>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                </TabsContent>

                <TabsContent value="about" className="space-y-2 sm:space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <p className="hidden text-sm text-muted-foreground sm:block">
                      Project details and metadata.
                    </p>
                    {canEdit && (
                      <Button
                        size="sm"
                        variant={aboutEditMode ? "destructive" : "default"}
                        className={
                          aboutEditMode
                            ? "h-8 px-2.5 text-xs sm:h-9 sm:px-3 sm:text-sm"
                            : "h-8 bg-primary px-2.5 text-xs text-primary-foreground hover:bg-primary/90 sm:h-9 sm:px-3 sm:text-sm"
                        }
                        onClick={() => setAboutEditMode((open) => !open)}
                      >
                        {aboutEditMode ? "Cancel" : "Edit Details"}
                      </Button>
                    )}
                  </div>

                  <div className="rounded-xl border border-border/70 bg-gradient-to-br from-background/60 to-background/30 p-4 sm:p-5">
                    {aboutEditMode && (
                      <div className="rounded-lg border border-border/70 bg-background/50 p-3 sm:p-4">
                        <UiLabel
                          htmlFor="project-about-name"
                          className="text-[10px] uppercase tracking-wide text-muted-foreground sm:text-[11px]"
                        >
                          Project Name
                        </UiLabel>
                        <Input
                          id="project-about-name"
                          className={cn(
                            "mt-1 h-8 text-xs sm:h-9 sm:text-sm",
                            nameError && "border-destructive",
                          )}
                          value={name}
                          onChange={(e) => {
                            setName(e.target.value);
                            if (nameError) setNameError("");
                          }}
                          placeholder="Enter project name"
                        />
                        {nameError && (
                          <p className="mt-1 text-xs text-destructive">
                            {nameError}
                          </p>
                        )}
                      </div>
                    )}

                    <div
                      className={cn(
                        "grid grid-cols-2 gap-2 sm:gap-3 md:gap-4",
                        aboutEditMode ? "xl:grid-cols-4" : "lg:grid-cols-2",
                      )}
                    >
                      <div
                        className={cn(
                          "order-1 col-span-2 rounded-lg border border-border/70 bg-background/50 p-3 sm:p-3.5",
                          aboutEditMode
                            ? "xl:col-span-2"
                            : "lg:col-span-1 lg:col-start-2 lg:order-2 lg:text-right",
                        )}
                      >
                        <UiLabel
                          className={cn(
                            "text-[10px] uppercase tracking-wide text-muted-foreground sm:text-[11px]",
                            !aboutEditMode && "lg:text-right",
                          )}
                        >
                          Date Range
                        </UiLabel>
                        {aboutEditMode ? (
                          <DateRangePicker
                            numberOfMonths={isDesktopWide ? 2 : 1}
                            showPresets={false}
                            className="mt-1 text-xs sm:text-sm [&_button]:h-8 [&_button]:text-xs sm:[&_button]:h-9 sm:[&_button]:text-sm"
                            date={dateRange}
                            onDateChange={(range) => {
                              setDateRange(range);
                              setStartDate(toDateValue(range?.from));
                              setDeadline(toDateValue(range?.to));
                            }}
                          />
                        ) : (
                          <p className="mt-1 text-xs font-medium sm:text-sm">
                            {toReadableDate(startDate)} to{" "}
                            {toReadableDate(deadline)}
                          </p>
                        )}
                      </div>

                      <div
                        className={cn(
                          "order-5 col-span-2 rounded-lg border border-border/70 bg-background/50 p-3 sm:p-3.5",
                          aboutEditMode
                            ? "xl:order-5 xl:col-span-2"
                            : "lg:col-span-1 lg:col-start-2 lg:order-5 lg:text-right",
                        )}
                      >
                        <UiLabel
                          className={cn(
                            "text-[10px] uppercase tracking-wide text-muted-foreground sm:text-[11px]",
                            !aboutEditMode && "lg:text-right",
                          )}
                        >
                          Labels
                        </UiLabel>
                        {aboutEditMode ? (
                          <div className="mt-1.5">
                            <LabelInput
                              labels={labelItems}
                              onChange={setLabelItems}
                            />
                          </div>
                        ) : (
                          <div className="mt-2 flex flex-wrap gap-1.5 lg:justify-end">
                            {labelItems.length > 0 ? (
                              labelItems.map((label) => (
                                <Badge
                                  key={label}
                                  variant="outline"
                                  className="text-xs"
                                >
                                  {label}
                                </Badge>
                              ))
                            ) : (
                              <span className="text-xs text-muted-foreground sm:text-sm">
                                No labels
                              </span>
                            )}
                          </div>
                        )}
                      </div>

                      {aboutEditMode && (
                        <div className="order-2 col-span-2 rounded-lg border border-border/70 bg-background/50 p-3 sm:p-3.5 xl:order-3 xl:col-span-1">
                          <UiLabel className="text-[10px] uppercase tracking-wide text-muted-foreground sm:text-[11px]">
                            Status
                          </UiLabel>
                          <Select
                            value={status}
                            onValueChange={(value) =>
                              setStatus(value as ProjectResponse["status"])
                            }
                          >
                            <SelectTrigger className="mt-1 h-8 text-xs sm:h-9 sm:text-sm">
                              <SelectValue placeholder="Select status" />
                            </SelectTrigger>
                            <SelectContent>
                              {PROJECT_STATUSES.map((item) => (
                                <SelectItem key={item} value={item}>
                                  <div className="flex items-center gap-2">
                                    <div
                                      className={cn(
                                        "h-2 w-2 rounded-full",
                                        STATUS_COLORS[item],
                                      )}
                                    />
                                    <span>
                                      {item
                                        .replace("-", " ")
                                        .charAt(0)
                                        .toUpperCase() +
                                        item.replace("-", " ").slice(1)}
                                    </span>
                                  </div>
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      )}

                      <div
                        className={cn(
                          "order-3 rounded-lg border border-border/70 bg-background/50 p-3 sm:p-3.5",
                          aboutEditMode
                            ? "xl:order-4"
                            : "lg:col-span-1 lg:col-start-2 lg:order-4 lg:text-right",
                        )}
                      >
                        <UiLabel
                          className={cn(
                            "text-[10px] uppercase tracking-wide text-muted-foreground sm:text-[11px]",
                            !aboutEditMode && "lg:text-right",
                          )}
                        >
                          Budget
                        </UiLabel>
                        {aboutEditMode ? (
                          <Input
                            type="number"
                            min="0"
                            className="mt-1 h-8 text-xs sm:h-9 sm:text-sm"
                            value={budget}
                            onChange={(e) => setBudget(e.target.value)}
                            placeholder="0.00"
                          />
                        ) : (
                          <p className="mt-1 text-xs font-medium sm:text-sm">
                            {budget
                              ? `$${Number(budget).toLocaleString()}`
                              : "-"}
                          </p>
                        )}
                      </div>

                      <div
                        className={cn(
                          "order-4 rounded-lg border border-border/70 bg-background/50 p-3 sm:p-3.5",
                          aboutEditMode
                            ? "xl:order-2 xl:col-span-2"
                            : "lg:col-span-1 lg:col-start-2 lg:order-3 lg:text-right",
                        )}
                      >
                        <UiLabel
                          className={cn(
                            "text-[10px] uppercase tracking-wide text-muted-foreground sm:text-[11px]",
                            !aboutEditMode && "lg:text-right",
                          )}
                        >
                          Client
                        </UiLabel>
                        {aboutEditMode ? (
                          <div className="mt-1">
                            <ClientPicker
                              value={clientName}
                              onChange={setClientName}
                              clients={clients}
                              size="compact"
                            />
                          </div>
                        ) : (
                          <p className="mt-1 text-xs font-medium sm:text-sm">
                            {getClientDisplayName(clientName)}
                          </p>
                        )}
                      </div>

                      <div
                        className={cn(
                          "order-6 col-span-2 rounded-lg border border-border/70 bg-background/50 p-3 sm:p-3.5",
                          aboutEditMode
                            ? "xl:col-span-4"
                            : "lg:col-span-1 lg:col-start-1 lg:row-span-4 lg:order-1",
                        )}
                      >
                        <UiLabel className="text-[10px] uppercase tracking-wide text-muted-foreground sm:text-[11px]">
                          Description
                        </UiLabel>
                        {aboutEditMode ? (
                          <div className="mt-1">
                            <MarkdownEditor
                              value={description}
                              onChange={setDescription}
                            />
                          </div>
                        ) : (
                          <>
                            <div
                              className={cn(
                                "prose prose-sm mt-1 max-w-none text-xs text-muted-foreground sm:text-sm",
                                !descriptionExpanded &&
                                  "max-h-24 overflow-hidden sm:max-h-40 lg:max-h-[34rem]",
                              )}
                              dangerouslySetInnerHTML={{
                                __html: description
                                  ? renderMarkdownHtml(
                                      descriptionExpanded
                                        ? description
                                        : descriptionPreview.preview,
                                    )
                                  : '<p class="text-muted-foreground">No description provided.</p>',
                              }}
                            />
                            {description && descriptionPreview.truncated && (
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                className="mt-2 h-8 px-2 text-xs"
                                onClick={() =>
                                  setDescriptionExpanded((value) => !value)
                                }
                              >
                                {descriptionExpanded
                                  ? "Show less"
                                  : "Show more"}
                              </Button>
                            )}
                          </>
                        )}
                      </div>
                    </div>

                    {aboutEditMode && (
                      <div className="mt-3 flex items-center justify-between">
                        {isAdmin ? (
                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            className="h-7 px-2 text-[11px] text-destructive hover:bg-destructive/10 hover:text-destructive"
                            onClick={onDelete}
                          >
                            <Trash2 className="mr-1 h-3.5 w-3.5" />
                            Delete project
                          </Button>
                        ) : (
                          <span />
                        )}
                        <Button
                          size="sm"
                          className="h-8 px-2.5 text-xs sm:h-9 sm:px-3 sm:text-sm"
                          onClick={saveAboutDetails}
                          disabled={savingAbout || !name.trim()}
                        >
                          {savingAbout ? "Saving..." : "Save Details"}
                        </Button>
                      </div>
                    )}
                  </div>
                </TabsContent>
              </Tabs>
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
                      onChange={(e) =>
                        setStatus(e.target.value as ProjectResponse["status"])
                      }
                      disabled={!editEnabled}
                      className="h-11 w-full rounded-lg border border-input bg-background px-4 py-2 text-sm transition-colors focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                    >
                      {PROJECT_STATUSES.map((item) => (
                        <option key={item} value={item}>
                          {item.replace("-", " ").charAt(0).toUpperCase() +
                            item.replace("-", " ").slice(1)}
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
                      numberOfMonths={2}
                      showPresets={false}
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
                      <span className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground">
                        $
                      </span>
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
                    {editEnabled && (
                      <div className="mt-2 flex flex-col gap-2 sm:flex-row">
                        <input
                          value={newClientName}
                          onChange={(e) => setNewClientName(e.target.value)}
                          placeholder="Quick add new client name"
                          className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm"
                        />
                        <Button
                          type="button"
                          variant="outline"
                          className="sm:w-auto"
                          onClick={onQuickCreateClient}
                          disabled={newClientSaving || !newClientName.trim()}
                        >
                          {newClientSaving ? "Adding..." : "Add client"}
                        </Button>
                      </div>
                    )}
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
                          onClick={() =>
                            setMemberIds((prev) =>
                              prev.filter((id) => id !== member.id),
                            )
                          }
                          className="group flex items-center gap-2 rounded-full border border-border/60 bg-background/60 pl-1.5 pr-3 py-1 text-sm transition-all hover:border-rose-500/50 hover:bg-rose-500/10"
                        >
                          <MemberAvatar
                            name={member.name}
                            email={member.email}
                            avatarUrl={member.avatar_url}
                            sizeClass="h-6 w-6"
                            textClass="text-[9px]"
                          />
                          <span className="text-xs font-medium">
                            {member.name}
                          </span>
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
                            onChange={(e) =>
                              setNewTaskPriority(
                                e.target.value as NewProjectTask["priority"],
                              )
                            }
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
                            onChange={(e) =>
                              setNewTaskAssigneeId(e.target.value || null)
                            }
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
                            {newTasks.length} task
                            {newTasks.length !== 1 ? "s" : ""} to create
                          </p>
                          {newTasks.map((task, index) => (
                            <div
                              key={index}
                              className="flex items-center justify-between gap-3 rounded-lg border border-border/60 bg-background px-4 py-3"
                            >
                              <div className="flex items-center gap-3 min-w-0">
                                <div
                                  className={cn(
                                    "h-2.5 w-2.5 rounded-full shrink-0",
                                    priorityColors[task.priority],
                                  )}
                                />
                                <span className="truncate text-sm font-medium">
                                  {task.title}
                                </span>
                                <Badge
                                  variant="outline"
                                  className="shrink-0 text-xs capitalize"
                                >
                                  {task.priority}
                                </Badge>
                                {task.due_date && (
                                  <span className="shrink-0 text-xs text-muted-foreground">
                                    Due {toReadableDate(task.due_date)}
                                  </span>
                                )}
                                {task.assignee_id && (
                                  <span className="shrink-0 text-xs text-muted-foreground">
                                    {members.find(
                                      (m) => m.id === task.assignee_id,
                                    )?.name || "Unknown"}
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
                      You can add tasks now or create them later from the
                      project page.
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
                          onClick={() =>
                            router.push(`/tasks?projectId=${projectId}`)
                          }
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
                        <p className="text-xs text-muted-foreground">
                          No tasks found for this project.
                        </p>
                      ) : (
                        projectTasks.map((task) => (
                          <div
                            key={task.id}
                            className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border/60 bg-background px-3 py-2.5 text-xs"
                          >
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-sm font-medium">
                                {task.title}
                              </p>
                              <p className="text-muted-foreground">
                                {task.priority.toUpperCase()}{" "}
                                {task.due_date ? `• Due ${task.due_date}` : ""}
                              </p>
                            </div>
                            <span className="capitalize text-muted-foreground shrink-0">
                              {task.status}
                            </span>
                          </div>
                        ))
                      )}
                    </div>
                  )}
                </div>
              )}

              {canEdit && editEnabled && (
                <div className="flex justify-end pt-4">
                  <Button
                    onClick={onSave}
                    disabled={saving}
                    size="lg"
                    className="gap-2 px-8"
                  >
                    {saving ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Save className="h-4 w-4" />
                    )}
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
