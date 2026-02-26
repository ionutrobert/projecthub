"use client"

import { useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { useTheme } from "@/components/theme-provider"
import { useNavStyle } from "@/components/nav-style-provider"
import { useUser } from "@/components/user-provider"
import UserAvatar from "@/components/user-avatar"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Moon, Sun, Layout, Columns, Palette, Sparkles, Zap, Check, Key, Monitor, User } from "lucide-react"
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

export default function SettingsPage() {
  const router = useRouter()
  const {
    theme,
    setTheme,
    accentColor,
    setAccentColor,
    gradientEnabled,
    setGradientEnabled,
    microAnimations,
    setMicroAnimations,
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

  const avatarSeed = user?.id || user?.email || profileName || "projecthub-user"
  const avatarOptions = useMemo(
    () => getAvatarPickerOptions(avatarSeed, avatarVariant),
    [avatarSeed, avatarVariant]
  )
  const linkedInAvatar = useMemo(() => getLinkedInAvatar(user), [user])
  const oauthAvatar = useMemo(() => getOAuthAvatar(user), [user])

  useEffect(() => {
    setProfileName(profile?.full_name || "")
    setAvatarUrl(profile?.avatar_url || "")
  }, [profile?.full_name, profile?.avatar_url])

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

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
        <p className="text-muted-foreground">Customize how ProjectHub feels for you.</p>
      </div>

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
        <CardContent className="space-y-8">
          {/* Theme Selection */}
          <div className="space-y-4">
            <label className="text-sm font-medium">Theme Mode</label>
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => setTheme("light")}
                className={cn(
                  "relative flex items-center gap-3 p-4 rounded-xl border-2 transition-all duration-300",
                  "hover:scale-[1.02] active:scale-[0.98]",
                  theme === "light" 
                    ? "border-primary bg-primary/5" 
                    : "border-border hover:border-primary/50"
                )}
              >
                <div className="absolute inset-0 rounded-xl bg-gradient-to-br from-amber-100/50 to-orange-100/50 opacity-50" />
                <div className="relative flex h-10 w-10 items-center justify-center rounded-full bg-amber-100">
                  <Sun className="h-5 w-5 text-amber-600" />
                </div>
                <div className="relative text-left">
                  <p className="font-medium">Light</p>
                  <p className="text-xs text-muted-foreground">Clean & bright</p>
                </div>
                {theme === "light" && (
                  <div 
                    className="absolute top-2 right-2 h-5 w-5 rounded-full flex items-center justify-center"
                    style={{ backgroundColor: accentColor }}
                  >
                    <Check className="h-3 w-3 text-white" />
                  </div>
                )}
              </button>

              <button
                onClick={() => setTheme("dark")}
                className={cn(
                  "relative flex items-center gap-3 p-4 rounded-xl border-2 transition-all duration-300",
                  "hover:scale-[1.02] active:scale-[0.98]",
                  theme === "dark" 
                    ? "border-primary bg-primary/5" 
                    : "border-border hover:border-primary/50"
                )}
              >
                <div className="absolute inset-0 rounded-xl bg-gradient-to-br from-violet-900/50 to-indigo-900/50 opacity-50" />
                <div className="relative flex h-10 w-10 items-center justify-center rounded-full bg-violet-900">
                  <Moon className="h-5 w-5 text-violet-400" />
                </div>
                <div className="relative text-left">
                  <p className="font-medium">Dark</p>
                  <p className="text-xs text-muted-foreground">Deep & focused</p>
                </div>
                {theme === "dark" && (
                  <div 
                    className="absolute top-2 right-2 h-5 w-5 rounded-full flex items-center justify-center"
                    style={{ backgroundColor: accentColor }}
                  >
                    <Check className="h-3 w-3 text-white" />
                  </div>
                )}
              </button>
            </div>
          </div>

          {/* Accent Color Picker */}
          <div className="space-y-4">
            <label htmlFor="accent-color" className="text-sm font-medium">Accent Color</label>
            <div className="flex flex-col md:flex-row gap-4">
              {/* Preset Colors */}
              <div
                role="radiogroup"
                aria-label="Preset accent colors"
                className="flex flex-wrap gap-2 flex-1"
              >
                {colorPresets.map((preset) => (
                  <button
                    key={preset.value}
                    onClick={() => handleColorChange(preset.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault()
                        handleColorChange(preset.value)
                      }
                    }}
                    role="radio"
                    aria-checked={accentColor === preset.value}
                    aria-label={`${preset.name} accent color`}
                    className={cn(
                      "relative h-10 w-10 rounded-xl transition-all duration-300",
                      "hover:scale-110 hover:shadow-lg active:scale-95 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 focus:ring-offset-card",
                      accentColor === preset.value
                        ? "ring-2 ring-offset-2 ring-offset-card ring-white dark:ring-offset-gray-900 scale-110 shadow-lg"
                        : "hover:-translate-y-0.5"
                    )}
                    style={{
                      backgroundColor: preset.value,
                      boxShadow: accentColor === preset.value
                        ? `0 0 20px ${preset.value}60`
                        : "none"
                    }}
                    tabIndex={0}
                  >
                    {accentColor === preset.value && (
                      <span className="absolute inset-0 flex items-center justify-center" aria-hidden="true">
                        <Check className="h-5 w-5 text-white" />
                      </span>
                    )}
                  </button>
                ))}
              </div>

              {/* Custom Color Picker */}
              <div className="flex items-center gap-3 min-w-[200px]">
                <div className="relative group shrink-0">
                  <label htmlFor="custom-color" className="sr-only">Custom accent color</label>
                  <input
                    id="custom-color"
                    type="color"
                    value={accentColor}
                    onChange={(e) => handleColorChange(e.target.value)}
                    className="h-12 w-12 rounded-xl border-2 border-border cursor-pointer opacity-0 absolute inset-0"
                    aria-label={`Custom accent color: ${accentColor}`}
                  />
                  <div
                    className="h-12 w-12 rounded-xl border-2 border-border flex items-center justify-center transition-transform duration-300 group-hover:scale-105"
                    style={{ backgroundColor: accentColor }}
                    aria-hidden="true"
                  >
                    <Palette className="h-5 w-5 text-white drop-shadow-md" />
                  </div>
                </div>
                <div className="flex-1">
                  <p className="text-sm font-mono font-medium" style={{ color: accentColor }} aria-live="polite">
                    {accentColor.toUpperCase()}
                  </p>
                  <p className="text-xs text-muted-foreground">Custom</p>
                </div>
              </div>
            </div>

            {/* Live Preview */}
            <div 
              className="relative overflow-hidden rounded-2xl border border-border p-4 transition-all duration-500"
              style={{
                background: `radial-gradient(ellipse at center, ${accentColor}15 0%, transparent 70%)`,
              }}
            >
              <div className="absolute inset-0 bg-gradient-to-br from-transparent via-transparent to-black/5" />
              <div className="relative flex flex-col sm:flex-row items-center justify-between gap-4">
                <div className="space-y-1 text-center sm:text-left">
                  <p className="text-sm font-medium" style={{ color: accentColor }}>
                    Live Preview
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Applied to buttons, links, logo, and glows.
                  </p>
                </div>
                <div className="flex gap-2">
                  <div 
                    className="h-10 px-4 rounded-lg flex items-center justify-center text-sm font-medium text-white transition-all duration-300 hover:scale-105 active:scale-95 cursor-pointer"
                    style={{ 
                      backgroundColor: accentColor,
                      boxShadow: `0 0 20px ${accentColor}60`
                    }}
                  >
                    Primary
                  </div>
                  <div 
                    className="h-10 px-4 rounded-lg flex items-center justify-center text-sm font-medium border-2 transition-all duration-300 hover:scale-105 active:scale-95 cursor-pointer"
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

          {/* Effects Toggles */}
          <div className="grid grid-cols-2 gap-4">
            <button
              onClick={() => setGradientEnabled(!gradientEnabled)}
              className={cn(
                "relative overflow-hidden rounded-xl border-2 p-4 transition-all duration-300",
                "hover:scale-[1.02] active:scale-[0.98]",
                gradientEnabled 
                  ? "border-primary bg-gradient-to-br from-primary/10 to-transparent" 
                  : "border-border hover:border-primary/50"
              )}
            >
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent translate-x-[-100%] animate-[shimmer_2s_infinite]" />
              <div className="flex items-center gap-3">
                <div 
                  className="flex h-10 w-10 items-center justify-center rounded-lg"
                  style={{ 
                    background: gradientEnabled 
                      ? `linear-gradient(135deg, ${accentColor}, ${accentColor}88)` 
                      : 'hsl(var(--muted))'
                  }}
                >
                  <Sparkles className={cn("h-5 w-5", gradientEnabled ? "text-white" : "text-muted-foreground")} />
                </div>
                <div className="text-left">
                  <p className="font-medium">Gradient Glow</p>
                  <p className="text-xs text-muted-foreground">
                    {gradientEnabled ? "Ambient effects on" : "Ambient effects off"}
                  </p>
                </div>
              </div>
              {gradientEnabled && (
                <div 
                  className="absolute bottom-0 left-0 right-0 h-0.5"
                  style={{ backgroundColor: accentColor }}
                />
              )}
            </button>

            <button
              onClick={() => setMicroAnimations(!microAnimations)}
              className={cn(
                "relative overflow-hidden rounded-xl border-2 p-4 transition-all duration-300",
                "hover:scale-[1.02] active:scale-[0.98]",
                microAnimations 
                  ? "border-primary bg-primary/5" 
                  : "border-border hover:border-primary/50"
              )}
            >
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/20">
                  <Zap className={cn("h-5 w-5", microAnimations ? "text-primary animate-pulse" : "text-muted-foreground")} />
                </div>
                <div className="text-left">
                  <p className="font-medium">Micro Motion</p>
                  <p className="text-xs text-muted-foreground">
                    {microAnimations ? "Smooth animations" : "Static interface"}
                  </p>
                </div>
              </div>
              {microAnimations && (
                <div 
                  className="absolute bottom-0 left-0 right-0 h-0.5"
                  style={{ backgroundColor: accentColor }}
                />
              )}
            </button>
          </div>

          <div className="border-t border-border pt-4">
            <label className="text-sm font-medium mb-3 block">Navigation Layout</label>
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => setNavStyle("top")}
                className={cn(
                  "relative overflow-hidden rounded-xl border-2 p-4 transition-all duration-300",
                  "hover:scale-[1.02] active:scale-[0.98]",
                  navStyle === "top" 
                    ? "border-primary bg-primary/5" 
                    : "border-border hover:border-primary/50"
                )}
              >
                <div className="flex flex-col items-center gap-2">
                  <Layout className={cn("h-6 w-6", navStyle === "top" ? "text-primary" : "text-muted-foreground")} />
                  <p className="font-medium text-sm">Top Navigation</p>
                </div>
                {navStyle === "top" && (
                  <div 
                    className="absolute top-2 right-2 h-5 w-5 rounded-full flex items-center justify-center"
                    style={{ backgroundColor: accentColor }}
                  >
                    <Check className="h-3 w-3 text-white" />
                  </div>
                )}
              </button>

              <button
                onClick={() => setNavStyle("sidebar")}
                className={cn(
                  "relative overflow-hidden rounded-xl border-2 p-4 transition-all duration-300",
                  "hover:scale-[1.02] active:scale-[0.98]",
                  navStyle === "sidebar" 
                    ? "border-primary bg-primary/5" 
                    : "border-border hover:border-primary/50"
                )}
              >
                <div className="flex flex-col items-center gap-2">
                  <Columns className={cn("h-6 w-6", navStyle === "sidebar" ? "text-primary" : "text-muted-foreground")} />
                  <p className="font-medium text-sm">Sidebar</p>
                </div>
                {navStyle === "sidebar" && (
                  <div 
                    className="absolute top-2 right-2 h-5 w-5 rounded-full flex items-center justify-center"
                    style={{ backgroundColor: accentColor }}
                  >
                    <Check className="h-3 w-3 text-white" />
                  </div>
                )}
              </button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="glass">
        <CardHeader>
          <CardTitle>Dashboard layout</CardTitle>
          <CardDescription>Reorder widgets, add or hide stats, and personalize the layout.</CardDescription>
        </CardHeader>
        <CardContent>
          <div
            role="status"
            aria-live="polite"
            className="rounded-xl border border-dashed border-border p-8 text-center"
            style={{
              background: `repeating-linear-gradient(
                45deg,
                ${accentColor}08 0,
                ${accentColor}08 1px,
                transparent 1px,
                transparent 10px
              )`
            }}
          >
            <Layout
              className="h-10 w-10 mx-auto text-muted-foreground mb-3 opacity-50"
              aria-hidden="true"
            />
            <p className="text-sm text-muted-foreground mb-2">Drag-drop and widget customization</p>
            <p className="text-xs text-muted-foreground opacity-75">Coming in a future update</p>
          </div>
        </CardContent>
      </Card>

      <Card className="glass">
        <CardHeader>
          <CardTitle>Account</CardTitle>
          <CardDescription>Manage your account settings and sessions.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Profile Info */}
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <User className="h-4 w-4 text-muted-foreground" />
              <h3 className="text-sm font-medium">Profile Information</h3>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="text-sm text-muted-foreground">Full Name</label>
                <input
                  type="text"
                  value={profileName}
                  onChange={(event) => setProfileName(event.target.value)}
                  placeholder="Enter your name"
                  className="w-full mt-1 h-10 px-3 rounded-lg border border-input bg-background text-sm"
                />
              </div>
              <div>
                <label className="text-sm text-muted-foreground">Email</label>
                <input
                  type="email"
                  value={profile?.email || user?.email || ""}
                  disabled
                  className="w-full mt-1 h-10 px-3 rounded-lg border border-input bg-muted text-sm text-muted-foreground cursor-not-allowed"
                />
              </div>
            </div>
            {impersonation && (
              <p className="text-xs text-amber-600 dark:text-amber-300">
                You are editing settings as {impersonation.memberName || "impersonated user"}.
              </p>
            )}
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="text-sm text-muted-foreground">Avatar URL</label>
                <div className="mt-1 flex items-center gap-2">
                  <input
                    type="url"
                    value={avatarUrl}
                    onChange={(event) => setAvatarUrl(event.target.value)}
                    placeholder="https://..."
                    className="h-10 flex-1 px-3 rounded-lg border border-input bg-background text-sm"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setAvatarPickerOpen(true)}
                  >
                    Pick Avatar
                  </Button>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  Priority: App avatar - LinkedIn/OAuth avatar - Email profile avatar (Gravatar/Libravatar) - Cartoon fallback - Initials.
                </p>
              </div>
              <div className="flex items-end gap-3">
                <UserAvatar
                  profile={{
                    full_name: profileName,
                    avatar_url: avatarUrl || profile?.avatar_url,
                    email: profile?.email || user?.email || null,
                  }}
                  user={avatarUser}
                  sizeClass="h-12 w-12"
                  textClass="text-base"
                />
                <p className="text-xs text-muted-foreground">LinkedIn/OAuth or app avatar first, with initials available as an explicit option.</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Button size="sm" onClick={handleSaveProfile} disabled={savingProfile}>
                {savingProfile ? "Saving..." : "Save Profile"}
              </Button>
              {profileMessage && <p className="text-xs text-muted-foreground">{profileMessage}</p>}
            </div>
          </div>

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
                  <p className="text-sm font-medium">Avatar Picker</p>
                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setAvatarVariant((value) => value + 1)}
                    >
                      Shuffle Set
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
                      Use Auto Priority
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
                        Use {linkedInAvatar ? "LinkedIn" : "OAuth"} Avatar
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
                      Use Initials
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
                        <img src={option} alt="Avatar option" className="h-12 w-12 rounded-lg object-cover" />
                      </button>
                    )
                  })}
                </div>
              </div>
            </div>
          )}

          {/* Password Change */}
          <div className="space-y-4 border-t border-border pt-4">
            <div className="flex items-center gap-2">
              <Key className="h-4 w-4 text-muted-foreground" />
              <h3 className="text-sm font-medium">Change Password</h3>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="text-sm text-muted-foreground">Current Password</label>
                <input
                  type="password"
                  placeholder="Enter current password"
                  className="w-full mt-1 h-10 px-3 rounded-lg border border-input bg-background text-sm"
                />
              </div>
              <div>
                <label className="text-sm text-muted-foreground">New Password</label>
                <input
                  type="password"
                  placeholder="Enter new password"
                  className="w-full mt-1 h-10 px-3 rounded-lg border border-input bg-background text-sm"
                />
              </div>
            </div>
            <Button size="sm">Update Password</Button>
          </div>

          {/* Active Sessions */}
          <div className="space-y-4 border-t border-border pt-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Monitor className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                <h3 className="text-sm font-medium">Active Sessions</h3>
              </div>
              <span className="text-xs px-2 py-1 rounded-full bg-primary/10 text-primary" aria-label="1 active session">
                1 device
              </span>
            </div>
            <div
              role="list"
              aria-label="Active device sessions"
              className="rounded-lg border border-border p-3 space-y-2"
            >
              <div role="listitem" className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2">
                  <div
                    className="h-2 w-2 rounded-full bg-green-500"
                    aria-hidden="true"
                  />
                  <span className="font-medium">This device</span>
                </div>
                <span className="text-muted-foreground text-xs">Current session</span>
              </div>
              <p className="text-xs text-muted-foreground" aria-label="Account email">
                {user?.email}
              </p>
              <p className="text-xs text-muted-foreground">Last active: Just now</p>
            </div>
            <p className="text-xs text-muted-foreground">
              Additional session management features coming soon.
            </p>
          </div>

          {/* Sign Out */}
          <div className="space-y-4 border-t border-border pt-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-medium">Sign Out</h3>
                <p className="text-xs text-muted-foreground">End all sessions on all devices</p>
              </div>
            </div>
            <Button variant="destructive" onClick={() => signOut()}>
              Sign Out of All Devices
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
