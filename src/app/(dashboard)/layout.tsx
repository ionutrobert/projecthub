"use client"

import { Header } from "@/components/header"
import { Sidebar } from "@/components/sidebar"
import { useNavStyle } from "@/components/nav-style-provider"

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const { navStyle } = useNavStyle()

  if (navStyle === "sidebar") {
    return (
      <div className="flex h-screen overflow-hidden bg-background">
        {/* Diffusion orbs - Obsidian style */}
        <div className="diffusion-orb orb-1" />
        <div className="diffusion-orb orb-2" />
        
        <Sidebar />
        <div className="flex flex-1 flex-col overflow-hidden">
          <Header />
          <main className="flex-1 overflow-y-auto p-8">
            {children}
          </main>
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-background">
      {/* Diffusion orbs - Obsidian style */}
      <div className="diffusion-orb orb-1" />
      <div className="diffusion-orb orb-2" />
      
      <Header />
      <main className="flex-1 overflow-y-auto p-8">
        {children}
      </main>
    </div>
  )
}
