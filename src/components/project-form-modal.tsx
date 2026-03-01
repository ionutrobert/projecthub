"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import {
  Check,
  ChevronsUpDown,
  Plus,
  X,
  CalendarDays,
  XCircle,
  Building2,
} from "lucide-react";

import { useUser } from "@/components/user-provider";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { DatePicker } from "@/components/ui/date-picker";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
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

type NewTask = {
  title: string;
  priority: "low" | "medium" | "high" | "urgent";
  due_date: string | null;
  assignee_id: string | null;
};

type ProjectStatus = "active" | "in-progress" | "on-hold" | "completed" | "closed";
type ProjectIcon = "FolderKanban" | "Code" | "Zap" | "Globe" | "Database" | "Shield" | "Briefcase" | "Mail" | "Settings" | "Users";

const PROJECT_ICONS: ProjectIcon[] = [
  "FolderKanban",
  "Code",
  "Zap",
  "Globe",
  "Database",
  "Shield",
  "Briefcase",
  "Mail",
  "Settings",
  "Users",
];

const PRIORITIES: NewTask["priority"][] = ["low", "medium", "high", "urgent"];

// Label input component
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

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
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

// Client picker with quick create
function ClientPicker({
  value,
  onChange,
  clients,
  disabled,
  onQuickCreate,
}: {
  value: string;
  onChange: (value: string) => void;
  clients: Client[];
  disabled?: boolean;
  onQuickCreate: (name: string) => Promise<Client | null>;
}) {
  const [open, setOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [creating, setCreating] = useState(false);

  const selectedClient = clients.find((c) => c.name === value);

  const handleQuickCreate = async () => {
    if (!newName.trim()) return;
    setCreating(true);
    try {
      const newClient = await onQuickCreate(newName.trim());
      if (newClient) {
        onChange(newClient.name);
        setNewName("");
      }
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              role="combobox"
              disabled={disabled}
              aria-expanded={open}
              className="h-11 flex-1 justify-between hover:bg-accent/50"
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

        <div className="flex-1 flex gap-1">
          <Input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="New client name"
            className="h-11"
            disabled={disabled || creating}
          />
          <Button
            type="button"
            variant="secondary"
            size="icon"
            onClick={handleQuickCreate}
            disabled={disabled || creating || !newName.trim()}
            className="h-11 w-11"
          >
            <Plus className="h-4 w-4" />
          </Button>
        </div>
      </div>
      <p className="text-xs text-muted-foreground">
        Type to search, or enter name and click + to create client
      </p>
    </div>
  );
}

// Member picker (multi-select)
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

// Markdown editor with live preview toggle
function MarkdownEditor({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  const [preview, setPreview] = useState(false);

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <Label>Description</Label>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => setPreview(!preview)}
          className="h-7 text-xs"
        >
          {preview ? "Edit" : "Preview"}
        </Button>
      </div>
      {preview ? (
        <div className="rounded-lg border border-border bg-background/60 p-3 prose prose-sm max-w-none text-xs sm:text-sm">
          <div
            dangerouslySetInnerHTML={{
              __html: value.trim()
                ? renderMarkdownHtml(value)
                : "<p class=\"text-muted-foreground\">Nothing to preview yet.</p>",
            }}
          />
        </div>
      ) : (
        <div className="grid gap-2">
          <div className="flex flex-wrap items-center gap-1 rounded-md border border-border/60 bg-muted/30 p-1">
            {[
              { label: "Bold", prefix: "**" },
              { label: "Italic", prefix: "*" },
              { label: "Code", prefix: "`" },
              { label: "Link", prefix: "[", after: "](https://)" },
              { label: "H1", prefix: "# " },
              { label: "List", prefix: "- " },
              { label: "Quote", prefix: "> " },
            ].map((item) => (
              <Button
                key={item.label}
                type="button"
                size="sm"
                variant="ghost"
                className="h-7 px-2 text-xs"
                onClick={() => {
                  const el = document.getElementById("project-desc-textarea") as HTMLTextAreaElement;
                  if (!el) return;
                  const start = el.selectionStart;
                  const end = el.selectionEnd;
                  const selected = value.slice(start, end);
                  const before = item.prefix;
                  const after = item.after || before;
                  const next = `${value.slice(0, start)}${before}${selected}${after}${value.slice(end)}`;
                  onChange(next);
                  requestAnimationFrame(() => {
                    el.focus();
                    el.selectionStart = start + before.length;
                    el.selectionEnd = end + before.length;
                  });
                }}
              >
                {item.label}
              </Button>
            ))}
          </div>
          <textarea
            id="project-desc-textarea"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder="Write project description in Markdown..."
            rows={4}
            className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary resize-y"
          />
        </div>
      )}
    </div>
  );
}

// Icon Picker
function IconPicker({
  value,
  onChange,
  disabled,
}: {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}) {
  return (
    <Select value={value} onValueChange={(v) => onChange(v as ProjectIcon)} disabled={disabled}>
      <SelectTrigger className="h-10">
        <SelectValue placeholder="Select icon" />
      </SelectTrigger>
      <SelectContent>
        {PROJECT_ICONS.map((icon) => (
          <SelectItem key={icon} value={icon}>
            <div className="flex items-center gap-2">
              <span className="text-xs capitalize">{icon}</span>
            </div>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

export default function ProjectFormModal({
  open,
  onOpenChange,
  onSuccess,
  initialMembers = [],
  initialClients = [],
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
  initialMembers: Member[];
  initialClients: Client[];
}) {
  const router = useRouter();
  const { profile } = useUser();

  const canEdit = profile?.role === "admin" || profile?.role === "member";

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form fields
  const [name, setName] = useState("");
  const [status, setStatus] = useState<ProjectStatus>("active");
  const [startDate, setStartDate] = useState("");
  const [deadline, setDeadline] = useState("");
  const [budget, setBudget] = useState("");
  const [clientName, setClientName] = useState("");
  const [description, setDescription] = useState("");
  const [labelItems, setLabelItems] = useState<string[]>([]);
  const [memberIds, setMemberIds] = useState<string[]>([]);
  const [projectColor, setProjectColor] = useState("#8B5CF6");
  const [projectIcon, setProjectIcon] = useState<ProjectIcon>("FolderKanban");

  // Tasks
  const [tasksOpen, setTasksOpen] = useState(false);
  const [newTasks, setNewTasks] = useState<NewTask[]>([]);
  const [newTaskTitle, setNewTaskTitle] = useState("");
  const [newTaskPriority, setNewTaskPriority] = useState<NewTask["priority"]>("medium");
  const [newTaskDueDate, setNewTaskDueDate] = useState<string | null>(null);
  const [newTaskAssigneeId, setNewTaskAssigneeId] = useState<string | null>(null);

  const resetForm = () => {
    setName("");
    setStatus("active");
    setStartDate("");
    setDeadline("");
    setBudget("");
    setClientName("");
    setDescription("");
    setLabelItems([]);
    setMemberIds([]);
    setProjectColor("#8B5CF6");
    setProjectIcon("FolderKanban");
    setNewTasks([]);
    setNewTaskTitle("");
    setNewTaskPriority("medium");
    setNewTaskDueDate(null);
    setNewTaskAssigneeId(null);
    setError(null);
  };

  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen) {
      resetForm();
    }
    onOpenChange(newOpen);
  };

  const handleAddTask = () => {
    if (!newTaskTitle.trim()) return;
    setNewTasks((prev) => [
      ...prev,
      {
        title: newTaskTitle.trim(),
        priority: newTaskPriority,
        due_date: newTaskDueDate,
        assignee_id: newTaskAssigneeId,
      },
    ]);
    setNewTaskTitle("");
    setNewTaskPriority("medium");
    setNewTaskDueDate(null);
    setNewTaskAssigneeId(null);
  };

  const handleRemoveTask = (index: number) => {
    setNewTasks((prev) => prev.filter((_, i) => i !== index));
  };

  const onSave = async () => {
    setError(null);

    if (!name.trim()) {
      setError("Project name is required");
      return;
    }

    if (!canEdit) {
      setError("You do not have permission to create projects.");
      return;
    }

    setSaving(true);

    try {
      // Create project
      const projectResponse = await fetch("/api/projects", {
        method: "POST",
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
          member_ids: memberIds,
          color: projectColor,
          icon: projectIcon,
        }),
      });

      const projectData = await projectResponse.json().catch(() => null);

      if (!projectResponse.ok) {
        setError(projectData?.error || "Failed to create project");
        setSaving(false);
        return;
      }

      const projectId = projectData.id;

      // Create tasks if any
      if (newTasks.length > 0) {
        const taskPromises = newTasks.map((task) =>
          fetch("/api/tasks", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              ...task,
              project_id: projectId,
              status: "todo",
            }),
          })
        );
        await Promise.all(taskPromises);
      }

      // Success
      handleOpenChange(false);
      onSuccess?.();
      router.refresh();
    } catch (err) {
      console.error(err);
      setError("An unexpected error occurred");
      setSaving(false);
    }
  };

  const onQuickCreateClient = async (clientName: string): Promise<Client | null> => {
    if (!canEdit) return null;
    try {
      const response = await fetch("/api/clients", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: clientName.trim() }),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok || !data) {
        console.error("Failed to create client:", data?.error);
        return null;
      }
      return data as Client;
    } catch (err) {
      console.error("Failed to create client:", err);
      return null;
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Create New Project</DialogTitle>
          <DialogDescription>
            Add a new project. Required: name only. You can add tasks later.
          </DialogDescription>
        </DialogHeader>

        {/* Form */}
        <div className="flex-1 overflow-y-auto px-1 space-y-4">
          {error && (
            <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
              {error}
            </div>
          )}

          {/* Name (required) */}
          <div className="space-y-2">
            <Label>
              Name <span className="text-rose-500">*</span>
            </Label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Project name"
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            />
          </div>

          {/* Status */}
          <div className="space-y-2">
            <Label>Status</Label>
            <Select value={status} onValueChange={(v) => setStatus(v as ProjectStatus)}>
              <SelectTrigger className="h-10">
                <SelectValue placeholder="Select status" />
              </SelectTrigger>
              <SelectContent>
                {["active", "in-progress", "on-hold", "completed", "closed"].map((s) => (
                  <SelectItem key={s} value={s} className="capitalize">
                    {s.replace("-", " ")}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Dates */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Start date</Label>
              <DatePicker
                date={startDate ? new Date(startDate) : undefined}
                onDateChange={(date) => setStartDate(date ? format(date, "yyyy-MM-dd") : "")}
              />
            </div>
            <div className="space-y-2">
              <Label>Deadline</Label>
              <DatePicker
                date={deadline ? new Date(deadline) : undefined}
                onDateChange={(date) => setDeadline(date ? format(date, "yyyy-MM-dd") : "")}
              />
            </div>
          </div>

          {/* Budget */}
          <div className="space-y-2">
            <Label>Budget</Label>
            <Input
              type="number"
              min={0}
              step="0.01"
              value={budget}
              onChange={(e) => setBudget(e.target.value)}
              placeholder="0.00"
            />
          </div>

          {/* Client */}
          <div className="space-y-2">
            <Label>Client</Label>
            <ClientPicker
              value={clientName}
              onChange={setClientName}
              clients={initialClients}
              onQuickCreate={onQuickCreateClient}
            />
            {clientName === "" && (
              <p className="text-xs text-muted-foreground">Leave empty for internal project</p>
            )}
          </div>

          {/* Description */}
          <MarkdownEditor value={description} onChange={setDescription} />

          {/* Labels */}
          <div className="space-y-2">
            <Label>Labels</Label>
            <LabelInput labels={labelItems} onChange={setLabelItems} />
          </div>

          {/* Members */}
          <div className="space-y-2">
            <Label>Team members</Label>
            <MemberPicker
              selectedIds={memberIds}
              onChange={setMemberIds}
              members={initialMembers}
            />
          </div>

          {/* Color & Icon */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Color</Label>
              <div className="flex gap-2">
                <input
                  type="color"
                  value={projectColor}
                  onChange={(e) => setProjectColor(e.target.value)}
                  className="h-10 w-10 rounded-md border border-input cursor-pointer"
                />
                <Input
                  value={projectColor}
                  onChange={(e) => setProjectColor(e.target.value)}
                  className="h-10 flex-1"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Icon</Label>
              <IconPicker value={projectIcon} onChange={(v) => setProjectIcon(v as ProjectIcon)} />
            </div>
          </div>

          {/* Tasks */}
          <div className="border rounded-lg">
            <button
              type="button"
              onClick={() => setTasksOpen(!tasksOpen)}
              className="w-full flex items-center justify-between p-4 text-left"
            >
              <div>
                <h3 className="text-sm font-medium">Tasks (optional)</h3>
                <p className="text-xs text-muted-foreground">
                  Quick-add tasks with this project
                </p>
              </div>
              <ChevronsUpDown className={cn("h-4 w-4 transition-transform", tasksOpen && "rotate-180")} />
            </button>

            {tasksOpen && (
              <div className="border-t p-4 space-y-4">
                <div className="space-y-2">
                  <Label>Add a task</Label>
                  <div className="grid gap-2 sm:grid-cols-12">
                    <input
                      value={newTaskTitle}
                      onChange={(e) => setNewTaskTitle(e.target.value)}
                      placeholder="Task title"
                      className="sm:col-span-5 h-10 rounded-md border border-input bg-background px-3 text-sm"
                    />
                    <Select value={newTaskPriority} onValueChange={(v) => setNewTaskPriority(v as NewTask["priority"])}>
                      <SelectTrigger className="sm:col-span-3 h-10">
                        <SelectValue placeholder="Priority" />
                      </SelectTrigger>
                      <SelectContent>
                        {PRIORITIES.map((p) => (
                          <SelectItem key={p} value={p} className="capitalize">
                            {p}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <DatePicker
                      date={newTaskDueDate ? new Date(newTaskDueDate) : undefined}
                      onDateChange={(date) => setNewTaskDueDate(date ? format(date, "yyyy-MM-dd") : null)}
                      className="sm:col-span-3"
                    />
                    <div className="sm:col-span-1">
                      <Button
                        type="button"
                        size="icon"
                        onClick={handleAddTask}
                        disabled={!newTaskTitle.trim()}
                        className="h-10 w-full sm:w-10"
                      >
                        <Plus className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </div>

                {newTasks.length > 0 && (
                  <div className="space-y-2">
                    {newTasks.map((task, idx) => (
                      <div key={idx} className="flex items-center gap-2 rounded-md border p-2">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{task.title}</p>
                          <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1">
                            <Badge variant="outline" className="capitalize text-[10px]">
                              {task.priority}
                            </Badge>
                            {task.due_date && (
                              <span className="flex items-center gap-1">
                                <CalendarDays className="h-3 w-3" />
                                {task.due_date}
                              </span>
                            )}
                          </div>
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => handleRemoveTask(idx)}
                          className="h-8 w-8 p-0"
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        <DialogFooter className="sticky bottom-0 bg-background pt-4 mt-2 border-t">
          <Button variant="outline" onClick={() => handleOpenChange(false)} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={onSave} disabled={saving || !name.trim()}>
            {saving ? "Creating..." : "Create Project"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
