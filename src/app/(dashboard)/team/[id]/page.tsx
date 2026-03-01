import { redirect } from "next/navigation"

import TeamMemberProfileClient from "./member-profile-client"
import { createClient } from "@/lib/supabase/server"
import { getRoleContext } from "@/lib/server-authz"

type Member = {
  id: string
  created_at?: string | null
  user_id?: string | null
  avatar_url?: string | null
  name: string
  email: string | null
  role: string
  system_role?: string | null
  profiles?: { avatar_url?: string | null }[] | { avatar_url?: string | null } | null
}

export default async function TeamMemberProfilePage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect("/auth/login")
  }

  const roleContext = await getRoleContext(supabase, user.id)
  const isAdmin = roleContext.actualRole === "admin"

  const { data: viewerProfile } = await supabase
    .from("profiles")
    .select("email,avatar_url")
    .eq("id", user.id)
    .maybeSingle()

  const { data: rawMember, error: memberError } = await supabase
    .from("members")
    .select("id, created_at, name, email, role, user_id, profiles:profiles!members_user_id_fkey(role, avatar_url)")
    .eq("id", id)
    .maybeSingle<Member>()

  if (memberError) {
    return (
      <TeamMemberProfileClient
        initialMember={null}
        initialProjects={[]}
        initialTasks={[]}
        initialAuthEvents={[]}
        initialHasLoggedIn={false}
        initialLastLoginAt={null}
        initialAuthActivityMissingTable={false}
        initialError={memberError.message}
        isAdmin={isAdmin}
      />
    )
  }

  if (!rawMember) {
    return (
      <TeamMemberProfileClient
        initialMember={null}
        initialProjects={[]}
        initialTasks={[]}
        initialAuthEvents={[]}
        initialHasLoggedIn={false}
        initialLastLoginAt={null}
        initialAuthActivityMissingTable={false}
        initialError={"Member not found"}
        isAdmin={isAdmin}
      />
    )
  }

  const joinedAvatar =
    Array.isArray(rawMember.profiles) && rawMember.profiles.length > 0
      ? rawMember.profiles[0]?.avatar_url || null
      : (rawMember.profiles as { avatar_url?: string | null } | null)?.avatar_url || null

  const systemRoleFromProfiles =
    Array.isArray(rawMember.profiles) && rawMember.profiles.length > 0
      ? (rawMember.profiles[0] as { role?: string | null })?.role || null
      : (rawMember.profiles as { role?: string | null } | null)?.role || null

  const normalizedMemberEmail = (rawMember.email || "").trim().toLowerCase()
  const normalizedProfileEmail = (viewerProfile?.email || user.email || "").trim().toLowerCase()
  const selfAvatar =
    normalizedMemberEmail && normalizedMemberEmail === normalizedProfileEmail
      ? (viewerProfile?.avatar_url as string | null) || null
      : null

  const member = {
    id: rawMember.id,
    created_at: rawMember.created_at || null,
    name: rawMember.name,
    email: rawMember.email,
    role: rawMember.role,
    system_role: systemRoleFromProfiles,
    user_id: rawMember.user_id,
    avatar_url: joinedAvatar || selfAvatar,
  }

  const [projectsRes, tasksRes] = await Promise.all([
    supabase
      .from("projects")
      .select("id,name,status,project_members(member_id,members(id))")
      .order("name"),
    supabase
      .from("tasks")
      .select("id,title,project_id,assignee_member_id,status,due_date")
      .order("created_at", { ascending: false }),
  ])

  const projects = Array.isArray(projectsRes.data) ? projectsRes.data : []
  const tasks = Array.isArray(tasksRes.data) ? tasksRes.data : []

  let authEvents: Array<{
    id: string
    event_type: string
    created_at: string
    email: string | null
    country: string | null
    city: string | null
    user_agent: string | null
  }> = []
  let hasLoggedIn = false
  let lastLoginAt: string | null = null
  let authActivityMissingTable = false

  if (isAdmin) {
    let authQuery = supabase
      .from("auth_activity")
      .select("id,event_type,created_at,country,city,user_agent,email,user_id")
      .order("created_at", { ascending: false })
      .limit(50)

    if (member.user_id) {
      authQuery = authQuery.eq("user_id", member.user_id)
    } else if (member.email) {
      authQuery = authQuery.ilike("email", member.email)
    }

    const { data: rawAuthEvents, error: authError } = await authQuery

    if (authError && authError.message?.toLowerCase().includes("auth_activity")) {
      authActivityMissingTable = true
    } else if (!authError && Array.isArray(rawAuthEvents)) {
      authEvents = rawAuthEvents.map((event) => ({
        id: event.id,
        event_type: event.event_type,
        created_at: event.created_at,
        email: event.email,
        country: event.country,
        city: event.city,
        user_agent: event.user_agent,
      }))

      const loginEvents = authEvents.filter((event) => event.event_type === "login_success")
      hasLoggedIn = loginEvents.length > 0
      lastLoginAt = loginEvents[0]?.created_at || null
    }
  }

  return (
    <TeamMemberProfileClient
      initialMember={member}
      initialProjects={projects}
      initialTasks={tasks}
      initialAuthEvents={authEvents}
      initialHasLoggedIn={hasLoggedIn}
      initialLastLoginAt={lastLoginAt}
      initialAuthActivityMissingTable={authActivityMissingTable}
      initialError={null}
      isAdmin={isAdmin}
    />
  )
}
