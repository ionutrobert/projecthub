"use client"

interface Milestone {
  label: string
  date: string | null
  completed?: boolean
}

interface ProjectTimelineBarProps {
  startDate?: string | null
  deadline?: string | null
  progress?: number
  milestones?: Milestone[]
}

const clamp = (value: number) => Math.max(0, Math.min(100, value))

export default function ProjectTimelineBar({
  startDate,
  deadline,
  progress,
  milestones = [],
}: ProjectTimelineBarProps) {
  const start = startDate ? new Date(startDate) : undefined
  const end = deadline ? new Date(deadline) : undefined
  const now = new Date()
  const computedProgress = (() => {
    if (typeof progress === "number") return clamp(progress)
    if (start && end && end > start) {
      const total = end.getTime() - start.getTime()
      const elapsed = now.getTime() - start.getTime()
      return clamp((elapsed / total) * 100)
    }
    return 0
  })()

  const formatDate = (date?: Date) =>
    date ? date.toLocaleDateString(undefined, { month: "short", day: "numeric" }) : "—"

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-xs text-muted-foreground font-mono">
        <span>Start: {formatDate(start)}</span>
        <span>{computedProgress.toFixed(0)}% elapsed</span>
        <span>Due: {formatDate(end)}</span>
      </div>
      <div className="relative h-3 rounded-full bg-muted/40 overflow-hidden neon-track">
        <div
          className="absolute inset-y-0 left-0 rounded-full neon-fill"
          style={{ width: `${computedProgress}%` }}
        />
        <div
          className="absolute inset-y-0 left-0 w-full pointer-events-none"
          style={{ background: "transparent" }}
        >
          <div
            className="absolute top-1/2 -translate-y-1/2 h-5 w-5 left-[50%] text-transparent"
            style={{ transform: `translate(-50%, -50%)` }}
          />
        </div>
        {milestones.map((milestone) => {
          if (!milestone.date) return null
          const moment = new Date(milestone.date)
          if (!start || !end || end <= start) return null
          const offset = clamp(((moment.getTime() - start.getTime()) / (end.getTime() - start.getTime())) * 100)
          return (
            <div
              key={milestone.label}
              className="absolute -top-1 w-2 h-2 rounded-full border border-white/80 bg-transparent"
              style={{ left: `${offset}%` }}
              title={milestone.label}
            />
          )
        })}
      </div>
      {milestones.length > 0 && (
        <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
          {milestones.map((milestone) => (
            <span
              key={milestone.label}
              className={`px-2 py-1 rounded-full border text-[11px] ${
                milestone.completed ? "border-green-400 text-emerald-300" : "border-border"
              }`}
            >
              {milestone.label}
            </span>
          ))}
        </div>
      )}
    </div>
  )
}
