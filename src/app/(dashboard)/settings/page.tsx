"use client"

import { useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import Image from "next/image"
import { useTheme } from "@/components/theme-provider"
import { useNavStyle } from "@/components/nav-style-provider"
import { useUser } from "@/components/user-provider"
import UserAvatar from "@/components/user-avatar"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Moon, Sun, Layout, Columns, Palette, Check, Key, Monitor, User, UserCog, Eye, EyeOff, ShieldAlert } from "lucide-react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { cn } from "@/lib/utils"
import { getAvatarPickerOptions, getLinkedInAvatar, getOAuthAvatar } from "@/lib/avatar"

const colorPresets = [
  { name: "Violet", value: "#8b5cf6" },
  { name: "Blue", value: "#3b82f6" },
  { name: "Cyan", value: "#06b6d4" },
  { name: "Emerald", value: "#10b981" },
  { name: "Amber", value: "#f59e0b" },
  { name: "Rose", value: "#f43f5e" },
  { name: "Pink", value: "#ec4899" },
  { name: "Indigo", value: "#6366f1" },
]

type AuthEvent = {
  id: string
  event_type: string
  created_at: string
  country: string | null
  city: string | null
  user_agent: string | null
  email: string
}

export default function SettingsPage() {
  const router = useRouter()
  const {
    theme,
    setTheme,
    accentColor,
    setAccentColor,
  } = useTheme()
  const { navStyle, setNavStyle } = useNavStyle()
  const { user, profile, impersonation, signOut } = useUser()
  const avatarUser = impersonation ? null : user
  const [profileName, setProfileName] = useState("")
  const [avatarUrl, setAvatarUrl] = useState("")
  const [avatarVariant, setAvatarVariant] = useState(0)
  const [avatarPickerOpen, setAvatarPickerOpen] = useState(false)
  const [savingProfile, setSavingProfile] = useState(false)
  const [profileMessage, setProfileMessage] = useState<string | null>(null)

  const [currentPassword, setCurrentPassword] = useState("")
  const [newPassword, setNewPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [showCurrentPassword, setShowCurrentPassword] = useState(false)
  const [showNewPassword, setShowNewPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [changingPassword, setChangingPassword] = useState(false)
  const [passwordMessage, setPasswordMessage] = useState<string | null>(null)

  const [authEvents, setAuthEvents] = useState<AuthEvent[]>([])
  const [loadingEvents, setLoadingEvents] = useState(true)

  const avatarSeed = user?.id || user?.email || profileName || "projecthub-user"
  const avatarOptions = useMemo(
    () => getAvatarPickerOptions(avatarSeed, avatarVariant),
    [avatarSeed, avatarVariant]
  )
  const linkedInAvatar = useMemo(() => getLinkedInAvatar(user), [user])
  const oauthAvatar = useMemo(() => getOAuthAvatar(user), [user])

  const uniqueDevices = useMemo(() => {
    const devices = new Set<string>()
    authEvents.forEach(event => {
      if (event.user_agent) {
        devices.add(event.user_agent)
      }
    })
    return Math.max(devices.size, 1) // At least 1 (this device)
  }, [authEvents])

  useEffect(() => {
    setProfileName(profile?.full_name || "")
    setAvatarUrl(profile?.avatar_url || "")
  }, [profile?.full_name, profile?.avatar_url])

  useEffect(() => {
    async function fetchAuthEvents() {
      if (!user?.id) return
      
      try {
        const response = await fetch("/api/auth/activity")
        const data = await response.json()
        if (data.events) {
          setAuthEvents(data.events)
        }
      } catch (error) {
        console.error("Failed to fetch auth events:", error)
      } finally {
        setLoadingEvents(false)
      }
    }

    fetchAuthEvents()
  }, [user?.id])

  const handleColorChange = (color: string) => {
    setAccentColor(color)
  }

  const saveProfileChanges = async (nextName: string, nextAvatarUrl: string) => {
    if (!user?.id) {
      setProfileMessage("You are not signed in.")
      return
    }

    const withTimeout = async <T,>(promise: Promise<T>, ms: number): Promise<T> => {
      return await new Promise<T>((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error("Saving profile timed out.")), ms)
        promise
          .then((value) => {
            clearTimeout(timer)
            resolve(value)
          })
          .catch((error) => {
            clearTimeout(timer)
            reject(error)
          })
      })
    }

    setSavingProfile(true)
    setProfileMessage(null)

    try {
      const response = await withTimeout(
        fetch("/api/profile", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            full_name: nextName.trim() || null,
            avatar_url: nextAvatarUrl.trim() || null,
          }),
        }),
        15000
      )

      const data = (await response.json()) as { error?: string }

      if (!response.ok) {
        setProfileMessage(`Could not save profile changes: ${data.error || "Unknown error"}`)
        return
      }

      setProfileMessage("Profile updated.")
      router.refresh()
    } catch (error) {
      setProfileMessage(
        error instanceof Error ? error.message : "Could not save profile changes."
      )
    } finally {
      setSavingProfile(false)
    }
  }

  const handleSaveProfile = async () => {
    await saveProfileChanges(profileName, avatarUrl)
  }

  const handleChangePassword = async () => {
    if (!currentPassword || !newPassword) {
      setPasswordMessage("Please fill in both password fields.")
      return
    }

    if (newPassword !== confirmPassword) {
      setPasswordMessage("New passwords do not match.")
      return
    }

    if (newPassword.length < 8) {
      setPasswordMessage("New password must be at least 8 characters.")
      return
    }

    setChangingPassword(true)
    setPasswordMessage(null)

    try {
      const response = await fetch("/api/profile/password", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          currentPassword,
          newPassword,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        setPasswordMessage(data.error || "Failed to change password.")
        return
      }

      setPasswordMessage("Password changed successfully.")
      setCurrentPassword("")
      setNewPassword("")
      setConfirmPassword("")
    } catch (error) {
      setPasswordMessage(
        error instanceof Error ? error.message : "Failed to change password."
      )
    } finally {
      setChangingPassword(false)
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
        <p className="text-muted-foreground">Customize how ProjectHub feels for you.</p>
      </div>

      <Tabs defaultValue="account" className="space-y-6">
        <TabsList className="grid w-full max-w-md grid-cols-2">
          <TabsTrigger value="account" className="gap-2">
            <UserCog className="h-4 w-4" />
            Account
          </TabsTrigger>
          <TabsTrigger value="appearance" className="gap-2">
            <Palette className="h-4 w-4" />
            Appearance
          </TabsTrigger>
        </TabsList>

        {/* Account Tab */}
        <TabsContent value="account" className="space-y-6">
          <Card className="glass overflow-hidden">
            <div 
              className="h-1 w-full"
              style={{ 
                background: `linear-gradient(90deg, ${accentColor}, ${accentColor}88, ${accentColor})` 
              }}
            />
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <UserCog className="h-5 w-5" style={{ color: accentColor }} />
                Account
              </CardTitle>
              <CardDescription>Manage your account settings and credentials.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {/* Column 1: Profile Info */}
                <div className="space-y-6">
                  <div className="space-y-4">
                    <div className="flex items-center gap-2">
                      <User className="h-4 w-4 text-muted-foreground" />
                      <h3 className="text-sm font-medium">Profile Information</h3>
                    </div>
                    
                    <div className="space-y-2">
                      <Label htmlFor="fullName">Full Name</Label>
                      <Input
                        id="fullName"
                        type="text"
                        value={profileName}
                        onChange={(event) => setProfileName(event.target.value)}
                        placeholder="Enter your name"
                      />
                    </div>
                    
                    <div className="space-y-2">
                      <Label htmlFor="email">Email</Label>
                      <Input
                        id="email"
                        type="email"
                        value={profile?.email || user?.email || ""}
                        disabled
                        className="cursor-not-allowed bg-muted/50"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="avatarUrl">Avatar URL</Label>
                      <div className="flex items-center gap-2">
                        <Input
                          id="avatarUrl"
                          type="url"
                          value={avatarUrl}
                          onChange={(event) => setAvatarUrl(event.target.value)}
                          placeholder="https://..."
                        />
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => setAvatarPickerOpen(true)}
                        >
                          Pick
                        </Button>
                      </div>
                      <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold">
                        App &gt; OAuth &gt; Gravatar &gt; fallback
                      </p>
                    </div>

                    <div className="flex items-center gap-4 pt-2">
                      <UserAvatar
                        profile={{
                          full_name: profileName,
                          avatar_url: avatarUrl || profile?.avatar_url,
                          email: profile?.email || user?.email || null,
                        }}
                        user={avatarUser}
                        sizeClass="h-16 w-16 shadow-lg border-2 border-border"
                        textClass="text-xl"
                      />
                      <div className="space-y-1">
                        <Button size="sm" onClick={handleSaveProfile} disabled={savingProfile}>
                          {savingProfile ? "Saving..." : "Save Changes"}
                        </Button>
                        {profileMessage && <p className="text-xs text-muted-foreground">{profileMessage}</p>}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Column 2: Password Change */}
                <div className="space-y-6">
                  <div className="space-y-4">
                    <div className="flex items-center gap-2">
                      <Key className="h-4 w-4 text-muted-foreground" />
                      <h3 className="text-sm font-medium">Update Password</h3>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="currentPassword">Current Password</Label>
                      <div className="relative">
                        <Input
                          id="currentPassword"
                          type={showCurrentPassword ? "text" : "password"}
                          value={currentPassword}
                          onChange={(event) => setCurrentPassword(event.target.value)}
                          placeholder="Current password"
                        />
                        <button
                          type="button"
                          onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                        >
                          {showCurrentPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </button>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="newPassword">New Password</Label>
                      <div className="relative">
                        <Input
                          id="newPassword"
                          type={showNewPassword ? "text" : "password"}
                          value={newPassword}
                          onChange={(event) => setNewPassword(event.target.value)}
                          placeholder="At least 8 characters"
                        />
                        <button
                          type="button"
                          onClick={() => setShowNewPassword(!showNewPassword)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                        >
                          {showNewPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </button>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="confirmPassword">Confirm New Password</Label>
                      <div className="relative">
                        <Input
                          id="confirmPassword"
                          type={showConfirmPassword ? "text" : "password"}
                          value={confirmPassword}
                          onChange={(event) => setConfirmPassword(event.target.value)}
                          placeholder="Confirm new password"
                        />
                        <button
                          type="button"
                          onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                        >
                          {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </button>
                      </div>
                    </div>

                    <div className="pt-2">
                      <Button size="sm" onClick={handleChangePassword} disabled={changingPassword} className="w-full md:w-auto">
                        {changingPassword ? "Updating..." : "Update Password"}
                      </Button>
                      {passwordMessage && (
                        <p className={cn("text-xs mt-2", passwordMessage.includes("success") ? "text-green-600" : "text-destructive")}>
                          {passwordMessage}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Bottom Row: Sessions & Destructive Actions */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Column 1: Active Sessions */}
            <div className="space-y-4">
              <div className="flex items-center justify-between px-1">
                <div className="flex items-center gap-2">
                  <Monitor className="h-4 w-4 text-muted-foreground" />
                  <h3 className="text-sm font-medium">Active Sessions</h3>
                </div>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-500 font-bold uppercase tracking-wider">
                   {loadingEvents ? "..." : `${uniqueDevices} device${uniqueDevices !== 1 ? "s" : ""}`}
                </span>
              </div>
              
              <div className="rounded-xl border border-border bg-card/50 p-4 space-y-3 relative overflow-hidden glass">
                {loadingEvents ? (
                  <p className="text-xs text-muted-foreground animate-pulse">Loading sessions...</p>
                ) : (
                  <div className="flex items-start justify-between">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <div className="h-1.5 w-1.5 rounded-full bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.5)]" />
                        <span className="font-semibold text-sm">This device</span>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {uniqueDevices > 1 ? `+${uniqueDevices - 1} other device(s) from login history` : "No other devices detected"}
                      </p>
                      <p className="text-xs text-muted-foreground/60 pt-1 truncate max-w-[200px]">{user?.email}</p>
                    </div>
                    <span className="text-[10px] text-muted-foreground/50 uppercase font-bold">Current session</span>
                  </div>
                )}
              </div>
            </div>

            {/* Column 2: Sign Out */}
            <div className="space-y-4">
               <div className="flex items-center gap-2 px-1">
                  <ShieldAlert className="h-4 w-4 text-destructive" />
                  <h3 className="text-sm font-medium">Account Security</h3>
                </div>
                <div className="rounded-xl border border-destructive/20 bg-destructive/5 p-4 space-y-4 glass">
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    End all active sessions across all devices. You will be signed out everywhere immediately.
                  </p>
                  <Button 
                    variant="destructive" 
                    onClick={() => signOut()}
                    className="w-full shadow-lg shadow-destructive/10"
                    size="sm"
                  >
                    Sign Out of All Devices
                  </Button>
                </div>
            </div>
          </div>
        </TabsContent>

        {/* Appearance Tab */}
        <TabsContent value="appearance">
          <Card className="glass overflow-hidden">
            <div 
              className="h-1 w-full"
              style={{ 
                background: `linear-gradient(90deg, ${accentColor}, ${accentColor}88, ${accentColor})` 
              }}
            />
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Palette className="h-5 w-5" style={{ color: accentColor }} />
                Appearance
              </CardTitle>
              <CardDescription>Personalize colors, layout, and motion effects.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-6 lg:grid-cols-[1fr_1fr] lg:items-start">
                {/* Left Column - Theme & Navigation */}
                <div className="space-y-6">
                  <div className="space-y-3">
                    <label className="text-sm font-medium">Theme Mode</label>
                    <div className="grid grid-cols-2 gap-3">
                      <button
                        onClick={() => setTheme("light")}
                        className={cn(
                          "relative flex items-center gap-3 p-3 rounded-xl border-2 transition-all duration-300",
                          "hover:scale-[1.02] active:scale-[0.98]",
                          theme === "light" 
                            ? "border-primary bg-primary/5" 
                            : "border-border hover:border-primary/50"
                        )}
                      >
                        <div className="absolute inset-0 rounded-xl bg-gradient-to-br from-amber-100/50 to-orange-100/50 opacity-50" />
                        <div className="relative flex h-9 w-9 items-center justify-center rounded-full bg-amber-100">
                          <Sun className="h-4 w-4 text-amber-600" />
                        </div>
                        <div className="relative text-left">
                          <p className="font-medium text-sm">Light</p>
                          <p className="text-xs text-muted-foreground">Clean</p>
                        </div>
                        {theme === "light" && (
                          <div 
                            className="absolute top-2 right-2 h-4 w-4 rounded-full flex items-center justify-center"
                            style={{ backgroundColor: accentColor }}
                          >
                            <Check className="h-2.5 w-2.5 text-white" />
                          </div>
                        )}
                      </button>

                      <button
                        onClick={() => setTheme("dark")}
                        className={cn(
                          "relative flex items-center gap-3 p-3 rounded-xl border-2 transition-all duration-300",
                          "hover:scale-[1.02] active:scale-[0.98]",
                          theme === "dark" 
                            ? "border-primary bg-primary/5" 
                            : "border-border hover:border-primary/50"
                        )}
                      >
                        <div className="absolute inset-0 rounded-xl bg-gradient-to-br from-violet-900/50 to-indigo-900/50 opacity-50" />
                        <div className="relative flex h-9 w-9 items-center justify-center rounded-full bg-violet-900">
                          <Moon className="h-4 w-4 text-violet-400" />
                        </div>
                        <div className="relative text-left">
                          <p className="font-medium text-sm">Dark</p>
                          <p className="text-xs text-muted-foreground">Focused</p>
                        </div>
                        {theme === "dark" && (
                          <div 
                            className="absolute top-2 right-2 h-4 w-4 rounded-full flex items-center justify-center"
                            style={{ backgroundColor: accentColor }}
                          >
                            <Check className="h-2.5 w-2.5 text-white" />
                          </div>
                        )}
                      </button>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <label className="text-sm font-medium">Navigation</label>
                    <div className="grid grid-cols-2 gap-3">
                      <button
                        onClick={() => setNavStyle("top")}
                        className={cn(
                          "relative overflow-hidden rounded-xl border-2 p-3 transition-all duration-300",
                          "hover:scale-[1.02] active:scale-[0.98]",
                          navStyle === "top" 
                            ? "border-primary bg-primary/5" 
                            : "border-border hover:border-primary/50"
                        )}
                      >
                        <div className="flex flex-col items-center gap-2">
                          <Layout className={cn("h-5 w-5", navStyle === "top" ? "text-primary" : "text-muted-foreground")} />
                          <p className="font-medium text-sm">Top</p>
                        </div>
                        {navStyle === "top" && (
                          <div 
                            className="absolute top-2 right-2 h-4 w-4 rounded-full flex items-center justify-center"
                            style={{ backgroundColor: accentColor }}
                          >
                            <Check className="h-2.5 w-2.5 text-white" />
                          </div>
                        )}
                      </button>

                      <button
                        onClick={() => setNavStyle("sidebar")}
                        className={cn(
                          "relative overflow-hidden rounded-xl border-2 p-3 transition-all duration-300",
                          "hover:scale-[1.02] active:scale-[0.98]",
                          navStyle === "sidebar" 
                            ? "border-primary bg-primary/5" 
                            : "border-border hover:border-primary/50"
                        )}
                      >
                        <div className="flex flex-col items-center gap-2">
                          <Columns className={cn("h-5 w-5", navStyle === "sidebar" ? "text-primary" : "text-muted-foreground")} />
                          <p className="font-medium text-sm">Sidebar</p>
                        </div>
                        {navStyle === "sidebar" && (
                          <div 
                            className="absolute top-2 right-2 h-4 w-4 rounded-full flex items-center justify-center"
                            style={{ backgroundColor: accentColor }}
                          >
                            <Check className="h-2.5 w-2.5 text-white" />
                          </div>
                        )}
                      </button>
                    </div>
                  </div>
                </div>

                {/* Right Column */}
                <div className="space-y-6">
                  {/* Live Preview */}
                  <div className="space-y-3">
                    <label className="text-sm font-medium">Preview</label>
                    <div 
                      className="relative overflow-hidden rounded-xl border border-border p-4 transition-all duration-500"
                      style={{
                        background: `radial-gradient(ellipse at center, ${accentColor}10 0%, transparent 70%)`,
                      }}
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm font-medium" style={{ color: accentColor }}>
                            Live
                          </p>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            Buttons & accents
                          </p>
                        </div>
                        <div className="flex gap-2">
                          <div 
                            className="h-8 px-3 rounded-md flex items-center justify-center text-xs font-medium text-white"
                            style={{ 
                              backgroundColor: accentColor,
                              boxShadow: `0 0 12px ${accentColor}40`
                            }}
                          >
                            Primary
                          </div>
                          <div 
                            className="h-8 px-3 rounded-md flex items-center justify-center text-xs font-medium border"
                            style={{ 
                              borderColor: accentColor,
                              color: accentColor
                            }}
                          >
                            Outline
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Accent Color */}
                  <div className="space-y-3">
                    <label className="text-sm font-medium">Accent Color</label>
                    <div className="flex flex-wrap gap-2">
                      {colorPresets.map((preset) => (
                        <button
                          key={preset.value}
                          onClick={() => handleColorChange(preset.value)}
                          className={cn(
                            "h-9 w-9 rounded-lg transition-all duration-300",
                            "hover:scale-110 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 focus:ring-offset-card",
                            accentColor === preset.value && "ring-2 ring-offset-2 ring-primary scale-110"
                          )}
                          style={{
                            backgroundColor: preset.value,
                            boxShadow: accentColor === preset.value
                              ? `0 0 12px ${preset.value}60`
                              : "none"
                          }}
                          aria-label={`${preset.name} accent color`}
                        >
                          {accentColor === preset.value && (
                            <Check className="h-4 w-4 text-white mx-auto" />
                          )}
                        </button>
                      ))}
                      <div className="relative">
                        <input
                          type="color"
                          value={accentColor}
                          onChange={(e) => handleColorChange(e.target.value)}
                          className="h-9 w-9 rounded-lg border border-border cursor-pointer opacity-0 absolute inset-0"
                          aria-label="Custom accent color"
                        />
                        <div
                          className="h-9 w-9 rounded-lg border border-border flex items-center justify-center"
                          style={{ backgroundColor: accentColor }}
                          aria-hidden="true"
                        >
                          <Palette className="h-4 w-4 text-white" />
                        </div>
                      </div>
                      <span 
                        className="text-sm font-mono self-center ml-2" 
                        style={{ color: accentColor }}
                      >
                        {accentColor.toUpperCase()}
                      </span>
                    </div>
                  </div>

{/* Effects Toggles - TODO: Re-enable when effects are implemented
                  <div className="space-y-3">
                    <label className="text-sm font-medium"> Effects</label>
                    <div className="space-y-3">
                      <div className="flex items-center justify-between rounded-xl border border-border p-3">
                        <div className="flex items-center gap-3">
                          <div 
                            className="flex h-9 w-9 items-center justify-center rounded-lg"
                            style={{ 
                              background: gradientEnabled 
                                ? `linear-gradient(135deg, ${accentColor}, ${accentColor}88)` 
                                : 'hsl(var(--muted))'
                            }}
                          >
                            <Sparkles className={cn("h-4 w-4", gradientEnabled ? "text-white" : "text-muted-foreground")} />
                          </div>
                          <div>
                            <p className="font-medium text-sm">Gradient Glow</p>
                            <p className="text-xs text-muted-foreground">
                              {gradientEnabled ? "Ambient effects on" : "Ambient effects off"}
                            </p>
                          </div>
                        </div>
                        <Switch 
                          checked={gradientEnabled} 
                          onCheckedChange={setGradientEnabled}
                        />
                      </div>

                      <div className="flex items-center justify-between rounded-xl border border-border p-3">
                        <div className="flex items-center gap-3">
                          <div 
                            className="flex h-9 w-9 items-center justify-center rounded-lg"
                            style={{ 
                              background: microAnimations 
                                ? `linear-gradient(135deg, ${accentColor}, ${accentColor}88)` 
                                : 'hsl(var(--muted))'
                            }}
                          >
                            <Zap className={cn("h-4 w-4", microAnimations ? "text-white" : "text-muted-foreground")} />
                          </div>
                          <div>
                            <p className="font-medium text-sm">Micro Motion</p>
                            <p className="text-xs text-muted-foreground">
                              {microAnimations ? "Smooth animations" : "Static interface"}
                            </p>
                          </div>
                        </div>
                        <Switch 
                          checked={microAnimations} 
                          onCheckedChange={setMicroAnimations}
                        />
                      </div>
                    </div>
                  </div>
                  */}
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {avatarPickerOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <button
            type="button"
            aria-label="Close avatar picker"
            className="absolute inset-0 bg-black/50"
            onClick={() => setAvatarPickerOpen(false)}
          />
          <div className="relative w-full max-w-2xl rounded-2xl border border-border bg-card p-4 shadow-2xl">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm font-medium">Choose Avatar</p>
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setAvatarVariant((value) => value + 1)}
                >
                  Shuffle
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={async () => {
                    setAvatarUrl("")
                    setAvatarPickerOpen(false)
                    await saveProfileChanges(profileName, "")
                  }}
                >
                  Auto
                </Button>
                {(linkedInAvatar || oauthAvatar) && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={async () => {
                      const preferredOAuthAvatar = linkedInAvatar || oauthAvatar || ""
                      if (!preferredOAuthAvatar) return
                      setAvatarUrl(preferredOAuthAvatar)
                      setAvatarPickerOpen(false)
                      await saveProfileChanges(profileName, preferredOAuthAvatar)
                    }}
                  >
                    LinkedIn
                  </Button>
                )}
                <Button
                  size="sm"
                  variant="outline"
                  onClick={async () => {
                    setAvatarUrl("initials")
                    setAvatarPickerOpen(false)
                    await saveProfileChanges(profileName, "initials")
                  }}
                >
                  Initials
                </Button>
              </div>
            </div>

            <div className="grid grid-cols-4 gap-2 sm:grid-cols-6 md:grid-cols-8">
              {avatarOptions.map((option) => {
                const isSelected = avatarUrl === option
                return (
                  <button
                    key={option}
                    type="button"
                    onClick={async () => {
                      setAvatarUrl(option)
                      setAvatarPickerOpen(false)
                      await saveProfileChanges(profileName, option)
                    }}
                    className={cn(
                      "rounded-xl border p-1 transition",
                      isSelected
                        ? "border-primary ring-2 ring-primary/30"
                        : "border-border hover:border-primary/40"
                    )}
                    title="Select avatar"
                  >
                    <Image
                      src={option}
                      alt="Avatar option"
                      width={48}
                      height={48}
                      className="h-12 w-12 rounded-lg object-cover"
                      unoptimized
                    />
                  </button>
                )
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
