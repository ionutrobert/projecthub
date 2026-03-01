import { NextRequest, NextResponse } from "next/server";
import { createClient as createSupabaseAdminClient } from "@supabase/supabase-js";
import { z } from "zod";

import { createClient } from "@/lib/supabase/server";
import { getRoleContext } from "@/lib/server-authz";
import { revalidateTag } from "next/cache";

const createUserSchema = z.object({
  name: z.string().min(1).max(120),
  email: z.string().email().max(200),
  password: z.string().min(8).max(128),
  system_role: z.enum(["admin", "member", "viewer"]).optional(),
  job_title: z.string().min(1).max(80).optional(),
  avatar_url: z.string().url().nullable().optional(),
});

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

async function findAuthUserIdByEmail(
  adminClient: NonNullable<ReturnType<typeof getAdminClient>>,
  email: string,
) {
  const normalizedEmail = email.trim().toLowerCase();
  const perPage = 200;

  for (let page = 1; page <= 10; page += 1) {
    const { data, error } = await adminClient.auth.admin.listUsers({
      page,
      perPage,
    });

    if (error) {
      return { userId: null as string | null, error };
    }

    const users = data?.users || [];
    const existingUser = users.find(
      (candidate) => candidate.email?.trim().toLowerCase() === normalizedEmail,
    );

    if (existingUser?.id) {
      return { userId: existingUser.id, error: null };
    }

    if (users.length < perPage) {
      break;
    }
  }

  return { userId: null as string | null, error: null };
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const roleContext = await getRoleContext(supabase, user.id);
  if (roleContext.actualRole !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const parsed = createUserSchema.safeParse(
    await request.json().catch(() => null),
  );
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid user payload" },
      { status: 400 },
    );
  }

  const adminClient = getAdminClient();
  if (!adminClient) {
    return NextResponse.json(
      { error: "Server is missing SUPABASE_SERVICE_ROLE_KEY configuration" },
      { status: 500 },
    );
  }

  const normalizedEmail = parsed.data.email.trim().toLowerCase();
  const systemRole = parsed.data.system_role || "member";
  const jobTitle = parsed.data.job_title?.trim() || "developer";
  const name = parsed.data.name.trim();
  const avatarUrl = parsed.data.avatar_url?.trim() || null;

  let newUserId: string | null = null;

  const { data: authResult, error: authError } =
    await adminClient.auth.admin.createUser({
      email: normalizedEmail,
      password: parsed.data.password,
      email_confirm: true,
      user_metadata: {
        full_name: name,
        avatar_url: avatarUrl,
      },
    });

  if (!authError && authResult.user) {
    newUserId = authResult.user.id;
  } else {
    const message = (authError?.message || "").toLowerCase();
    const emailExists =
      message.includes("already") ||
      message.includes("registered") ||
      message.includes("email");

    if (!emailExists) {
      return NextResponse.json(
        { error: authError?.message || "Failed to create auth user" },
        { status: 500 },
      );
    }

    const { data: existingProfile, error: profileLookupError } =
      await adminClient
        .from("profiles")
        .select("id")
        .ilike("email", normalizedEmail)
        .maybeSingle();

    if (profileLookupError) {
      return NextResponse.json(
        {
          error:
            "A user with this email already exists but profile lookup failed. Please use password reset or contact admin.",
        },
        { status: 409 },
      );
    }

    const { userId: existingAuthUserId, error: authLookupError } =
      await findAuthUserIdByEmail(adminClient, normalizedEmail);

    if (authLookupError) {
      return NextResponse.json(
        {
          error:
            authLookupError.message || "Failed to resolve existing auth user",
        },
        { status: 500 },
      );
    }

    const resolvedUserId = existingProfile?.id || existingAuthUserId;

    if (!resolvedUserId) {
      return NextResponse.json(
        {
          error:
            "A user with this email already exists but could not be resolved. Please use password reset or contact admin.",
        },
        { status: 409 },
      );
    }

    const { error: updateExistingError } =
      await adminClient.auth.admin.updateUserById(resolvedUserId, {
        password: parsed.data.password,
        email_confirm: true,
        user_metadata: {
          full_name: name,
          avatar_url: avatarUrl,
        },
      });

    if (updateExistingError) {
      return NextResponse.json(
        {
          error:
            updateExistingError.message ||
            "Failed to update existing auth user",
        },
        { status: 500 },
      );
    }

    newUserId = resolvedUserId;
  }

  if (!newUserId) {
    return NextResponse.json(
      { error: "Failed to resolve auth user" },
      { status: 500 },
    );
  }

  const { error: profileError } = await adminClient.from("profiles").upsert(
    {
      id: newUserId,
      email: normalizedEmail,
      full_name: name,
      role: systemRole,
      avatar_url: avatarUrl,
    },
    { onConflict: "id" },
  );

  if (profileError) {
    return NextResponse.json({ error: profileError.message }, { status: 500 });
  }

  const { data: existingMember } = await adminClient
    .from("members")
    .select("id")
    .ilike("email", normalizedEmail)
    .maybeSingle();

  if (existingMember?.id) {
    const { error: memberUpdateError } = await adminClient
      .from("members")
      .update({
        user_id: newUserId,
        name,
        role: jobTitle,
      })
      .eq("id", existingMember.id);

    if (memberUpdateError) {
      return NextResponse.json(
        { error: memberUpdateError.message },
        { status: 500 },
      );
    }
  } else {
    const { error: memberInsertError } = await adminClient
      .from("members")
      .insert({
        user_id: newUserId,
        name,
        email: normalizedEmail,
        role: jobTitle,
      });

    if (memberInsertError) {
      return NextResponse.json(
        { error: memberInsertError.message },
        { status: 500 },
      );
    }
  }

  // Invalidate caches to reflect new user across app
  revalidateTag("members", "max");
  revalidateTag("team", "max");
  revalidateTag("dashboard", "max");

  return NextResponse.json({ success: true, userId: newUserId });
}
