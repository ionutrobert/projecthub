import { NextRequest, NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { z } from "zod";

import { createClient } from "@/lib/supabase/server";
import { getRoleContext } from "@/lib/server-authz";

const createClientSchema = z.object({
  name: z.string().trim().min(1).max(160),
  contact_email: z.string().trim().email().nullable().optional(),
  contact_phone: z.string().trim().max(60).nullable().optional(),
  website: z.string().trim().max(240).nullable().optional(),
  company: z.string().trim().max(160).nullable().optional(),
  notes: z.string().trim().max(4000).nullable().optional(),
});

function isMissingClientsTable(message: string) {
  return message.includes("public.clients");
}

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data, error } = await supabase.from("clients").select("*").order("name", { ascending: true });

  if (error) {
    if (isMissingClientsTable(error.message)) {
      return NextResponse.json([]);
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data || []);
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { effectiveRole } = await getRoleContext(supabase, user.id);
  if (!["admin", "member"].includes(effectiveRole)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const parsed = createClientSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid client payload" }, { status: 400 });
  }

  const payload = parsed.data;
  const { data, error } = await supabase
    .from("clients")
    .insert({
      name: payload.name,
      contact_email: payload.contact_email || null,
      contact_phone: payload.contact_phone || null,
      website: payload.website || null,
      company: payload.company || null,
      notes: payload.notes || null,
    })
    .select("*")
    .single();

  if (error) {
    if (isMissingClientsTable(error.message)) {
      return NextResponse.json(
        {
          error: "Clients table is not set up yet. Add the clients table from supabase-schema.sql.",
        },
        { status: 400 },
      );
    }

    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  revalidateTag("clients", "max");
  revalidateTag("projects", "max");
  revalidateTag("reports", "max");

  return NextResponse.json(data, { status: 201 });
}
