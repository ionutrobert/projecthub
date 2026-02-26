"use client"

import { useEffect, useMemo, useState } from "react"
import { Eye, Mail, Pencil, Plus, Search, Shield, Trash2, UserPlus, Users } from "lucide-react"

import MemberAvatar from "@/components/member-avatar"
import { useUser } from "@/components/user-provider"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

type Member = {
  id: string
  user_id?: string | null
  avatar_url?: string | null
  name: string
  email: string | null
  role: string
}

const ROLE_OPTIONS = ["admin", "member", "viewer", "developer", "designer", "pm", "accountant"]

export default function TeamPage() {
  const { profile, impersonation, clearImpersonation, loading: userLoading } = useUser()
  const currentRole = profile?.role || "viewer"
  const actualRole = profile?.actual_role || currentRole
  const canEdit = currentRole === "admin" || currentRole === "member"
  const isAdmin = actualRole === "admin"

  const [members, setMembers] = useState<Member[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [showCreate, setShowCreate] = useState(false)
  const [newName, setNewName] = useState("")
  const [newEmail, setNewEmail] = useState("")
  const [newPassword, setNewPassword] = useState("")
  const [newRole, setNewRole] = useState("developer")
  const [createLoginAccount, setCreateLoginAccount] = useState(true)
  const [saving, setSaving] = useState(false)
  const [draftRoles, setDraftRoles] = useState<Record<string, string>>({})
  const [editingMemberId, setEditingMemberId] = useState<string | null>(null)
  const [impersonatingMemberId, setImpersonatingMemberId] = useState<string | null>(null)
  const [search, setSearch] = useState("")
  const [roleFilter, setRoleFilter] = useState("__all__")

  const dedupedMembers = useMemo(() => {
    return members.filter((member, index, all) => {
      const key = `${member.name.toLowerCase()}::${(member.email || "").toLowerCase()}`
      return (
        all.findIndex((candidate) => {
          const candidateKey = `${candidate.name.toLowerCase()}::${(candidate.email || "").toLowerCase()}`
          return candidateKey === key
        }) === index
      )
    })
  }, [members])

  const filteredMembers = useMemo(() => {
    const searchTerm = search.trim().toLowerCase()
    return dedupedMembers.filter((member) => {
      const matchesSearch =
        !searchTerm ||
        member.name.toLowerCase().includes(searchTerm) ||
        (member.email || "").toLowerCase().includes(searchTerm) ||
        member.role.toLowerCase().includes(searchTerm)
      const matchesRole = roleFilter === "__all__" || member.role === roleFilter
      return matchesSearch && matchesRole
    })
  }, [dedupedMembers, search, roleFilter])

  const roleStats = useMemo(() => {
    const stats = dedupedMembers.reduce<Record<string, number>>((acc, member) => {
      acc[member.role] = (acc[member.role] || 0) + 1
      return acc
    }, {})
    return {
      total: dedupedMembers.length,
      admin: stats.admin || 0,
      member: stats.member || 0,
      viewer: stats.viewer || 0,
    }
  }, [dedupedMembers])

  const fetchMembers = async () => {
    setLoading(true)
    setError(null)
    try {
      const response = await fetch("/api/members", { cache: "no-store" })
      const data = await response.json()
      if (!response.ok) {
        setError(data?.error || "Failed to load team members")
        setMembers([])
        return
      }
      setMembers(Array.isArray(data) ? data : [])
    } catch {
      setError("Failed to load team members")
      setMembers([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (!userLoading) {
      fetchMembers()
    }
  }, [userLoading])

  useEffect(() => {
    setDraftRoles(
      members.reduce<Record<string, string>>((acc, member) => {
        acc[member.id] = member.role
        return acc
      }, {})
    )
  }, [members])

  const handleCreateMember = async () => {
    if (!newName.trim()) return
    if (createLoginAccount && (!newEmail.trim() || newPassword.length < 8)) {
      setError("Email and password (min 8 chars) are required to create a login account")
      return
    }
    setSaving(true)
    setError(null)
    try {
      const endpoint = createLoginAccount ? "/api/admin/users" : "/api/members"
      const payload = createLoginAccount
        ? {
            name: newName.trim(),
            email: newEmail.trim(),
            password: newPassword,
            role: newRole,
          }
        : {
            name: newName.trim(),
            email: newEmail.trim() || null,
            role: newRole,
          }

      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })
      const data = await response.json()
      if (!response.ok) {
        setError(data?.error || "Failed to create member")
        return
      }

      await fetchMembers()
      setShowCreate(false)
      setNewName("")
      setNewEmail("")
      setNewPassword("")
      setNewRole("developer")
      setCreateLoginAccount(true)
    } catch {
      setError("Failed to create member")
    } finally {
      setSaving(false)
    }
  }

  const updateMemberRole = async (member: Member, role: string) => {
    const previous = members
    setMembers((prev) => prev.map((item) => (item.id === member.id ? { ...item, role } : item)))
    const response = await fetch(`/api/members/${member.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ role }),
    })

    if (!response.ok) {
      const data = await response.json().catch(() => ({}))
      setError(data?.error || "Failed to update member role")
      setMembers(previous)
    }
  }

  const handleDeleteMember = async (id: string) => {
    if (!confirm("Remove this team member?")) return
    const previous = members
    setMembers((prev) => prev.filter((member) => member.id !== id))
    const response = await fetch(`/api/members/${id}`, { method: "DELETE" })
    if (!response.ok) {
      const data = await response.json().catch(() => ({}))
      setError(data?.error || "Failed to delete member")
      setMembers(previous)
    }
  }

  const startImpersonation = async (member: Member) => {
    if (!isAdmin) return
    if (!member.user_id) {
      setError("This member does not have a login account yet. Create a login account first.")
      return
    }

    setError(null)
    setImpersonatingMemberId(member.id)

    try {
      const response = await fetch("/api/admin/impersonation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          role: member.role,
          memberName: member.name,
          memberId: member.id,
        }),
      })

      if (!response.ok) {
        const data = await response.json().catch(() => ({}))
        setError(data?.error || "Failed to start impersonation")
        return
      }

      window.location.reload()
    } catch {
      setError("Failed to start impersonation")
    } finally {
      setImpersonatingMemberId(null)
    }
  }

  const stopImpersonation = async () => {
    setError(null)
    try {
      await clearImpersonation()
      window.location.reload()
    } catch {
      setError("Failed to stop impersonation")
    }
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Team</h1>
          <p className="text-muted-foreground">Manage users, roles, and impersonation controls.</p>
        </div>
        {canEdit && (
          <Button className="btn-glow w-full sm:w-auto" onClick={() => setShowCreate((prev) => !prev)}>
            <UserPlus className="mr-2 h-4 w-4" />
            {showCreate ? "Close" : "Add Member"}
          </Button>
        )}
      </div>

      {showCreate && canEdit && (
        <Card className="glass">
          <CardContent className="grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-5">
            <input
              value={newName}
              onChange={(event) => setNewName(event.target.value)}
              placeholder="Full name"
              className="h-10 rounded-lg border border-input bg-background px-3 text-sm"
            />
            <input
              value={newEmail}
              onChange={(event) => setNewEmail(event.target.value)}
              placeholder={createLoginAccount ? "Email (required)" : "Email (optional)"}
              className="h-10 rounded-lg border border-input bg-background px-3 text-sm"
            />
            <input
              type="password"
              value={newPassword}
              onChange={(event) => setNewPassword(event.target.value)}
              placeholder={createLoginAccount ? "Password (min 8 chars)" : "Password (optional)"}
              disabled={!createLoginAccount}
              className="h-10 rounded-lg border border-input bg-background px-3 text-sm disabled:cursor-not-allowed disabled:opacity-50"
            />
            <select
              value={newRole}
              onChange={(event) => setNewRole(event.target.value)}
              className="h-10 rounded-lg border border-input bg-background px-3 text-sm"
            >
              {ROLE_OPTIONS.map((role) => (
                <option key={role} value={role}>
                  {role}
                </option>
              ))}
            </select>
            <div className="space-y-2">
              <label className="inline-flex items-center gap-2 text-xs text-muted-foreground">
                <input
                  type="checkbox"
                  checked={createLoginAccount}
                  onChange={(event) => setCreateLoginAccount(event.target.checked)}
                />
                Create login account (email auto-confirmed)
              </label>
              <Button onClick={handleCreateMember} disabled={saving || !newName.trim()} className="w-full">
                <Plus className="mr-2 h-4 w-4" />
                {saving ? "Saving..." : createLoginAccount ? "Create User" : "Create Member"}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {createLoginAccount && (
        <p className="-mt-4 text-xs text-muted-foreground">
          Users created here are confirmed immediately and can sign in without email verification.
        </p>
      )}

      {error && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
          {error}
        </div>
      )}

      {impersonation && (
        <div className="rounded-lg border border-amber-400/30 bg-amber-500/10 p-3 text-sm text-amber-700 dark:text-amber-300">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p>
              Impersonating <span className="font-medium">{impersonation.memberName || "user"}</span> as{" "}
              <span className="font-medium capitalize">{impersonation.role}</span>.
            </p>
            <Button variant="outline" size="sm" className="h-8" onClick={stopImpersonation}>
              Stop impersonating
            </Button>
          </div>
        </div>
      )}

      {loading ? (
        <Card>
          <CardContent className="p-6 text-sm text-muted-foreground">Loading team members...</CardContent>
        </Card>
      ) : dedupedMembers.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center gap-2 py-10 text-muted-foreground">
            <Users className="h-10 w-10" />
            <p>No team members yet.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <Card className="glass">
              <CardContent className="p-3">
                <p className="text-xs text-muted-foreground">Total</p>
                <p className="text-xl font-semibold">{roleStats.total}</p>
              </CardContent>
            </Card>
            <Card className="glass">
              <CardContent className="p-3">
                <p className="text-xs text-muted-foreground">Admins</p>
                <p className="text-xl font-semibold">{roleStats.admin}</p>
              </CardContent>
            </Card>
            <Card className="glass">
              <CardContent className="p-3">
                <p className="text-xs text-muted-foreground">Members</p>
                <p className="text-xl font-semibold">{roleStats.member}</p>
              </CardContent>
            </Card>
            <Card className="glass">
              <CardContent className="p-3">
                <p className="text-xs text-muted-foreground">Viewers</p>
                <p className="text-xl font-semibold">{roleStats.viewer}</p>
              </CardContent>
            </Card>
          </div>

          <Card className="glass">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Team Directory</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                <div className="relative flex-1">
                  <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                  <input
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    placeholder="Search name, email, or role"
                    className="h-9 w-full rounded-md border border-input bg-background pl-9 pr-3 text-sm"
                  />
                </div>
                <select
                  value={roleFilter}
                  onChange={(event) => setRoleFilter(event.target.value)}
                  className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm sm:w-44"
                >
                  <option value="__all__">All roles</option>
                  {Array.from(new Set(dedupedMembers.map((member) => member.role))).map((role) => (
                    <option key={role} value={role}>
                      {role}
                    </option>
                  ))}
                </select>
              </div>

              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="h-9">Member</TableHead>
                    <TableHead className="h-9">Email</TableHead>
                    <TableHead className="h-9">Role</TableHead>
                    <TableHead className="h-9 text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredMembers.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={4} className="py-6 text-center text-sm text-muted-foreground">
                        No matching team members.
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredMembers.map((member) => {
                      const draftRole = draftRoles[member.id] || member.role
                      const roleChanged = draftRole !== member.role
                      const isRowEditing = editingMemberId === member.id
                      const isImpersonatingThisMember = impersonation?.memberId === member.id

                      return (
                        <TableRow key={member.id}>
                          <TableCell className="py-2">
                            <div className="flex items-center gap-2">
                              <MemberAvatar
                                name={member.name}
                                email={member.email}
                                userId={member.user_id || null}
                                avatarUrl={member.avatar_url || null}
                                sizeClass="h-8 w-8"
                                textClass="text-[11px]"
                              />
                              <div className="min-w-0">
                                <p className="truncate text-sm font-medium">{member.name}</p>
                                {member.role.toLowerCase() === "admin" && (
                                  <Badge variant="secondary" className="mt-1 h-5 px-2 text-[10px]">
                                    <Shield className="mr-1 h-3 w-3" /> Admin
                                  </Badge>
                                )}
                              </div>
                            </div>
                          </TableCell>
                          <TableCell className="py-2 text-sm text-muted-foreground">
                            <span className="inline-flex items-center gap-1">
                              <Mail className="h-3 w-3" />
                              {member.email || "No email"}
                            </span>
                          </TableCell>
                          <TableCell className="py-2">
                            {isRowEditing ? (
                              <select
                                value={draftRole}
                                onChange={(event) =>
                                  setDraftRoles((prev) => ({ ...prev, [member.id]: event.target.value }))
                                }
                                disabled={!canEdit}
                                className="h-8 w-32 rounded-md border border-input bg-background px-2 text-xs disabled:cursor-not-allowed disabled:opacity-50"
                              >
                                {Array.from(new Set([...ROLE_OPTIONS, member.role, draftRole]))
                                  .filter(Boolean)
                                  .map((role) => (
                                    <option key={role} value={role}>
                                      {role}
                                    </option>
                                  ))}
                              </select>
                            ) : (
                              <Badge variant="outline" className="capitalize">
                                {member.role}
                              </Badge>
                            )}
                          </TableCell>
                          <TableCell className="py-2">
                            <div className="flex items-center justify-end gap-2">
                              {canEdit && (
                                <Button
                                  variant={isRowEditing ? "secondary" : "outline"}
                                  size="sm"
                                  className="h-8 px-2 text-xs"
                                  onClick={() => setEditingMemberId((current) => (current === member.id ? null : member.id))}
                                >
                                  <Pencil className="mr-1 h-3.5 w-3.5" />
                                  Edit
                                </Button>
                              )}

                              {isAdmin && (
                                <Button
                                  variant={isImpersonatingThisMember ? "secondary" : "outline"}
                                  size="sm"
                                  className="h-8 px-2 text-xs"
                                  disabled={impersonatingMemberId === member.id || !member.user_id}
                                  onClick={() => startImpersonation(member)}
                                  title={!member.user_id ? "No login account linked" : "Impersonate this user"}
                                >
                                  <Eye className="mr-1 h-3.5 w-3.5" />
                                  {impersonatingMemberId === member.id ? "Starting..." : "Impersonate"}
                                </Button>
                              )}

                              {isAdmin && isRowEditing && (
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8"
                                  onClick={() => handleDeleteMember(member.id)}
                                  title="Delete member"
                                >
                                  <Trash2 className="h-4 w-4 text-destructive" />
                                </Button>
                              )}

                              {canEdit && isRowEditing && roleChanged && (
                                <Button
                                  variant="default"
                                  size="sm"
                                  className="h-8 px-2 text-xs"
                                  onClick={() => updateMemberRole(member, draftRole)}
                                >
                                  Save
                                </Button>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      )
                    })
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}
