import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { createClient } from "@/lib/supabase/server";
import { getEffectiveProfileId } from "@/lib/server-authz";

const widgetIdSchema = z.enum([
  "totalProjects",
  "activeProjects",
  "completedProjects",
  "onHoldProjects",
  "totalBudget",
  "todoTasks",
  "inProgressTasks",
  "overdueTasks",
  "teamMembers",
  "recentProjects",
]);

const dashboardPreferencesSchema = z.object({
  layout: z.array(
    z.object({
      id: widgetIdSchema,
      size: z.enum(["sm", "md", "lg", "xl"]),
    }),
  ),
  hiddenWidgetIds: z.array(widgetIdSchema),
});

const updatePreferencesSchema = z.object({
  preferences: dashboardPreferencesSchema,
});

const FALLBACK_PREFERENCES = {
  layout: [
    { id: "totalProjects", size: "sm" },
    { id: "activeProjects", size: "sm" },
    { id: "completedProjects", size: "sm" },
    { id: "totalBudget", size: "sm" },
    { id: "todoTasks", size: "sm" },
    { id: "inProgressTasks", size: "sm" },
    { id: "overdueTasks", size: "sm" },
    { id: "teamMembers", size: "sm" },
    { id: "onHoldProjects", size: "sm" },
    { id: "recentProjects", size: "md" },
  ],
  hiddenWidgetIds: [],
};

function isMissingDashboardLayoutColumn(message: string) {
  return message.includes("dashboard_layout") || message.includes("dashboard_layout_mobile");
}

function resolveDevice(request: NextRequest) {
  const device = request.nextUrl.searchParams.get("device");
  return device === "mobile" ? "mobile" : "desktop";
}

function getLayoutColumn(device: "mobile" | "desktop") {
  return device === "mobile" ? "dashboard_layout_mobile" : "dashboard_layout";
}

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const device = resolveDevice(request);
  const selectedColumn = getLayoutColumn(device);
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const targetProfileId = await getEffectiveProfileId(supabase, user.id);

  const { data, error } = await supabase
    .from("profiles")
    .select("dashboard_layout, dashboard_layout_mobile")
    .eq("id", targetProfileId)
    .single();

  if (error) {
    if (isMissingDashboardLayoutColumn(error.message)) {
      return NextResponse.json({
        preferences: FALLBACK_PREFERENCES,
        warning: "dashboard_layout column missing; using fallback preferences",
      });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const rawPreferences =
    selectedColumn === "dashboard_layout_mobile"
      ? data?.dashboard_layout_mobile ?? data?.dashboard_layout
      : data?.dashboard_layout;

  const parsed = dashboardPreferencesSchema.safeParse(rawPreferences);

  if (!parsed.success) {
    return NextResponse.json({
      preferences: FALLBACK_PREFERENCES,
      warning: `Invalid ${selectedColumn}; using fallback preferences`,
    });
  }

  return NextResponse.json({ preferences: parsed.data });
}

export async function PUT(request: NextRequest) {
  const supabase = await createClient();
  const device = resolveDevice(request);
  const selectedColumn = getLayoutColumn(device);
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const targetProfileId = await getEffectiveProfileId(supabase, user.id);

  const parsedBody = updatePreferencesSchema.safeParse(await request.json());
  if (!parsedBody.success) {
    return NextResponse.json({ error: "Invalid dashboard preferences payload" }, { status: 400 });
  }

  const { error } = await supabase
    .from("profiles")
    .update({ [selectedColumn]: parsedBody.data.preferences })
    .eq("id", targetProfileId);

  if (error) {
    if (isMissingDashboardLayoutColumn(error.message)) {
      return NextResponse.json({
        success: true,
        warning: `${selectedColumn} column missing; saved only in local cache`,
      });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
