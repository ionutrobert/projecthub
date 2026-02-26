export const dynamic = "force-dynamic"
export const fetchCache = "force-no-store"

import { redirect } from "next/navigation"

import { createClient } from "@/lib/supabase/server"
import DashboardClient from "./dashboard-client"

export default async function Page() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect("/auth/login")
  }

  return <DashboardClient />
}
