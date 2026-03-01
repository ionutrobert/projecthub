import { NextRequest, NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { createClient as createSupabaseAdminClient } from "@supabase/supabase-js";
import { z } from "zod";

import { createClient } from "@/lib/supabase/server";
import { getRoleContext } from "@/lib/server-authz";

function getAdminClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    return null;
  }

  return createSupabaseAdminClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

const updateMemberSchema = z.object({
  name: z.string().min(1).max(120).optional(),
  email: z.string().email().max(200).nullable().optional(),
  role: z.string().min(1).max(80).optional(), // Job Title
  system_role: z.enum(["admin", "member", "viewer"]).optional(), // Permissions
  avatar_url: z.string().url().or(z.literal("initials")).nullable().optional(),
  password: z.string().min(8).max(128).optional(),
});

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("email,avatar_url")
    .eq("id", user.id)
    .maybeSingle();

  const { data: member, error } = await supabase
    .from("members")
    .select(
      "id, name, email, role, user_id, created_at, profiles:profiles!members_user_id_fkey(role, avatar_url)",
    )
    .eq("id", id)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (!member) {
    return NextResponse.json({ error: "Member not found" }, { status: 404 });
  }

  const joinedAvatar =
    Array.isArray(member.profiles) && member.profiles.length > 0
      ? member.profiles[0]?.avatar_url || null
      : (member.profiles as { avatar_url?: string | null } | null)
          ?.avatar_url || null;

  const normalizedMemberEmail = (member.email || "").trim().toLowerCase();
  const normalizedProfileEmail = (profile?.email || user.email || "")
    .trim()
    .toLowerCase();
  const selfAvatar =
    normalizedMemberEmail && normalizedMemberEmail === normalizedProfileEmail
      ? (profile?.avatar_url as string | null) || null
      : null;

  let systemRole: string | null = null;
  if (Array.isArray(member.profiles) && member.profiles[0]) {
    systemRole = (member.profiles[0] as { role?: string | null })?.role ?? null;
  } else if (member.profiles && typeof member.profiles === 'object' && 'role' in member.profiles) {
    systemRole = (member.profiles as { role?: string | null })?.role ?? null;
  }

  return NextResponse.json({
    id: member.id,
    name: member.name,
    email: member.email,
    role: member.role, // Job Title
    system_role: systemRole,
    user_id: member.user_id,
    avatar_url: joinedAvatar || selfAvatar,
    created_at: member.created_at,
  });
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
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

  const body = await request.json();
  const parsed = updateMemberSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid member payload" },
      { status: 400 },
    );
  }

  const { data: existingMember } = await supabase
    .from("members")
    .select("id,user_id,email")
    .eq("id", id)
    .maybeSingle();

  if (!existingMember) {
    return NextResponse.json({ error: "Member not found" }, { status: 404 });
  }

  const { data, error } = await supabase
    .from("members")
    .update({
      ...(parsed.data.name ? { name: parsed.data.name.trim() } : {}),
      ...(parsed.data.role ? { role: parsed.data.role.trim() } : {}),
      ...(parsed.data.email !== undefined
        ? { email: parsed.data.email?.trim() || null }
        : {}),
    })
    .eq("id", id)
    .select("*")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (existingMember.user_id) {
    const adminClient = getAdminClient();
    if (adminClient) {
      const updates: {
        email?: string;
        password?: string;
        user_metadata?: Record<string, string>;
      } = {};

      if (parsed.data.email !== undefined && parsed.data.email?.trim()) {
        updates.email = parsed.data.email.trim().toLowerCase();
      }
      if (parsed.data.password) {
        updates.password = parsed.data.password;
      }
      if (
        parsed.data.name !== undefined ||
        parsed.data.avatar_url !== undefined
      ) {
        updates.user_metadata = {
          ...(parsed.data.name !== undefined
            ? { full_name: parsed.data.name.trim() }
            : {}),
          ...(parsed.data.avatar_url !== undefined
            ? { avatar_url: parsed.data.avatar_url || "" }
            : {}),
        };
      }

      if (Object.keys(updates).length > 0) {
        await adminClient.auth.admin.updateUserById(existingMember.user_id, {
          ...updates,
          ...(updates.email ? { email_confirm: true } : {}),
        });
      }

      if (
        parsed.data.name !== undefined ||
        parsed.data.email !== undefined ||
        parsed.data.system_role !== undefined ||
        parsed.data.avatar_url !== undefined
      ) {
        await adminClient.from("profiles").upsert(
          {
            id: existingMember.user_id,
            ...(parsed.data.name !== undefined
              ? { full_name: parsed.data.name.trim() }
              : {}),
            ...(parsed.data.email !== undefined
              ? { email: parsed.data.email?.trim().toLowerCase() || null }
              : {}),
            ...(parsed.data.system_role !== undefined
              ? { role: parsed.data.system_role }
              : {}),
            ...(parsed.data.avatar_url !== undefined
              ? { avatar_url: parsed.data.avatar_url || null }
              : {}),
          },
          { onConflict: "id" },
        );
      }
    }
  }

  revalidateTag("members", "max");
  revalidateTag("team", "max");
  revalidateTag("dashboard", "max");

  return NextResponse.json(data);
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { effectiveRole } = await getRoleContext(supabase, user.id);
  if (effectiveRole !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { data: targetMember } = await supabase
    .from("members")
    .select("id,user_id")
    .eq("id", id)
    .maybeSingle();

  if (!targetMember) {
    return NextResponse.json({ error: "Member not found" }, { status: 404 });
  }

  if (targetMember.user_id) {
    const adminClient = getAdminClient();
    if (!adminClient) {
      return NextResponse.json(
        { error: "Server is missing SUPABASE_SERVICE_ROLE_KEY configuration" },
        { status: 500 },
      );
    }

    const { error: authDeleteError } = await adminClient.auth.admin.deleteUser(
      targetMember.user_id,
    );
    if (authDeleteError) {
      return NextResponse.json(
        { error: authDeleteError.message },
        { status: 500 },
      );
    }

    await adminClient.from("profiles").delete().eq("id", targetMember.user_id);
  }

  const { error } = await supabase.from("members").delete().eq("id", id);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  revalidateTag("members", "max");
  revalidateTag("team", "max");
  revalidateTag("dashboard", "max");

  return NextResponse.json({ success: true });
}
