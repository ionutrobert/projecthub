import DashboardClient from "./dashboard-client"

export const metadata = {
  title: "Dashboard | ProjectHub",
  description: "Your ProjectHub command center. Overview of projects, tasks, and team activity.",
}

export default async function Page() {
  return <DashboardClient />
}
