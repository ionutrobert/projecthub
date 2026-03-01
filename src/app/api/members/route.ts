import { NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { z } from "zod";
import { getRoleContext } from "@/lib/server-authz";

const createMemberSchema = z.object({
  name: z.string().min(1).max(120),
  email: z.string().email().max(200).nullable().optional(),
  role: z.string().min(1).max(80).nullable().optional(), // Job Title
});

export async function GET(request: Request) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, email, full_name, role, avatar_url")
    .eq("id", user.id)
    .single();

  if (profile) {
    // ... sync logic
  }

  // Get filter query params
  const url = new URL(request.url);
  const search = url.searchParams.get("search")?.toLowerCase() || "";
  const jobTitle = url.searchParams.get("jobTitle")?.toLowerCase() || "";

  // Build query
  let query = supabase
    .from("members")
    .select(
      "id, name, email, role, user_id, profiles:profiles!members_user_id_fkey(role, avatar_url)",
    )
    .order("name");

  // Apply text search filter (name, email)
  if (search) {
    query = query.or(`name.ilike.%${search}%,email.ilike.%${search}%`);
  }

  // Apply role (system_role) filter - will be applied after join, so filter in JS
  // Apply job title (role) filter - can be done at DB level on members.role
  if (jobTitle) {
    query = query.ilike("role", `%${jobTitle}%`);
  }

  const { data: members, error } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const currentUserEmail = (profile?.email || user.email || "")
    .trim()
    .toLowerCase();

  const normalizedMembers = (members || []).map((member) => {
    const joinedAvatar =
      Array.isArray(member.profiles) && member.profiles.length > 0
        ? member.profiles[0]?.avatar_url || null
        : (member.profiles as { avatar_url?: string | null } | null)
            ?.avatar_url || null;

    const normalizedMemberEmail = (member.email || "").trim().toLowerCase();
    const selfAvatar =
      normalizedMemberEmail && normalizedMemberEmail === currentUserEmail
        ? (profile?.avatar_url as string | null) || null
        : null;

    let systemRole: string | null = null;
    if (Array.isArray(member.profiles) && member.profiles[0]) {
      systemRole = (member.profiles[0] as { role?: string | null })?.role ?? null;
    } else if (member.profiles && typeof member.profiles === 'object' && 'role' in member.profiles) {
      systemRole = (member.profiles as { role?: string | null })?.role ?? null;
    }

    return {
      id: member.id,
      name: member.name,
      email: member.email,
      role: member.role,
      system_role: systemRole,
      user_id: member.user_id,
      avatar_url: joinedAvatar || selfAvatar,
    };
  });

  const dedupedMap = new Map<string, (typeof normalizedMembers)[number]>();

  for (const member of normalizedMembers) {
    const key = (member.email || member.name).trim().toLowerCase();
    const existing = dedupedMap.get(key);

    if (!existing) {
      dedupedMap.set(key, member);
      continue;
    }

    const existingScore =
      (existing.user_id ? 2 : 0) + (existing.avatar_url ? 1 : 0);

    const memberScore = (member.user_id ? 2 : 0) + (member.avatar_url ? 1 : 0);

    if (memberScore > existingScore) {
      dedupedMap.set(key, member);
    }
  }

  const uniqueMembers = Array.from(dedupedMap.values());

  return NextResponse.json(uniqueMembers);
}

export async function POST(request: Request) {
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
  const parsed = createMemberSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid member payload" },
      { status: 400 },
    );
  }

  const { name, email, role } = parsed.data;

  // Check for duplicate email if provided
  if (email) {
    const normalizedEmail = email.trim().toLowerCase();
    const { data: existingMember } = await supabase
      .from("members")
      .select("id, name")
      .ilike("email", normalizedEmail)
      .maybeSingle();

    if (existingMember) {
      return NextResponse.json(
        { error: `A member with email "${email}" already exists (${existingMember.name})` },
        { status: 409 },
      );
    }
  }

  const { data: member, error } = await supabase
    .from("members")
    .insert({
      name: name.trim(),
      email: email?.trim() || null,
      role: role?.trim() || "Developer",
    })
    .select("*")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  revalidateTag("members", "max");
  revalidateTag("team", "max");
  revalidateTag("dashboard", "max");

  return NextResponse.json(member, { status: 201 });
}
