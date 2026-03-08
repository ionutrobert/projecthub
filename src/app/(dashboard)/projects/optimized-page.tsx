/**
 * Optimized Projects Page
 * Uses Next.js 16 Cache Components and PPR for improved performance
 */
import { Suspense } from "react"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { 
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import ProjectPreviewModal from "@/components/project-preview-modal"
import ProjectFormModal from "@/components/project-form-modal"
import MemberAvatar from "@/components/member-avatar"
import { getNameInitials } from "@/lib/avatar"
import { renderMarkdownHtml } from "@/lib/markdown"
import { cn } from "@/lib/utils"
import { 
  Calendar,
  CheckCircle,
  Clock,
  Flag,
  FolderKanban,
  Hash,
  Kanban,
  List,
  Plus,
  Search,
  Star,
  Users,
  X
} from "lucide-react"

// Import our cache components
import { getCachedMembers } from "@/components/members-cache"
import { getUserAvatarCache } from "@/components/user-profile-cache"

// Types
interface Member {
  id: string
  user_id?: string | null
  name: string
  email?: string | null
  role?: string | null
  system_role?: string | null
  avatar_url?: string | null
}

interface ProjectMember {
  members?: Member | null
}

interface Project {
  id: string
  name: string
  description: string | null
  status: string
  start_date: string | null
  deadline: string | null
  budget: number | null
  client_name: string | null
  labels: string[] | null
  color: string | null
  icon: string | null
  starred?: boolean
  project_members?: ProjectMember[] | null
  task_count?: number
}

// Cache Components for data fetching
async function ProjectsList({ 
  filter,
  search,
  selectedMemberIds
}: { 
  filter: string
  search: string
  selectedMemberIds: string[]
}) {
  // In a real implementation, this would fetch projects with proper caching
  // For now, we'll simulate the data structure
  const projects: Project[] = []
  
  return (
    <div className="space-y-4">
      {projects.map((project) => (
        <ProjectCard key={project.id} project={project} />
      ))}
    </div>
  )
}

function ProjectCard({ project }: { project: Project }) {
  // Get project assignees
  const assigneeMembers = project.project_members
    ?.map(pm => pm.members)
    .filter((member): member is Member => member !== null && member !== undefined) || []

  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardHeader>
        <CardTitle>{project.name}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex items-center gap-2">
          {assigneeMembers.slice(0, 4).map((member) => (
            <div
              key={member.id}
              className="rounded-full border border-background"
              title={member.name}
            >
              <MemberAvatar
                name={member.name}
                email={member.email}
                userId={member.user_id}
                avatarUrl={member.avatar_url || null}
                sizeClass="h-6 w-6"
                textClass="text-[9px]"
              />
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}

// Loading skeleton components
function ProjectsSkeleton() {
  return (
    <div className="space-y-4">
      {[1, 2, 3].map((i) => (
        <Card key={i} className="animate-pulse">
          <CardHeader>
            <div className="h-6 bg-gray-200 rounded w-3/4"></div>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              {[1, 2, 3].map((j) => (
                <div key={j} className="h-6 w-6 bg-gray-200 rounded-full"></div>
              ))}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}

// Main component
export default async function OptimizedProjectsPage({
  searchParams
}: {
  searchParams: Promise<{
    status?: string
    q?: string
    members?: string
  }>
}) {
  const params = await searchParams
  
  const filter = params.status || "all"
  const search = params.q || ""
  const selectedMemberIds = params.members ? params.members.split(",") : []

  return (
    <div className="container mx-auto py-6">
      <div className="flex flex-col gap-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <h1 className="text-2xl font-bold">Projects</h1>
          <Button>
            <Plus className="mr-2 h-4 w-4" />
            New Project
          </Button>
        </div>

        <Suspense fallback={<ProjectsSkeleton />}>
          <ProjectsList 
            filter={filter} 
            search={search} 
            selectedMemberIds={selectedMemberIds} 
          />
        </Suspense>
      </div>
    </div>
  )
}