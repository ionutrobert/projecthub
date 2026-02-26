"use client"

import { useEffect, useMemo, useState } from "react"
import { Building2, Loader2, Pencil, Plus, Search, Trash2 } from "lucide-react"

import { useUser } from "@/components/user-provider"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"

type Client = {
  id: string
  name: string
  contact_email: string | null
  contact_phone: string | null
  website: string | null
  company: string | null
  notes: string | null
  created_at: string
  updated_at: string | null
}

type ClientForm = {
  name: string
  contact_email: string
  contact_phone: string
  website: string
  company: string
  notes: string
}

const EMPTY_FORM: ClientForm = {
  name: "",
  contact_email: "",
  contact_phone: "",
  website: "",
  company: "",
  notes: "",
}

function toPayload(form: ClientForm) {
  return {
    name: form.name.trim(),
    contact_email: form.contact_email.trim() || null,
    contact_phone: form.contact_phone.trim() || null,
    website: form.website.trim() || null,
    company: form.company.trim() || null,
    notes: form.notes.trim() || null,
  }
}

export default function ClientsPage() {
  const { profile } = useUser()
  const canEdit = profile?.role === "admin" || profile?.role === "member"
  const canDelete = profile?.role === "admin"

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [clients, setClients] = useState<Client[]>([])
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState("")
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<Client | null>(null)
  const [form, setForm] = useState<ClientForm>(EMPTY_FORM)

  const loadClients = async () => {
    setLoading(true)
    setError(null)
    try {
      const response = await fetch("/api/clients", { cache: "no-store" })
      const data = await response.json()
      if (!response.ok) {
        throw new Error(data?.error || "Failed to load clients")
      }
      setClients(Array.isArray(data) ? data : [])
    } catch (err) {
      setClients([])
      setError(err instanceof Error ? err.message : "Failed to load clients")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void loadClients()
  }, [])

  const filteredClients = useMemo(() => {
    const query = search.trim().toLowerCase()
    if (!query) return clients
    return clients.filter((client) => {
      return [client.name, client.company, client.contact_email, client.contact_phone]
        .filter(Boolean)
        .some((value) => value?.toLowerCase().includes(query))
    })
  }, [clients, search])

  const openCreate = () => {
    setEditing(null)
    setForm(EMPTY_FORM)
    setDialogOpen(true)
  }

  const openEdit = (client: Client) => {
    setEditing(client)
    setForm({
      name: client.name || "",
      contact_email: client.contact_email || "",
      contact_phone: client.contact_phone || "",
      website: client.website || "",
      company: client.company || "",
      notes: client.notes || "",
    })
    setDialogOpen(true)
  }

  const handleSubmit = async () => {
    if (!canEdit || !form.name.trim()) return
    setSaving(true)
    setError(null)

    try {
      const response = await fetch(editing ? `/api/clients/${editing.id}` : "/api/clients", {
        method: editing ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(toPayload(form)),
      })
      const data = await response.json()
      if (!response.ok) {
        throw new Error(data?.error || "Failed to save client")
      }

      if (editing) {
        setClients((prev) => prev.map((client) => (client.id === data.id ? data : client)))
      } else {
        setClients((prev) => [...prev, data].sort((a, b) => a.name.localeCompare(b.name)))
      }

      setDialogOpen(false)
      setEditing(null)
      setForm(EMPTY_FORM)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save client")
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (clientId: string) => {
    if (!canDelete) return
    if (!confirm("Delete this client? This action cannot be undone.")) return

    const previous = clients
    setClients((prev) => prev.filter((client) => client.id !== clientId))

    try {
      const response = await fetch(`/api/clients/${clientId}`, { method: "DELETE" })
      const data = await response.json().catch(() => null)
      if (!response.ok) {
        throw new Error(data?.error || "Failed to delete client")
      }
    } catch (err) {
      setClients(previous)
      setError(err instanceof Error ? err.message : "Failed to delete client")
    }
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Clients</h1>
          <p className="text-sm text-muted-foreground sm:text-base">
            Manage client records and keep project ownership clear.
          </p>
        </div>

        <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center">
          <div className="relative w-full sm:w-72">
            <Search className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search clients"
              className="h-10 w-full rounded-md border border-input bg-background pl-8 pr-3 text-sm"
            />
          </div>

          {canEdit && (
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
              <DialogTrigger asChild>
                <Button onClick={openCreate}>
                  <Plus className="mr-2 h-4 w-4" />
                  Add Client
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-xl">
                <DialogHeader>
                  <DialogTitle>{editing ? "Edit client" : "Add client"}</DialogTitle>
                  <DialogDescription>
                    {editing
                      ? "Update client details used in project assignment and reporting."
                      : "Create a client with minimum required info. You can enrich details later."}
                  </DialogDescription>
                </DialogHeader>

                <div className="grid gap-3 py-1">
                  <div className="grid gap-1.5">
                    <label className="text-sm font-medium">Name *</label>
                    <input
                      value={form.name}
                      onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))}
                      placeholder="Acme Corp"
                      className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                    />
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="grid gap-1.5">
                      <label className="text-sm font-medium">Contact email</label>
                      <input
                        type="email"
                        value={form.contact_email}
                        onChange={(event) => setForm((prev) => ({ ...prev, contact_email: event.target.value }))}
                        placeholder="contact@acme.com"
                        className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                      />
                    </div>
                    <div className="grid gap-1.5">
                      <label className="text-sm font-medium">Contact phone</label>
                      <input
                        value={form.contact_phone}
                        onChange={(event) => setForm((prev) => ({ ...prev, contact_phone: event.target.value }))}
                        placeholder="+1 555 123 4567"
                        className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                      />
                    </div>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="grid gap-1.5">
                      <label className="text-sm font-medium">Website</label>
                      <input
                        value={form.website}
                        onChange={(event) => setForm((prev) => ({ ...prev, website: event.target.value }))}
                        placeholder="https://acme.com"
                        className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                      />
                    </div>
                    <div className="grid gap-1.5">
                      <label className="text-sm font-medium">Company</label>
                      <input
                        value={form.company}
                        onChange={(event) => setForm((prev) => ({ ...prev, company: event.target.value }))}
                        placeholder="Acme Holdings"
                        className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                      />
                    </div>
                  </div>

                  <div className="grid gap-1.5">
                    <label className="text-sm font-medium">Notes</label>
                    <textarea
                      rows={4}
                      value={form.notes}
                      onChange={(event) => setForm((prev) => ({ ...prev, notes: event.target.value }))}
                      placeholder="Context, preferences, contract notes..."
                      className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    />
                  </div>
                </div>

                <DialogFooter>
                  <Button variant="outline" onClick={() => setDialogOpen(false)} disabled={saving}>
                    Cancel
                  </Button>
                  <Button onClick={handleSubmit} disabled={saving || !form.name.trim()}>
                    {saving ? "Saving..." : editing ? "Save client" : "Create client"}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          )}
        </div>
      </div>

      {error && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
          {error}
        </div>
      )}

      {loading ? (
        <Card>
          <CardContent className="flex items-center justify-center py-10">
            <Loader2 className="h-6 w-6 animate-spin" />
          </CardContent>
        </Card>
      ) : filteredClients.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center gap-3 py-12 text-center text-muted-foreground">
            <div className="rounded-full bg-primary/10 p-3">
              <Building2 className="h-6 w-6 text-primary" />
            </div>
            <p className="text-sm">No clients found yet.</p>
            {canEdit && (
              <Button variant="outline" onClick={openCreate}>
                <Plus className="mr-2 h-4 w-4" />
                Create first client
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="grid gap-3 md:hidden">
            {filteredClients.map((client) => (
              <Card key={client.id} className="glass">
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <CardTitle className="text-base">{client.name}</CardTitle>
                      <p className="text-xs text-muted-foreground">{client.company || "No company"}</p>
                    </div>
                    <Badge variant="outline">Client</Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-2 text-sm">
                  <p className="text-muted-foreground">{client.contact_email || "No contact email"}</p>
                  <p className="text-muted-foreground">{client.contact_phone || "No contact phone"}</p>
                  {client.website && (
                    <a className="text-primary underline-offset-2 hover:underline" href={client.website} target="_blank" rel="noreferrer">
                      {client.website}
                    </a>
                  )}
                  {client.notes && <p className="line-clamp-2 text-muted-foreground">{client.notes}</p>}
                  {canEdit && (
                    <div className="flex items-center gap-2 pt-2">
                      <Button variant="outline" size="sm" onClick={() => openEdit(client)}>
                        <Pencil className="mr-1.5 h-3.5 w-3.5" />
                        Edit
                      </Button>
                      {canDelete && (
                        <Button variant="outline" size="sm" onClick={() => handleDelete(client.id)}>
                          <Trash2 className="mr-1.5 h-3.5 w-3.5" />
                          Delete
                        </Button>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>

          <Card className="hidden md:block glass">
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Company</TableHead>
                    <TableHead>Contact</TableHead>
                    <TableHead>Website</TableHead>
                    <TableHead>Notes</TableHead>
                    {canEdit && <TableHead className="w-[140px] text-right">Actions</TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredClients.map((client) => (
                    <TableRow key={client.id}>
                      <TableCell className="font-medium">{client.name}</TableCell>
                      <TableCell>{client.company || "-"}</TableCell>
                      <TableCell>
                        <div className="space-y-0.5">
                          <p className="text-sm">{client.contact_email || "-"}</p>
                          <p className="text-xs text-muted-foreground">{client.contact_phone || ""}</p>
                        </div>
                      </TableCell>
                      <TableCell>
                        {client.website ? (
                          <a className="text-primary underline-offset-2 hover:underline" href={client.website} target="_blank" rel="noreferrer">
                            Open
                          </a>
                        ) : (
                          "-"
                        )}
                      </TableCell>
                      <TableCell className="max-w-[240px] truncate text-muted-foreground">
                        {client.notes || "-"}
                      </TableCell>
                      {canEdit && (
                        <TableCell className="text-right">
                          <div className="inline-flex items-center gap-1">
                            <Button variant="ghost" size="icon" onClick={() => openEdit(client)}>
                              <Pencil className="h-4 w-4" />
                            </Button>
                            {canDelete && (
                              <Button variant="ghost" size="icon" onClick={() => handleDelete(client.id)}>
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      )}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  )
}
