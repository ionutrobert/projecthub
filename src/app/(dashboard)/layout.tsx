import { redirect } from "next/navigation"

import { createClient } from "@/lib/supabase/server"
import DashboardShell from "./dashboard-shell"

export const dynamic = "force-dynamic"
export const fetchCache = "force-no-store"

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect("/auth/login")
  }

  return <DashboardShell>{children}</DashboardShell>
}
