type ProjectActivityEventType =
  | "project_created"
  | "project_updated"
  | "member_added"
  | "member_removed"
  | "task_created"
  | "task_deleted"
  | "task_status_changed"
  | "task_assignee_changed"

type LogProjectActivityInput = {
  projectId: string
  actorUserId: string
  eventType: ProjectActivityEventType
  message: string
  entityType?: "project" | "member" | "task"
  entityId?: string | null
  metadata?: Record<string, unknown>
}

type ProjectActivityRow = {
  id: string
  project_id: string
  actor_user_id: string
  event_type: ProjectActivityEventType
  entity_type: "project" | "member" | "task" | null
  entity_id: string | null
  message: string
  metadata: Record<string, unknown> | null
  created_at: string
}

type SupabaseInsertClient = {
  from: (table: string) => {
    insert: (values: Record<string, unknown>) => PromiseLike<{ error: { message?: string | null } | null }>
  }
}

type SupabaseSelectClient = {
  from: (table: string) => {
    select: (columns: string) => {
      eq: (column: string, value: string) => {
        order: (column: string, options?: { ascending?: boolean }) => {
          range: (
            from: number,
            to: number
          ) => PromiseLike<{ data: ProjectActivityRow[] | null; error: { message?: string | null } | null }>
        }
      }
    }
  }
}

const MISSING_TABLE_SENTINEL = "__MISSING_PROJECT_ACTIVITIES_TABLE__"

export function isMissingProjectActivitiesTableError(message: string) {
  return message.toLowerCase().includes("project_activities")
}

export async function logProjectActivity(
  supabase: unknown,
  input: LogProjectActivityInput
) {
  const client = supabase as SupabaseInsertClient

  const { error } = await client.from("project_activities").insert({
    project_id: input.projectId,
    actor_user_id: input.actorUserId,
    event_type: input.eventType,
    entity_type: input.entityType || null,
    entity_id: input.entityId || null,
    message: input.message,
    metadata: input.metadata || {},
  })

  if (!error) return null
  if (isMissingProjectActivitiesTableError(error.message || "")) {
    return MISSING_TABLE_SENTINEL
  }
  return error.message || "Failed to log project activity"
}

function parseDate(value: string) {
  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime()) ? null : parsed
}

function shouldSuppressStatusFlip(
  candidate: ProjectActivityRow,
  latestByTaskId: Map<string, Date>,
  thresholdMs: number
) {
  if (candidate.event_type !== "task_status_changed" || !candidate.entity_id) {
    return false
  }

  const createdAt = parseDate(candidate.created_at)
  if (!createdAt) {
    return false
  }

  const latest = latestByTaskId.get(candidate.entity_id)
  if (!latest) {
    latestByTaskId.set(candidate.entity_id, createdAt)
    return false
  }

  const withinSuppressionWindow = latest.getTime() - createdAt.getTime() <= thresholdMs
  if (!withinSuppressionWindow) {
    latestByTaskId.set(candidate.entity_id, createdAt)
    return false
  }

  return true
}

export async function listProjectActivities(
  supabase: unknown,
  projectId: string,
  options?: {
    offset?: number
    limit?: number
    statusNoiseWindowMinutes?: number
  }
) {
  const offset = Number.isFinite(options?.offset) && (options?.offset || 0) > 0 ? Math.floor(options?.offset || 0) : 0
  const limit = Number.isFinite(options?.limit) && (options?.limit || 0) > 0
    ? Math.min(Math.floor(options?.limit || 20), 100)
    : 20

  const suppressionWindowMinutes = Number.isFinite(options?.statusNoiseWindowMinutes)
    ? Math.max(0, options?.statusNoiseWindowMinutes || 0)
    : 10
  const thresholdMs = suppressionWindowMinutes * 60 * 1000

  const fetchUpperBound = Math.max(40, limit * 4)

  const client = supabase as SupabaseSelectClient

  const { data, error } = await client
    .from("project_activities")
    .select("*")
    .eq("project_id", projectId)
    .order("created_at", { ascending: false })
    .range(0, fetchUpperBound - 1)

  if (error) {
    if (isMissingProjectActivitiesTableError(error.message || "")) {
      return { data: null, error: MISSING_TABLE_SENTINEL }
    }
    return { data: null, error: error.message || "Failed to load project activities" }
  }

  const rows = Array.isArray(data) ? data : []
  const latestByTaskId = new Map<string, Date>()

  const filtered = rows.filter((row) => !shouldSuppressStatusFlip(row, latestByTaskId, thresholdMs))
  const sliced = filtered.slice(offset, offset + limit)

  return {
    data: sliced,
    error: null,
    hasMore: filtered.length > offset + limit,
  }
}

export function isProjectActivitiesUnavailableError(error: string | null) {
  return error === MISSING_TABLE_SENTINEL
}
