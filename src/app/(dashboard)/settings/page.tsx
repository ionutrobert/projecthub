"use client"

import { useTheme } from "@/components/theme-provider"
import { useNavStyle } from "@/components/nav-style-provider"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Moon, Sun, Layout, Columns } from "lucide-react"

export default function SettingsPage() {
  const { theme, setTheme } = useTheme()
  const { navStyle, setNavStyle } = useNavStyle()

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
        <p className="text-muted-foreground">Manage your preferences and account settings.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Appearance</CardTitle>
          <CardDescription>Customize how ProjectHub looks on your device.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div>
            <label className="text-sm font-medium">Theme</label>
            <div className="mt-2 flex gap-2">
              <Button
                variant={theme === "light" ? "default" : "outline"}
                size="sm"
                onClick={() => setTheme("light")}
                className="gap-2"
              >
                <Sun className="h-4 w-4" />
                Light
              </Button>
              <Button
                variant={theme === "dark" ? "default" : "outline"}
                size="sm"
                onClick={() => setTheme("dark")}
                className="gap-2"
              >
                <Moon className="h-4 w-4" />
                Dark
              </Button>
            </div>
            <p className="mt-2 text-sm text-muted-foreground">
              Current: <span className="font-medium capitalize">{theme}</span> mode
            </p>
          </div>

          <div className="border-t pt-4">
            <label className="text-sm font-medium">Navigation Layout</label>
            <div className="mt-2 flex gap-2">
              <Button
                variant={navStyle === "top" ? "default" : "outline"}
                size="sm"
                onClick={() => setNavStyle("top")}
                className="gap-2"
              >
                <Layout className="h-4 w-4" />
                Top Navigation
              </Button>
              <Button
                variant={navStyle === "sidebar" ? "default" : "outline"}
                size="sm"
                onClick={() => setNavStyle("sidebar")}
                className="gap-2"
              >
                <Columns className="h-4 w-4" />
                Sidebar
              </Button>
            </div>
            <p className="mt-2 text-sm text-muted-foreground">
              Current: <span className="font-medium capitalize">{navStyle}</span> navigation
            </p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Account</CardTitle>
          <CardDescription>Manage your account settings.</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">Account settings - Coming soon</p>
        </CardContent>
      </Card>
    </div>
  )
}
