import { NextRequest, NextResponse } from "next/server"
import { revalidateTag } from "next/cache"
import { z } from "zod"

import { createClient } from "@/lib/supabase/server"
import { getRoleContext } from "@/lib/server-authz"

const reorderTaskSchema = z.object({
  id: z.string().uuid(),
  status: z.enum(["todo", "in-progress", "done"]),
  position: z.number().int().min(1),
})

const reorderPayloadSchema = z.object({
  updates: z.array(reorderTaskSchema).min(1),
})

function isMissingTasksTable(message: string) {
  return message.includes("public.tasks")
}

export async function PUT(request: NextRequest) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { effectiveRole } = await getRoleContext(supabase, user.id)
  if (!["admin", "member"].includes(effectiveRole)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const parsed = reorderPayloadSchema.safeParse(await request.json())
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid reorder payload" }, { status: 400 })
  }

  const updates = parsed.data.updates
  const updatedAt = new Date().toISOString()

  const updateResults = await Promise.all(
    updates.map(async (item) => {
      const { error } = await supabase
        .from("tasks")
        .update({
          status: item.status,
          position: item.position,
          updated_at: updatedAt,
        })
        .eq("id", item.id)

      return { id: item.id, error }
    })
  )

  const failed = updateResults.find((result) => result.error)
  if (failed?.error) {
    if (isMissingTasksTable(failed.error.message)) {
      return NextResponse.json(
        { error: "Tasks table is not set up yet. Run supabase-schema.sql to enable tasks." },
        { status: 400 }
      )
    }
    return NextResponse.json({ error: failed.error.message }, { status: 500 })
  }

  revalidateTag("tasks", "max")
  revalidateTag("projects", "max")
  revalidateTag("dashboard", "max")
  revalidateTag("reports", "max")

  return NextResponse.json({ success: true })
}
