import { NextRequest, NextResponse } from "next/server"
import { revalidateTag } from "next/cache"
import { z } from "zod"

import { createClient } from "@/lib/supabase/server"
import { getRoleContext } from "@/lib/server-authz"

const updateClientSchema = z.object({
  name: z.string().trim().min(1).max(160).optional(),
  contact_email: z.string().trim().email().nullable().optional(),
  contact_phone: z.string().trim().max(60).nullable().optional(),
  website: z.string().trim().max(240).nullable().optional(),
  company: z.string().trim().max(160).nullable().optional(),
  notes: z.string().trim().max(4000).nullable().optional(),
})

function isMissingClientsTable(message: string) {
  return message.includes("public.clients")
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
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

  const parsed = updateClientSchema.safeParse(await request.json())
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid client payload" }, { status: 400 })
  }

  const payload = parsed.data
  const { data, error } = await supabase
    .from("clients")
    .update({
      ...(payload.name ? { name: payload.name } : {}),
      ...(payload.contact_email !== undefined
        ? { contact_email: payload.contact_email || null }
        : {}),
      ...(payload.contact_phone !== undefined
        ? { contact_phone: payload.contact_phone || null }
        : {}),
      ...(payload.website !== undefined ? { website: payload.website || null } : {}),
      ...(payload.company !== undefined ? { company: payload.company || null } : {}),
      ...(payload.notes !== undefined ? { notes: payload.notes || null } : {}),
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .select("*")
    .single()

  if (error) {
    if (isMissingClientsTable(error.message)) {
      return NextResponse.json(
        {
          error: "Clients table is not set up yet. Add the clients table from supabase-schema.sql.",
        },
        { status: 400 },
      )
    }
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  revalidateTag("clients", "max")
  revalidateTag("projects", "max")
  revalidateTag("reports", "max")

  return NextResponse.json(data)
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { effectiveRole } = await getRoleContext(supabase, user.id)
  if (effectiveRole !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const { error } = await supabase.from("clients").delete().eq("id", id)

  if (error) {
    if (isMissingClientsTable(error.message)) {
      return NextResponse.json(
        {
          error: "Clients table is not set up yet. Add the clients table from supabase-schema.sql.",
        },
        { status: 400 },
      )
    }
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  revalidateTag("clients", "max")
  revalidateTag("projects", "max")
  revalidateTag("reports", "max")

  return NextResponse.json({ success: true })
}
