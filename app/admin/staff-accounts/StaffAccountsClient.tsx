// app/admin/staff-accounts/StaffAccountsClient.tsx
'use client'
import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import {
  UserPlus, Copy, Check, Trash2, Crown, User,
  Clock, Link2, RotateCcw, ChevronDown, ChevronUp, Send,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import type { Profile, Invitation, StaffPermission } from '@/types'
import { useVertical } from '@/lib/vertical-context'

const ROLE_CONF = {
  owner:      { label: 'Propietario', bg: '#FEF3C7', text: '#92400E', icon: <Crown size={11} /> },
  staff:      { label: 'Empleado',    bg: '#EFF6FF', text: '#1D4ED8', icon: <User size={11} /> },
  superadmin: { label: 'SuperAdmin',  bg: '#F3E8FF', text: '#6D28D9', icon: <Crown size={11} /> },
}

type PermKey = keyof Omit<StaffPermission, 'id' | 'profile_id' | 'business_id' | 'created_at' | 'updated_at'>

const PERM_GROUPS: { group: string; perms: { key: PermKey; label: string }[] }[] = [
  { group: 'Pedidos',    perms: [{ key: 'can_view_orders',     label: 'Ver' },       { key: 'can_manage_orders',    label: 'Gestionar' }] },
  { group: 'Productos',  perms: [{ key: 'can_view_products',   label: 'Ver' },       { key: 'can_manage_products',  label: 'Gestionar' }] },
  { group: 'Clientes',   perms: [{ key: 'can_view_customers',  label: 'Ver' },       { key: 'can_view_analytics',   label: 'Analytics' }] },
  { group: 'Inventario', perms: [{ key: 'can_view_inventory',  label: 'Ver' },       { key: 'can_manage_inventory', label: 'Gestionar' }] },
  { group: 'Especiales', perms: [{ key: 'can_use_pos',         label: 'POS' },       { key: 'can_manage_tables',    label: 'Mesas' }] },
]

const DEFAULT_PERMS: Record<PermKey, boolean> = {
  can_view_orders: true,  can_manage_orders: true,
  can_view_products: true, can_manage_products: false,
  can_view_customers: false, can_view_analytics: false,
  can_view_inventory: false, can_manage_inventory: false,
  can_use_pos: false, can_manage_tables: true,
}

function initial(str?: string | null) {
  return (str ?? '?').slice(0, 1).toUpperCase()
}

function daysLeft(expiresAt: string): string {
  const d = Math.ceil((new Date(expiresAt).getTime() - Date.now()) / 86_400_000)
  return d <= 0 ? 'vencida' : `${d}d`
}

function Toggle({ value, onChange, disabled }: {
  value: boolean
  onChange: (v: boolean) => void
  disabled?: boolean
}) {
  return (
    <button
      type="button"
      onClick={() => !disabled && onChange(!value)}
      disabled={disabled}
      className={cn(
        'relative inline-flex h-5 w-9 items-center rounded-full transition-colors shrink-0',
        value ? 'bg-indigo-500' : 'bg-gray-200',
        disabled && 'opacity-50 cursor-not-allowed'
      )}
    >
      <span
        className={cn(
          'inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow-sm transition-transform',
          value ? 'translate-x-5' : 'translate-x-0.5'
        )}
      />
    </button>
  )
}

function PermGrid({ profileId, businessId, permissions, primaryColor }: {
  profileId: string
  businessId: string
  permissions: Record<PermKey, boolean>
  primaryColor: string
}) {
  void primaryColor
  const supabase = createClient()
  const [perms, setPerms]   = useState(permissions)
  const [saving, setSaving] = useState<PermKey | null>(null)

  async function toggle(key: PermKey) {
    const next = !perms[key]
    setSaving(key)
    setPerms(p => ({ ...p, [key]: next }))
    await supabase.from('staff_permissions').upsert(
      { profile_id: profileId, business_id: businessId, [key]: next },
      { onConflict: 'profile_id' }
    )
    setSaving(null)
  }

  return (
    <div className="mt-3 rounded-xl border border-gray-100 bg-gray-50 p-4 space-y-3">
      {PERM_GROUPS.map(({ group, perms: gp }) => (
        <div key={group} className="flex items-start gap-2 flex-wrap">
          <span className="w-20 pt-0.5 text-[11px] font-semibold text-gray-400 shrink-0">{group}</span>
          <div className="flex items-center gap-5 flex-wrap">
            {gp.map(({ key, label }) => (
              <label key={key} className="flex items-center gap-1.5 cursor-pointer select-none">
                <Toggle value={perms[key]} onChange={() => toggle(key)} disabled={saving === key} />
                <span className="text-xs text-gray-600">{label}</span>
              </label>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

function InitPermGrid({ perms, onChange }: {
  perms: Record<PermKey, boolean>
  onChange: (key: PermKey, v: boolean) => void
}) {
  return (
    <div className="mt-3 rounded-xl border border-gray-100 bg-gray-50 p-4 space-y-3">
      {PERM_GROUPS.map(({ group, perms: gp }) => (
        <div key={group} className="flex items-start gap-2 flex-wrap">
          <span className="w-20 pt-0.5 text-[11px] font-semibold text-gray-400 shrink-0">{group}</span>
          <div className="flex items-center gap-5 flex-wrap">
            {gp.map(({ key, label }) => (
              <label key={key} className="flex items-center gap-1.5 cursor-pointer select-none">
                <Toggle value={perms[key]} onChange={v => onChange(key, v)} />
                <span className="text-xs text-gray-600">{label}</span>
              </label>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

export default function StaffAccountsClient({
  currentUserId,
  profiles: initialProfiles,
  invitations: initialInvites,
}: {
  currentUserId: string
  profiles: Profile[]
  invitations: Invitation[]
}) {
  const { businessId, color: primaryColor, userEmail: currentUserEmail } = useVertical()
  const supabase = createClient()
  const [profiles, setProfiles]           = useState<Profile[]>(initialProfiles)
  const [invites, setInvites]             = useState<Invitation[]>(initialInvites)
  const [inviteEmail, setInviteEmail]     = useState('')
  const [showInitPerms, setShowInitPerms] = useState(false)
  const [initPerms, setInitPerms]         = useState<Record<PermKey, boolean>>(DEFAULT_PERMS)
  const [sending, setSending]             = useState(false)
  const [newLink, setNewLink]             = useState<string | null>(null)
  const [copiedId, setCopiedId]           = useState<string | null>(null)
  const [error, setError]                 = useState<string | null>(null)
  const [removing, setRemoving]           = useState<string | null>(null)
  const [expandedId, setExpandedId]       = useState<string | null>(null)
  const [creatingPerms, setCreatingPerms] = useState<string | null>(null)
  const [resending, setResending]         = useState<string | null>(null)
  const [conflictInv, setConflictInv]     = useState<Invitation | null>(null)
  const [revoking, setRevoking]           = useState(false)

  async function refreshInvites() {
    const { data } = await supabase
      .from('invitations')
      .select('id,email,role,token,expires_at,accepted_at,revoked_at,resend_count,last_sent_at,created_at')
      .eq('business_id', businessId)
      .is('accepted_at', null)
      .is('revoked_at', null)
      .gt('expires_at', new Date().toISOString())
      .order('created_at', { ascending: false })
    setInvites((data ?? []) as Invitation[])
  }

  async function createInvite() {
    if (!inviteEmail.trim()) return
    const email = inviteEmail.trim().toLowerCase()
    setSending(true)
    setError(null)
    setNewLink(null)
    setConflictInv(null)

    const res = await fetch('/api/staff/invite', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, initial_permissions: initPerms }),
    })
    const data = await res.json()

    if (!res.ok) {
      if (data.error === 'conflict') {
        // Invitación activa existente — igual que antes, refrescar y mostrar
        await refreshInvites()
        setError('Ya existe una invitación activa para ese email. Revocala primero.')
      } else if (data.upgradePrompt) {
        setError(data.error)
      } else {
        setError(data.error ?? 'No se pudo crear la invitación. Intentá de nuevo.')
      }
    } else {
      setNewLink(`${location.origin}/invite/${data.token}`)
      setInviteEmail('')
      await refreshInvites()
    }
    setSending(false)
  }

  async function resolveConflict(action: 'copy' | 'revoke') {
    if (!conflictInv) return
    if (action === 'copy') {
      await navigator.clipboard.writeText(`${location.origin}/invite/${conflictInv.token}`)
      setCopiedId('conflict')
      setTimeout(() => setCopiedId(null), 2000)
      setConflictInv(null)
      return
    }
    // revoke existing then recreate
    setRevoking(true)
    await supabase.from('invitations')
      .update({ revoked_at: new Date().toISOString(), revoked_by: currentUserId })
      .eq('id', conflictInv.id)
    setConflictInv(null)
    setRevoking(false)
    await createInvite()
  }

  async function copyLink(token: string, id: string) {
    await navigator.clipboard.writeText(`${location.origin}/invite/${token}`)
    setCopiedId(id)
    setTimeout(() => setCopiedId(null), 2000)
  }

  async function resendInvite(inv: Invitation) {
    setResending(inv.id)
    const now = new Date().toISOString()
    await supabase.from('invitations')
      .update({ resend_count: inv.resend_count + 1, last_sent_at: now })
      .eq('id', inv.id)
    setInvites(prev => prev.map(i =>
      i.id === inv.id ? { ...i, resend_count: i.resend_count + 1, last_sent_at: now } : i
    ))
    setResending(null)
  }

  async function revokeInvite(id: string) {
    setInvites(prev => prev.filter(i => i.id !== id))
    await supabase.from('invitations')
      .update({ revoked_at: new Date().toISOString(), revoked_by: currentUserId })
      .eq('id', id)
  }

  async function removeMember(profileId: string) {
    setRemoving(profileId)
    setProfiles(prev => prev.filter(p => p.id !== profileId))
    await supabase.from('profiles').delete().eq('id', profileId)
    setRemoving(null)
  }

  async function createDefaultPerms(profileId: string) {
    setCreatingPerms(profileId)
    const { data } = await supabase.from('staff_permissions')
      .insert({ profile_id: profileId, business_id: businessId, ...DEFAULT_PERMS })
      .select()
      .single()
    if (data) {
      setProfiles(prev => prev.map(p =>
        p.id === profileId ? { ...p, permissions: data as StaffPermission } : p
      ))
    }
    setCreatingPerms(null)
  }

  const activeMembers = profiles.filter(p => p.role !== 'superadmin')

  return (
    <div className="space-y-6">

      {/* ── Miembros activos ─────────────────────────────────── */}
      <section className="bg-white rounded-2xl border border-gray-100 p-6">
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-4">
          Miembros · {activeMembers.length}
        </h2>

        <ul className="divide-y divide-gray-50">
          {activeMembers.map(p => {
            const displayEmail = p.email
              ?? (p.user_id === currentUserId ? currentUserEmail : `usuario-${p.user_id.slice(0, 6)}`)
            const conf       = ROLE_CONF[p.role as keyof typeof ROLE_CONF] ?? ROLE_CONF.staff
            const isMe       = p.user_id === currentUserId
            const isOwner    = p.role === 'owner'
            const isStaff    = p.role === 'staff'
            const isExpanded = expandedId === p.id

            return (
              <li key={p.id} className="py-3 first:pt-0 last:pb-0">
                <div className="flex items-center gap-3">
                  {/* Avatar */}
                  <div
                    className="h-9 w-9 rounded-xl flex items-center justify-center text-white
                               text-xs font-bold shrink-0"
                    style={{ background: primaryColor }}
                  >
                    {initial(p.display_name ?? displayEmail)}
                  </div>

                  {/* Name / email */}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">
                      {p.display_name ?? displayEmail}
                      {isMe && <span className="ml-1.5 text-xs text-gray-400">(vos)</span>}
                    </p>
                    {p.display_name && (
                      <p className="text-xs text-gray-400 truncate">{displayEmail}</p>
                    )}
                  </div>

                  {/* Role badge */}
                  <span
                    className="flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[10px] font-semibold shrink-0"
                    style={{ background: conf.bg, color: conf.text }}
                  >
                    {conf.icon} {conf.label}
                  </span>

                  {/* Expand permissions */}
                  {isStaff && (
                    <button
                      onClick={() => setExpandedId(isExpanded ? null : p.id)}
                      title="Permisos"
                      className="flex h-8 w-8 items-center justify-center rounded-xl border border-gray-100
                                 text-gray-400 hover:text-gray-700 hover:border-gray-200 transition-all"
                    >
                      {isExpanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                    </button>
                  )}

                  {/* Remove */}
                  {!isMe && !isOwner && (
                    <button
                      onClick={() => removeMember(p.id)}
                      disabled={removing === p.id}
                      title="Eliminar miembro"
                      className="flex h-8 w-8 items-center justify-center rounded-xl border border-gray-100
                                 text-red-300 hover:text-red-500 hover:border-red-100 transition-all
                                 disabled:opacity-40"
                    >
                      <Trash2 size={13} />
                    </button>
                  )}
                </div>

                {/* ── Permissions panel ── */}
                {isStaff && isExpanded && (
                  p.permissions
                    ? <PermGrid
                        profileId={p.id}
                        businessId={businessId}
                        permissions={{
                          can_view_orders:      p.permissions.can_view_orders,
                          can_manage_orders:    p.permissions.can_manage_orders,
                          can_view_products:    p.permissions.can_view_products,
                          can_manage_products:  p.permissions.can_manage_products,
                          can_view_customers:   p.permissions.can_view_customers,
                          can_view_analytics:   p.permissions.can_view_analytics,
                          can_view_inventory:   p.permissions.can_view_inventory,
                          can_manage_inventory: p.permissions.can_manage_inventory,
                          can_use_pos:          p.permissions.can_use_pos,
                          can_manage_tables:    p.permissions.can_manage_tables,
                        }}
                        primaryColor={primaryColor}
                      />
                    : <div className="mt-3 rounded-xl border border-dashed border-gray-200 p-4
                                      flex items-center justify-between gap-3">
                        <p className="text-xs text-gray-400">Sin permisos configurados aún</p>
                        <button
                          onClick={() => createDefaultPerms(p.id)}
                          disabled={creatingPerms === p.id}
                          className="text-xs font-semibold rounded-lg px-3 py-1.5 text-white
                                     transition-all hover:opacity-90 disabled:opacity-40 shrink-0"
                          style={{ background: primaryColor }}
                        >
                          {creatingPerms === p.id ? 'Creando…' : 'Aplicar defaults'}
                        </button>
                      </div>
                )}
              </li>
            )
          })}
        </ul>
      </section>

      {/* ── Invitar ───────────────────────────────────────────── */}
      <section className="bg-white rounded-2xl border border-gray-100 p-6">
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-4">
          Invitar empleado
        </h2>

        <div className="flex gap-2">
          <input
            type="email"
            value={inviteEmail}
            onChange={e => setInviteEmail(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && createInvite()}
            placeholder="email@empleado.com"
            className="flex-1 rounded-xl border border-gray-200 px-3 py-2.5 text-sm
                       focus:outline-none focus:border-gray-400 transition-colors"
          />
          <button
            onClick={createInvite}
            disabled={sending || !inviteEmail.trim()}
            className="flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold
                       text-white transition-all hover:opacity-90 disabled:opacity-40 shrink-0"
            style={{ background: primaryColor }}
          >
            <UserPlus size={14} />
            {sending ? 'Generando…' : 'Invitar'}
          </button>
        </div>

        {/* Permisos iniciales (collapsible) */}
        <button
          type="button"
          onClick={() => setShowInitPerms(!showInitPerms)}
          className="mt-3 flex items-center gap-1.5 text-xs text-gray-400 hover:text-gray-600 transition-colors"
        >
          {showInitPerms ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
          Configurar permisos iniciales
        </button>

        {showInitPerms && (
          <InitPermGrid
            perms={initPerms}
            onChange={(key, v) => setInitPerms(p => ({ ...p, [key]: v }))}
          />
        )}

        {error && <p className="text-xs text-red-500 mt-2">{error}</p>}

        {conflictInv && (
          <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-4 space-y-3">
            <div className="flex items-start gap-2">
              <Clock size={14} className="text-amber-600 mt-0.5 shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-amber-800">Ya existe una invitación activa</p>
                <p className="text-xs text-amber-600 mt-0.5 font-mono truncate">
                  {conflictInv.email} · vence en {daysLeft(conflictInv.expires_at)}
                </p>
              </div>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => resolveConflict('copy')}
                className="flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-semibold
                           bg-white border border-amber-200 text-amber-700 hover:bg-amber-100
                           transition-all shrink-0"
              >
                {copiedId === 'conflict' ? <Check size={11} /> : <Copy size={11} />}
                {copiedId === 'conflict' ? 'Copiado' : 'Copiar link existente'}
              </button>
              <button
                onClick={() => resolveConflict('revoke')}
                disabled={revoking}
                className="flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-semibold
                           bg-red-500 text-white hover:bg-red-600 transition-all
                           disabled:opacity-40 shrink-0"
              >
                <RotateCcw size={11} />
                {revoking ? 'Revocando…' : 'Revocar y reinvitar'}
              </button>
              <button
                onClick={() => setConflictInv(null)}
                className="ml-auto text-xs text-amber-600 hover:text-amber-800 transition-colors"
              >
                Cancelar
              </button>
            </div>
          </div>
        )}

        {newLink && (
          <div className="mt-4 flex items-center gap-2 rounded-xl bg-green-50 border border-green-200 p-3">
            <Link2 size={14} className="text-green-600 shrink-0" />
            <p className="flex-1 text-xs text-green-700 font-mono truncate">{newLink}</p>
            <button
              onClick={() => { navigator.clipboard.writeText(newLink); setCopiedId('new') }}
              className="shrink-0 text-green-600 hover:text-green-800 transition-colors"
            >
              {copiedId === 'new' ? <Check size={14} /> : <Copy size={14} />}
            </button>
          </div>
        )}

        <p className="text-xs text-gray-400 mt-3">
          El link es válido por 7 días. El empleado debe usar ese email al crear la cuenta.
        </p>
      </section>

      {/* ── Invitaciones pendientes ───────────────────────────── */}
      {invites.length > 0 && (
        <section className="bg-white rounded-2xl border border-gray-100 p-6">
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-4">
            Pendientes · {invites.length}
          </h2>
          <ul className="divide-y divide-gray-50">
            {invites.map(inv => (
              <li key={inv.id} className="flex items-center gap-3 py-3 first:pt-0 last:pb-0">
                <div className="h-9 w-9 rounded-xl bg-gray-100 flex items-center justify-center shrink-0">
                  <Clock size={14} className="text-gray-400" />
                </div>

                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">{inv.email}</p>
                  <p className="text-xs text-gray-400">
                    Vence en {daysLeft(inv.expires_at)}
                    {inv.resend_count > 0 && ` · Reenviada ${inv.resend_count}×`}
                  </p>
                </div>

                {/* Copy link */}
                <button
                  onClick={() => copyLink(inv.token, inv.id)}
                  className={cn(
                    'flex items-center gap-1.5 rounded-xl px-2.5 py-1.5 text-xs font-medium transition-all border',
                    copiedId === inv.id
                      ? 'bg-green-50 border-green-200 text-green-700'
                      : 'bg-gray-50 border-gray-200 text-gray-600 hover:border-gray-300'
                  )}
                >
                  {copiedId === inv.id ? <Check size={11} /> : <Copy size={11} />}
                  {copiedId === inv.id ? 'Copiado' : 'Copiar'}
                </button>

                {/* Resend */}
                <button
                  onClick={() => resendInvite(inv)}
                  disabled={resending === inv.id}
                  title="Reenviar (marcar como reenviada)"
                  className="flex h-8 w-8 items-center justify-center rounded-xl border border-gray-100
                             text-blue-400 hover:text-blue-600 hover:border-blue-100 transition-all
                             disabled:opacity-40"
                >
                  <Send size={13} />
                </button>

                {/* Revoke */}
                <button
                  onClick={() => revokeInvite(inv.id)}
                  title="Revocar invitación"
                  className="flex h-8 w-8 items-center justify-center rounded-xl border border-gray-100
                             text-red-300 hover:text-red-500 hover:border-red-100 transition-all"
                >
                  <RotateCcw size={13} />
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  )
}
