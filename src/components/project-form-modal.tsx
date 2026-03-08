"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import { type DateRange } from "react-day-picker";
import {
  CalendarDays,
  Check,
  ChevronsUpDown,
  Plus,
  X,
  Bold,
  Italic,
  Code,
  Link,
  List,
  Quote,
  FolderKanban,
  Zap,
  Globe,
  Database,
  Shield,
  Briefcase,
  Mail,
  Settings,
  Users,
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
import { DateRangePicker } from "@/components/ui/date-range-picker";
import { DatePicker } from "@/components/ui/date-picker";
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { renderMarkdownHtml } from "@/lib/markdown";
import MemberAvatar from "@/components/member-avatar";

type Member = {
  id: string;
  user_id?: string | null;
  name: string;
  email: string;
  role: string;
  avatar_url?: string | null;
};

type Client = {
  id: string;
  name: string;
};

interface Project {
  id: string;
  name: string;
  status: "active" | "in-progress" | "on-hold" | "completed" | "closed";
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

type ProjectStatus = "active" | "in-progress" | "on-hold" | "completed" | "closed";

const PROJECT_ICONS = [
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
] as const;

type ProjectIcon = (typeof PROJECT_ICONS)[number];

const STATUS_OPTIONS: ProjectStatus[] = [
  "active",
  "in-progress",
  "on-hold",
  "completed",
  "closed",
];

const STATUS_COLORS: Record<ProjectStatus, string> = {
  active: "bg-emerald-500",
  "in-progress": "bg-blue-500",
  "on-hold": "bg-amber-500",
  completed: "bg-violet-500",
  closed: "bg-zinc-500",
};

const PRESET_COLORS = [
  "#8B5CF6",
  "#EF4444",
  "#10B981",
  "#3B82F6",
  "#F59E0B",
];

// Icon map
const IconMap: Record<string, React.ComponentType<{ className?: string }>> = {
  FolderKanban: (props) => <FolderKanban {...props} />,
  Code: (props) => <Code {...props} />,
  Zap: (props) => <Zap {...props} />,
  Globe: (props) => <Globe {...props} />,
  Database: (props) => <Database {...props} />,
  Shield: (props) => <Shield {...props} />,
  Briefcase: (props) => <Briefcase {...props} />,
  Mail: (props) => <Mail {...props} />,
  Settings: (props) => <Settings {...props} />,
  Users: (props) => <Users {...props} />,
};

function IconPreview({ icon }: { icon: ProjectIcon }) {
  const IconComponent = IconMap[icon];
  return (
    <div className="flex items-center gap-2">
      {IconComponent && <IconComponent className="h-4 w-4" />}
      <span className="capitalize">{icon}</span>
    </div>
  );
}

// Markdown editor
function MarkdownEditor({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  const [preview, setPreview] = useState(false);

   const handleInsert = (prefix: string, after?: string) => {
     const el = document.getElementById("project-desc-textarea") as HTMLTextAreaElement;
     if (!el) return;
     const start = el.selectionStart;
     const end = el.selectionEnd;
     const selected = value.slice(start, end);
     const before = prefix;
     const afterWrap = after ?? "";
     const next = `${value.slice(0, start)}${before}${selected}${afterWrap}${value.slice(end)}`;
     onChange(next);
     requestAnimationFrame(() => {
       el.focus();
       el.selectionStart = start + before.length;
       el.selectionEnd = end + before.length;
     });
   };

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
               { label: "Bold", prefix: "**", after: "**", icon: Bold },
               { label: "Italic", prefix: "*", after: "*", icon: Italic },
               { label: "Code", prefix: "`", after: "`", icon: Code },
               { label: "Link", prefix: "[", after: "](https://)", icon: Link },
               { label: "H1", prefix: "# ", after: "", icon: null },
               { label: "List", prefix: "- ", after: "", icon: List },
               { label: "Quote", prefix: "> ", after: "", icon: Quote },
             ].map((item) => (
               <Button
                 key={item.label}
                 type="button"
                 size="sm"
                 variant="ghost"
                 className="h-7 px-2 text-xs"
                 onClick={() => handleInsert(item.prefix, item.after)}
               >
                 {item.icon ? <item.icon className="h-3.5 w-3.5" /> : <span className="text-[10px] font-medium">{item.label}</span>}
               </Button>
             ))}
           </div>
          <Textarea
            id="project-desc-textarea"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder="Write project description in Markdown..."
            rows={4}
            className="resize-y"
          />
        </div>
      )}
    </div>
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
  onSuccess?: (project: Project) => void;
  initialMembers: Member[];
  initialClients: Client[];
}) {
  const router = useRouter();
  const { profile } = useUser();
  const canEdit = profile?.role === "admin" || profile?.role === "member";

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form state
  const [name, setName] = useState("");
  const [status, setStatus] = useState<ProjectStatus>("active");
  const [dateRange, setDateRange] = useState<DateRange | undefined>(undefined);
  const [budget, setBudget] = useState("");
  const [clientName, setClientName] = useState("");
  const [clientPickerOpen, setClientPickerOpen] = useState(false);
  const clientInputRef = useRef<HTMLInputElement>(null);
  const [description, setDescription] = useState("");
  const [labels, setLabels] = useState<string[]>([]);
  const [labelInput, setLabelInput] = useState("");
  const [memberIds, setMemberIds] = useState<string[]>([]);
  const [projectColor, setProjectColor] = useState("#8B5CF6");
  const [projectIcon, setProjectIcon] = useState<ProjectIcon>("FolderKanban");

  // Tasks
  const [tasksOpen, setTasksOpen] = useState(false);
  const [newTasks, setNewTasks] = useState<
    { title: string; priority: "low" | "medium" | "high" | "urgent"; due_date: string | null; member_id: string | null }[]
  >([]);
  const [newTaskTitle, setNewTaskTitle] = useState("");
  const [newTaskPriority, setNewTaskPriority] = useState<"low" | "medium" | "high" | "urgent">("medium");
  const [newTaskDueDate, setNewTaskDueDate] = useState<Date | undefined>(undefined);
  const [newTaskMemberId, setNewTaskMemberId] = useState<string>("");

  // Customize section
  const [customizeOpen, setCustomizeOpen] = useState(false);

  // Form persistence key
  const FORM_STORAGE_KEY = "projecthub-new-project-form";

// Restore form state from sessionStorage when modal opens
useEffect(() => {
  if (open) {
    const saved = sessionStorage.getItem(FORM_STORAGE_KEY);
    if (saved) {
      try {
        const data = JSON.parse(saved);
        setName(data.name || "");
        setStatus(data.status || "active");
        setDateRange(data.dateRange || undefined);
        setBudget(data.budget || "");
        setClientName(data.clientName || "");
        setDescription(data.description || "");
        setLabels(data.labels || []);
        setMemberIds(data.memberIds || []);
        setProjectColor(data.projectColor || "#8B5CF6");
        setProjectIcon(data.projectIcon || "FolderKanban");
        setNewTasks(data.newTasks || []);
        setTasksOpen(data.tasksOpen || false);
        setCustomizeOpen(data.customizeOpen || false);
        setNewTaskTitle(data.newTaskTitle || "");
        setNewTaskPriority(data.newTaskPriority || "medium");
        setNewTaskDueDate(data.newTaskDueDate ? new Date(data.newTaskDueDate) : undefined);
        setNewTaskMemberId(data.newTaskMemberId || "");
      } catch {
        // Ignore parse errors
      }
    }
  }
}, [open]);

// Save form state before user leaves or switches tabs
useEffect(() => {
  if (!open) return;

  const saveFormState = () => {
    const data = {
      name,
      status,
      dateRange,
      budget,
      clientName,
      description,
      labels,
      memberIds,
      projectColor,
      projectIcon,
      newTasks,
      tasksOpen,
      customizeOpen,
      newTaskTitle,
      newTaskPriority,
      newTaskDueDate: newTaskDueDate ? newTaskDueDate.toISOString() : null,
      newTaskMemberId,
    };
    sessionStorage.setItem(FORM_STORAGE_KEY, JSON.stringify(data));
  };

  // Save when visibility changes (tab switch)
  const handleVisibilityChange = () => {
    if (document.visibilityState === 'hidden') {
      saveFormState();
    } else if (document.visibilityState === 'visible') {
      // Restore form when tab becomes visible again
      const saved = sessionStorage.getItem(FORM_STORAGE_KEY);
      if (saved) {
        try {
          const data = JSON.parse(saved);
          setName(data.name || "");
          setStatus(data.status || "active");
          setDateRange(data.dateRange || undefined);
          setBudget(data.budget || "");
          setClientName(data.clientName || "");
          setDescription(data.description || "");
          setLabels(data.labels || []);
          setMemberIds(data.memberIds || []);
          setProjectColor(data.projectColor || "#8B5CF6");
          setProjectIcon(data.projectIcon || "FolderKanban");
          setNewTasks(data.newTasks || []);
          setTasksOpen(data.tasksOpen || false);
          setCustomizeOpen(data.customizeOpen || false);
          setNewTaskTitle(data.newTaskTitle || "");
          setNewTaskPriority(data.newTaskPriority || "medium");
          setNewTaskDueDate(data.newTaskDueDate ? new Date(data.newTaskDueDate) : undefined);
          setNewTaskMemberId(data.newTaskMemberId || "");
        } catch {
          // Ignore parse errors
        }
      }
    }
  };

  // Save before page unload
  const handleBeforeUnload = () => {
    saveFormState();
  };

  document.addEventListener('visibilitychange', handleVisibilityChange);
  window.addEventListener('beforeunload', handleBeforeUnload);

  return () => {
    document.removeEventListener('visibilitychange', handleVisibilityChange);
    window.removeEventListener('beforeunload', handleBeforeUnload);
  };
}, [
  open,
  name,
  status,
  dateRange,
  budget,
  clientName,
  description,
  labels,
  memberIds,
  projectColor,
  projectIcon,
  newTasks,
  tasksOpen,
  customizeOpen,
  newTaskTitle,
  newTaskPriority,
  newTaskDueDate,
  newTaskMemberId,
]);

const resetForm = () => {
  setName("");
  setStatus("active");
  setDateRange(undefined);
  setBudget("");
  setClientName("");
  setDescription("");
  setLabels([]);
  setLabelInput("");
  setMemberIds([]);
  setProjectColor("#8B5CF6");
  setProjectIcon("FolderKanban");
  setNewTasks([]);
  setNewTaskTitle("");
  setNewTaskPriority("medium");
  setNewTaskDueDate(undefined);
  setNewTaskMemberId("");
  setError(null);
  setTasksOpen(false);
  setCustomizeOpen(false);
  setSaving(false);
  sessionStorage.removeItem(FORM_STORAGE_KEY);
};

const handleOpenChange = (newOpen: boolean) => {
  if (!newOpen) resetForm();
  onOpenChange(newOpen);
};

// Labels
  const handleAddLabel = () => {
    const trimmed = labelInput.trim().replace(/,/g, "");
    if (trimmed && !labels.includes(trimmed)) {
      setLabels([...labels, trimmed]);
    }
    setLabelInput("");
  };

// Tasks
const handleAddTask = () => {
  if (!newTaskTitle.trim()) return;
  setNewTasks([
    ...newTasks,
    {
      title: newTaskTitle.trim(),
      priority: newTaskPriority,
      due_date: newTaskDueDate ? format(newTaskDueDate, "yyyy-MM-dd") : null,
      member_id: newTaskMemberId || null,
    },
  ]);
  setNewTaskTitle("");
  setNewTaskPriority("medium");
  setNewTaskDueDate(undefined);
  setNewTaskMemberId("");
};

  const handleRemoveTask = (index: number) => {
    setNewTasks(newTasks.filter((_, i) => i !== index));
  };

  // Submit
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
      const start_date = dateRange?.from ? format(dateRange.from, "yyyy-MM-dd") : null;
      const deadline = dateRange?.to ? format(dateRange.to, "yyyy-MM-dd") : null;

      const projectResponse = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          status,
          start_date,
          deadline,
          budget: budget ? Number(budget) : null,
          client_name: clientName.trim() || null,
          description: description.trim() || null,
          labels: labels,
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

       if (newTasks.length > 0) {
         await Promise.all(
           newTasks.map((task) =>
             fetch("/api/tasks", {
               method: "POST",
               headers: { "Content-Type": "application/json" },
               body: JSON.stringify({
                 ...task,
                 project_id: projectId,
                 status: "todo",
               }),
             })
           )
         );
       }

       handleOpenChange(false);
       onSuccess?.(projectData);
       router.refresh();
    } catch (err) {
      console.error(err);
      setError("An unexpected error occurred");
      setSaving(false);
    }
  };

  const onQuickCreateClient = async (name: string): Promise<Client | null> => {
    if (!canEdit) return null;
    try {
      const res = await fetch("/api/clients", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data) return null;
      return data as Client;
    } catch {
      return null;
    }
  };

  const formatDateRange = () => {
    if (!dateRange?.from) return "Select date range";
    const from = format(dateRange.from, "MMM d, yyyy");
    if (!dateRange.to) return from;
    const to = format(dateRange.to, "MMM d, yyyy");
    return `${from} - ${to}`;
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="z-[220] max-h-[92vh] overflow-y-auto bg-background/95 p-0 sm:max-h-[90vh] sm:max-w-4xl [&>button]:hidden">
         <Card className="glass relative w-full border-0 bg-transparent shadow-none">
           {/* Sticky Header */}
           <CardHeader className="sticky top-0 z-20 border-b border-border/60 bg-background/90 backdrop-blur supports-[backdrop-filter]:bg-background/80 pb-2 sm:pb-3">
             <button
               type="button"
               aria-label="Close"
               className="absolute right-2 top-2 inline-flex h-7 w-7 items-center justify-center rounded-full border border-border bg-background/80 text-muted-foreground sm:right-3 sm:top-3 sm:h-8 sm:w-8"
               onClick={() => handleOpenChange(false)}
             >
               <span className="text-base leading-none">×</span>
             </button>
             <DialogTitle className="text-lg font-semibold pr-8 sm:pr-0">Create New Project</DialogTitle>
              {error && (
                <div className="mt-2 rounded-lg border border-destructive/30 bg-destructive/10 p-2.5 text-sm text-destructive">
                  {error}
                </div>
              )}
            </CardHeader>

            {/* Scrollable Content */}
            <CardContent className="p-6 pt-4 pb-24">
             <div className="grid grid-cols-1 xl:grid-cols-2 gap-x-8 gap-y-6">

               {/* Row 1 */}
               <div className="space-y-2">
                 <Label>
                   Name <span className="text-rose-500">*</span>
                 </Label>
                 <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Project name" />
               </div>
               <div className="space-y-2">
                 <Label>Status</Label>
                 <Select value={status} onValueChange={(v) => setStatus(v as ProjectStatus)}>
                   <SelectTrigger>
                     <SelectValue placeholder="Select status" />
                   </SelectTrigger>
                   <SelectContent>
                     {STATUS_OPTIONS.map((s) => (
                       <SelectItem key={s} value={s} className="capitalize">
                         <div className="flex items-center gap-2">
                           <span className={`h-2 w-2 rounded-full ${STATUS_COLORS[s]}`} />
                           <span>{s.replace("-", " ")}</span>
                         </div>
                       </SelectItem>
                     ))}
                   </SelectContent>
                 </Select>
               </div>

               {/* Row 2 */}
               <div className="space-y-2">
                 <Label>
                   <span className="sm:hidden">Date</span>
                   <span className="hidden sm:inline">Date Range</span>
                 </Label>
                 <DateRangePicker
                   date={dateRange}
                   onDateChange={setDateRange}
                   numberOfMonths={1}
                   showPresets={false}
                   className="[&_button]:h-10 [&_button]:text-sm"
                 />
                 <p className="text-xs text-muted-foreground">{formatDateRange()}</p>
               </div>
               <div className="space-y-2">
                 <Label>Team members</Label>
                 <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" className="w-full justify-between">
                        {memberIds.length > 0 ? (
                          <div className="flex items-center gap-2 truncate">
                            <div className="flex -space-x-2">
                              {initialMembers
                                .filter((m) => memberIds.includes(m.id))
                                .slice(0, 3)
                                .map((member) => (
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
                            </div>
                            {memberIds.length > 3 && (
                              <div className="flex h-6 w-6 items-center justify-center rounded-full bg-muted text-[8px]">
                                +{memberIds.length - 3}
                              </div>
                            )}
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
                        onWheel={(e) => e.stopPropagation()}
                        onTouchMove={(e) => e.stopPropagation()}
                      >
                       <Command>
                         <CommandInput placeholder="Search members..." className="no-global-focus-ring h-11 border-0 outline-none ring-0 pr-8 focus:ring-0 focus-visible:ring-0 focus-visible:outline-none" />
                        <CommandList className="max-h-[250px] overflow-y-auto">
                         <CommandEmpty>No members found.</CommandEmpty>
                         <CommandGroup>
                           {initialMembers.map((member) => (
                             <CommandItem
                               key={member.id}
                               value={`${member.name} ${member.email || ""}`}
                               onSelect={() => {
                                 if (memberIds.includes(member.id)) {
                                   setMemberIds(memberIds.filter((id) => id !== member.id));
                                 } else {
                                   setMemberIds([...memberIds, member.id]);
                                 }
                               }}
                             >
                               <Check className={cn("mr-2 h-4 w-4", memberIds.includes(member.id) ? "opacity-100" : "opacity-0")} />
                               <MemberAvatar
                                 name={member.name}
                                 email={member.email}
                                 avatarUrl={member.avatar_url}
                                 sizeClass="h-8 w-8"
                                 textClass="text-[10px]"
                               />
                               <div className="ml-2 flex flex-col">
                                 <span className="text-sm font-medium">{member.name}</span>
                                 {member.email && <span className="text-xs text-muted-foreground">{member.email}</span>}
                               </div>
                             </CommandItem>
                           ))}
                         </CommandGroup>
                       </CommandList>
                       {memberIds.length > 0 && (
                         <div className="border-t p-2">
                           <Button
                             type="button"
                             variant="ghost"
                             size="sm"
                             onClick={() => setMemberIds([])}
                             className="w-full text-xs text-muted-foreground hover:text-foreground"
                           >
                             Clear selection
                           </Button>
                         </div>
                       )}
                     </Command>
                   </PopoverContent>
                 </Popover>
               </div>

               {/* Row 3 */}
               <div className="space-y-2">
                 <Label>Client</Label>
                  <Popover open={clientPickerOpen} onOpenChange={setClientPickerOpen}>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        role="combobox"
                        aria-expanded={clientPickerOpen}
                        className="w-full justify-between"
                      >
                        {clientName ? <span className="truncate">{clientName}</span> : <span className="text-muted-foreground">Select client</span>}
                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                      </Button>
                    </PopoverTrigger>
                      <PopoverContent
                        className="w-[--radix-popover-trigger-width] max-h-[300px] overflow-y-auto p-0"
                        align="start"
                        onWheel={(e) => e.stopPropagation()}
                        onTouchMove={(e) => e.stopPropagation()}
                      >
                       <Command>
                         <CommandInput
                           ref={clientInputRef}
                           placeholder="Search or add client..."
                           className="no-global-focus-ring h-11 border-0 outline-none ring-0 pr-8 focus:ring-0 focus-visible:ring-0 focus-visible:outline-none"
                         />
                        <Button
                          type="button"
                          size="icon"
                          variant="ghost"
                          className="absolute right-0 top-0 h-9 w-8"
                          onClick={async () => {
                            const val = clientInputRef.current?.value || "";
                            if (val.trim()) {
                              const newClient = await onQuickCreateClient(val.trim());
                              if (newClient) {
                                setClientName(newClient.name);
                                setClientPickerOpen(false);
                                if (clientInputRef.current) clientInputRef.current.value = "";
                              }
                            }
                          }}
                        >
                          <Plus className="h-4 w-4" />
                        </Button>
                        <CommandList className="max-h-[200px] overflow-y-auto">
                          <CommandEmpty>No client found.</CommandEmpty>
                          <CommandGroup>
                            <CommandItem
                              value="__no_client__"
                              onSelect={() => {
                                setClientName("");
                                setClientPickerOpen(false);
                              }}
                            >
                              <Check className={cn("mr-2 h-4 w-4", !clientName ? "opacity-100" : "opacity-0")} />
                              <span>No client</span>
                            </CommandItem>
                            {initialClients.map((client) => (
                              <CommandItem
                                key={client.id}
                                value={client.name}
                                onSelect={() => {
                                  setClientName(client.name);
                                  setClientPickerOpen(false);
                                }}
                              >
                                <Check className={cn("mr-2 h-4 w-4", clientName === client.name ? "opacity-100" : "opacity-0")} />
                                <span>{client.name}</span>
                              </CommandItem>
                            ))}
                          </CommandGroup>
                        </CommandList>
                      </Command>
                    </PopoverContent>
                 </Popover>
               </div>
               <div className="space-y-2">
                 <Label>Budget</Label>
                 <div className="relative">
                   <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">$</span>
                   <Input
                     type="number"
                     min={0}
                     step="0.01"
                     value={budget}
                     onChange={(e) => setBudget(e.target.value)}
                     placeholder="0.00"
                     className="pl-7"
                   />
                 </div>
               </div>

                {/* Description */}
                <div className="md:col-span-2">
                  <MarkdownEditor value={description} onChange={setDescription} />
                </div>

               {/* Tasks */}
               <div className="border rounded-lg md:col-span-2">
                 <button
                   type="button"
                   onClick={() => setTasksOpen(!tasksOpen)}
                   className="w-full flex items-center justify-between p-4 text-left"
                 >
                   <div>
                     <h3 className="text-sm font-medium">Tasks (optional)</h3>
                     <p className="text-xs text-muted-foreground">Quick-add tasks with this project</p>
                   </div>
                   <ChevronsUpDown className={cn("h-4 w-4 transition-transform", tasksOpen && "rotate-180")} />
                 </button>

            {tasksOpen && (
              <div className="border-t p-4 space-y-4">
                <div className="space-y-2">
                  <Label>Add a task</Label>
                  <div className="space-y-2">
                    {/* Row 1: Title and Priority */}
                    <div className="grid gap-2 sm:grid-cols-2">
                      <input
                        value={newTaskTitle}
                        onChange={(e) => setNewTaskTitle(e.target.value)}
                        placeholder="Task title"
                        className="h-10 rounded-md border border-input bg-background px-3 text-sm"
                      />
                      <Select value={newTaskPriority} onValueChange={(v) => setNewTaskPriority(v as "low" | "medium" | "high" | "urgent")}>
                        <SelectTrigger className="h-10">
                          <SelectValue placeholder="Priority" />
                        </SelectTrigger>
                        <SelectContent>
                          {["low", "medium", "high", "urgent"].map((p) => (
                            <SelectItem key={p} value={p} className="capitalize">
                              {p}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    {/* Row 2: Due date, Assignee, and Add button */}
                    <div className="grid gap-2 sm:grid-cols-12">
                      <div className="sm:col-span-4">
                        <DatePicker
                          date={newTaskDueDate}
                          onDateChange={(date) => setNewTaskDueDate(date)}
                          placeholder="Due date"
                          className="[&_button]:h-10 [&_button]:text-sm"
                        />
                      </div>
                      <div className="sm:col-span-5">
                        <Popover>
                          <PopoverTrigger asChild>
                            <Button
                              variant="outline"
                              className="w-full justify-between h-10"
                            >
                              {newTaskMemberId ? (
                                <div className="flex items-center gap-2">
                                  {(() => {
                                    const member = initialMembers.find(m => m.id === newTaskMemberId);
                                    return member ? (
                                      <>
                                        <MemberAvatar
                                          name={member.name}
                                          email={member.email}
                                          avatarUrl={member.avatar_url}
                                          ring={false}
                                          sizeClass="h-5 w-5"
                                          textClass="text-[8px]"
                                        />
                                        <span>{member.name}</span>
                                      </>
                                    ) : (
                                      <span className="text-muted-foreground">Assign to...</span>
                                    );
                                  })()}
                                </div>
                              ) : (
                                <span className="text-muted-foreground">Assign to...</span>
                              )}
                              <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-[300px] p-0" align="start">
                            <Command>
                              <CommandInput 
                                placeholder="Search members..." 
                                className="no-global-focus-ring h-11 border-0 outline-none ring-0 pr-8 focus:ring-0 focus-visible:ring-0 focus-visible:outline-none" 
                              />
                              <CommandList className="max-h-[200px]">
                                <CommandEmpty>No members found.</CommandEmpty>
                                <CommandGroup>
                                  <CommandItem
                                    value="__unassigned__"
                                    onSelect={() => setNewTaskMemberId("")}
                                  >
                                    <Check className={cn("mr-2 h-4 w-4", !newTaskMemberId ? "opacity-100" : "opacity-0")} />
                                    <span>Unassigned</span>
                                  </CommandItem>
                                  {initialMembers.map((member) => (
                                    <CommandItem
                                      key={member.id}
                                      value={`${member.name} ${member.email || ""}`}
                                      onSelect={() => setNewTaskMemberId(member.id)}
                                    >
                                      <Check className={cn("mr-2 h-4 w-4", newTaskMemberId === member.id ? "opacity-100" : "opacity-0")} />
                                      <MemberAvatar
                                        name={member.name}
                                        email={member.email}
                                        avatarUrl={member.avatar_url}
                                        ring={false}
                                        sizeClass="h-6 w-6"
                                        textClass="text-[10px]"
                                      />
                                      <div className="ml-2 flex flex-col">
                                        <span className="text-sm">{member.name}</span>
                                        {member.email && (
                                          <span className="text-xs text-muted-foreground">{member.email}</span>
                                        )}
                                      </div>
                                    </CommandItem>
                                  ))}
                                </CommandGroup>
                              </CommandList>
                            </Command>
                          </PopoverContent>
                        </Popover>
                      </div>
                      <div className="sm:col-span-3">
                        <Button
                          type="button"
                          onClick={handleAddTask}
                          disabled={!newTaskTitle.trim()}
                          className="h-10 w-full"
                        >
                          <Plus className="h-4 w-4 mr-2" />
                          Add Task
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>

                {newTasks.length > 0 && (
                  <div className="space-y-2">
                    {newTasks.map((task, idx) => {
                      const assignedMember = task.member_id ? initialMembers.find(m => m.id === task.member_id) : null;
                      return (
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
                              {assignedMember && (
                                <span className="flex items-center gap-1">
                                  <MemberAvatar
                                    name={assignedMember.name}
                                    email={assignedMember.email}
                                    avatarUrl={assignedMember.avatar_url}
                                    ring={false}
                                    sizeClass="h-4 w-4"
                                    textClass="text-[6px]"
                                  />
                                  <span className="truncate max-w-[100px]">{assignedMember.name}</span>
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
                      );
                    })}
                  </div>
                )}
                   </div>
                 )}
               </div>

               {/* Customize */}
               <div className="border rounded-lg md:col-span-2">
                 <button
                   type="button"
                   onClick={() => setCustomizeOpen(!customizeOpen)}
                   className="w-full flex items-center justify-between p-4 text-left"
                 >
                   <div>
                     <h3 className="text-sm font-medium">Customize appearance</h3>
                     <p className="text-xs text-muted-foreground">Set project color, icon, and labels</p>
                   </div>
                   <ChevronsUpDown className={cn("h-4 w-4 transition-transform", customizeOpen && "rotate-180")} />
                 </button>

                 {customizeOpen && (
                   <div className="border-t p-4">
                     <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
                       {/* Color */}
                       <div className="space-y-2">
                         <Label>Color</Label>
                         <div className="flex gap-2">
                           <input
                             type="color"
                             value={projectColor}
                             onChange={(e) => setProjectColor(e.target.value)}
                             className="h-10 w-10 rounded-md border border-input cursor-pointer"
                           />
                           <Input value={projectColor} onChange={(e) => setProjectColor(e.target.value)} className="flex-1" />
                         </div>
                         <div className="flex flex-wrap gap-2 mt-2">
                           {PRESET_COLORS.map((color) => (
                             <button
                               key={color}
                               type="button"
                               onClick={() => setProjectColor(color)}
                               className={`h-6 w-6 rounded-full border ${projectColor === color ? "ring-2 ring-primary ring-offset-2" : "border-border"}`}
                               style={{ backgroundColor: color }}
                             />
                           ))}
                         </div>
                       </div>

                       {/* Icon */}
                       <div className="space-y-2">
                         <Label>Icon</Label>
                         <Select value={projectIcon} onValueChange={(v) => setProjectIcon(v as ProjectIcon)}>
                           <SelectTrigger>
                             <SelectValue placeholder="Select icon">
                               {projectIcon && <IconPreview icon={projectIcon} />}
                             </SelectValue>
                           </SelectTrigger>
                           <SelectContent>
                             {PROJECT_ICONS.map((icon) => (
                               <SelectItem key={icon} value={icon}>
                                 <IconPreview icon={icon as ProjectIcon} />
                               </SelectItem>
                             ))}
                           </SelectContent>
                         </Select>
                       </div>

                       {/* Labels */}
                       <div className="space-y-2">
                         <Label>Labels</Label>
                         <div className="flex flex-wrap gap-2 min-h-[42px] w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus-within:ring-2 focus-within:ring-primary/20">
                           {labels.map((label) => (
                             <Badge key={label} variant="secondary" className="flex items-center gap-1.5 h-7 px-2.5 py-0.5 text-xs font-medium">
                               {label}
                               <button
                                 type="button"
                                 onClick={() => setLabels(labels.filter((l) => l !== label))}
                                 className="ml-0.5 hover:text-rose-500 transition-colors"
                               >
                                 <X className="h-3 w-3" />
                               </button>
                             </Badge>
                           ))}
                         <input
                           value={labelInput}
                           onChange={(e) => setLabelInput(e.target.value)}
                           onKeyDown={(e) => {
                             if (e.key === "Enter" || e.key === ",") {
                               e.preventDefault();
                               handleAddLabel();
                             }
                           }}
                           onBlur={handleAddLabel}
                           placeholder={labels.length === 0 ? "Type and press Enter..." : ""}
                           className="flex-1 min-w-[120px] bg-transparent outline-none border-0 ring-0 focus:ring-0 focus-visible:ring-0 focus-visible:outline-none text-sm placeholder:text-muted-foreground"
                         />
                         </div>
                       </div>
                     </div>
                   </div>
                 )}
               </div>
             </div>
           </CardContent>

           {/* Sticky Footer */}
           <div className="sticky bottom-0 z-20 flex justify-end gap-2 border-t border-border/60 bg-background/90 p-2.5 sm:p-4">
             <Button variant="outline" onClick={() => handleOpenChange(false)} disabled={saving}>
               Cancel
             </Button>
             <Button onClick={onSave} disabled={saving || !name.trim()}>
               {saving ? "Creating..." : "Create Project"}
             </Button>
           </div>
        </Card>
      </DialogContent>
    </Dialog>
  );
}
