// app/admin/leads/LeadsClient.tsx
'use client'
import { useState, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import {
  Target, Phone, Mail, MessageSquare, Calendar, Plus, X,
  Check, ChevronDown, StickyNote, Search,
} from 'lucide-react'
import { cn, formatDate } from '@/lib/utils'
import { useVertical } from '@/lib/vertical-context'
import SectionTour from '@/components/admin/SectionTour'

type LeadStatus = 'new' | 'contacted' | 'qualified' | 'closed' | 'lost'

const STATUS_MAP: Record<LeadStatus, { label: string; bg: string; text: string }> = {
  new:       { label: 'Nuevo',       bg: '#EFF6FF', text: '#1D4ED8' },
  contacted: { label: 'Contactado',  bg: '#FEF3C7', text: '#92400E' },
  qualified: { label: 'Calificado',  bg: '#ECFDF5', text: '#065F46' },
  closed:    { label: 'Cerrado',     bg: '#F0FDF4', text: '#166534' },
  lost:      { label: 'Perdido',     bg: '#FEF2F2', text: '#991B1B' },
}

const STATUSES = Object.keys(STATUS_MAP) as LeadStatus[]

const SOURCE_LABEL: Record<string, string> = {
  store:    'Tienda web',
  whatsapp: 'WhatsApp',
  form:     'Formulario',
  manual:   'Ingreso manual',
}

interface Lead {
  id: string; name: string; phone?: string | null; email?: string | null
  message?: string | null; source: string; status: LeadStatus; notes?: string | null
  created_at: string; product?: { name: string } | null
}

interface Props {
  leads: Lead[]
  isRealEstate: boolean
}

export default function LeadsClient({ leads: initialLeads, isRealEstate }: Props) {
  const { businessId, color: primaryColor } = useVertical()
  const supabase = createClient()

  const [leads,       setLeads]      = useState<Lead[]>(initialLeads)
  const [search,      setSearch]     = useState('')
  const [statusFilter, setStatusFilter] = useState<LeadStatus | 'all'>('all')
  const [showNewForm,  setShowNewForm]  = useState(false)

  const filtered = useMemo(() => {
    const q = search.toLowerCase()
    return leads.filter(l => {
      if (statusFilter !== 'all' && l.status !== statusFilter) return false
      if (q && !l.name.toLowerCase().includes(q) &&
               !(l.phone ?? '').includes(q) &&
               !(l.email ?? '').toLowerCase().includes(q)) return false
      return true
    })
  }, [leads, statusFilter, search])

  const counts = useMemo(() => {
    const c: Record<string, number> = { all: leads.length }
    STATUSES.forEach(s => { c[s] = leads.filter(l => l.status === s).length })
    return c
  }, [leads])

  async function updateStatus(id: string, status: LeadStatus) {
    await supabase.from('leads').update({ status }).eq('id', id)
    setLeads(prev => prev.map(l => l.id === id ? { ...l, status } : l))
  }

  async function updateNotes(id: string, notes: string) {
    await supabase.from('leads').update({ notes }).eq('id', id)
    setLeads(prev => prev.map(l => l.id === id ? { ...l, notes } : l))
  }

  function onLeadCreated(lead: Lead) {
    setLeads(prev => [lead, ...prev])
    setShowNewForm(false)
  }

  const title = isRealEstate ? 'Leads & Consultas' : 'Solicitudes'

  return (
    <div className="space-y-5 animate-fade-in">
      <SectionTour section="leads" />

      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-xl lg:text-2xl font-bold text-gray-900 tracking-tight">{title}</h1>
          <p className="text-sm text-gray-400 mt-0.5">{leads.length} total</p>
        </div>
        <button onClick={() => setShowNewForm(true)}
          className="flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold
                     text-white shrink-0 transition-all"
          style={{ background: primaryColor }}>
          <Plus size={14} /> Agregar
        </button>
      </div>

      {/* Search */}
      <div className="relative">
        <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
        <input value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Buscar por nombre, teléfono o email…"
          className="w-full rounded-2xl border border-gray-200 bg-white pl-10 pr-4 py-3
                     text-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:border-transparent"
          style={{ '--tw-ring-color': primaryColor } as React.CSSProperties}
        />
      </div>

      {/* Status filter pills */}
      <div className="flex gap-2 flex-wrap">
        {(['all', ...STATUSES] as const).map(s => {
          const cfg = s !== 'all' ? STATUS_MAP[s] : null
          const count = counts[s] ?? 0
          const active = statusFilter === s
          return (
            <button key={s} onClick={() => setStatusFilter(s)}
              className={cn(
                'rounded-xl px-3 py-1.5 text-xs font-semibold transition-all border',
                active ? 'text-white border-transparent' : 'bg-white border-gray-200 text-gray-600'
              )}
              style={active
                ? { background: cfg?.text ?? '#111827' }
                : {}}>
              {s === 'all' ? 'Todos' : cfg?.label} ({count})
            </button>
          )
        })}
      </div>

      {/* New lead form */}
      {showNewForm && (
        <NewLeadForm
          businessId={businessId}
          primaryColor={primaryColor}
          onCreated={onLeadCreated}
          onClose={() => setShowNewForm(false)}
        />
      )}

      {/* List */}
      {filtered.length === 0 ? (
        <div className="rounded-2xl border-2 border-dashed border-gray-200 py-16 text-center">
          <Target size={32} className="mx-auto text-gray-200 mb-3" />
          <p className="text-sm font-medium text-gray-400">
            {statusFilter !== 'all' ? 'Sin leads con este estado' : 'Sin leads todavía'}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map(lead => (
            <LeadCard
              key={lead.id}
              lead={lead}
              primaryColor={primaryColor}
              onStatusChange={updateStatus}
              onNotesChange={updateNotes}
            />
          ))}
        </div>
      )}
    </div>
  )
}

// ── Lead Card ────────────────────────────────────────────────
function LeadCard({ lead, primaryColor, onStatusChange, onNotesChange }: {
  lead: Lead; primaryColor: string
  onStatusChange: (id: string, s: LeadStatus) => void
  onNotesChange:  (id: string, n: string)     => void
}) {
  const [showNotes, setShowNotes] = useState(false)
  const [notes,     setNotes]     = useState(lead.notes ?? '')
  const [notesEdit, setNotesEdit] = useState(false)
  const [statusOpen, setStatusOpen] = useState(false)
  const cfg = STATUS_MAP[lead.status] ?? STATUS_MAP.new

  return (
    <div className="bg-white rounded-2xl border border-gray-100 px-4 py-4 transition-all hover:border-gray-200 shadow-sm">
      <div className="flex items-start gap-3">

        {/* Avatar */}
        <div className="h-10 w-10 rounded-xl flex items-center justify-center text-white text-sm font-bold shrink-0"
          style={{ background: primaryColor }}>
          {lead.name.slice(0, 1).toUpperCase()}
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-sm font-semibold text-gray-900">{lead.name}</p>
            {lead.product?.name && (
              <span className="text-[10px] text-gray-400 bg-gray-50 rounded-full px-2 py-0.5">
                {lead.product.name}
              </span>
            )}
          </div>

          <div className="flex flex-wrap gap-3 mt-1.5">
            {lead.phone && (
              <a href={`https://wa.me/${lead.phone.replace(/\D/g,'')}`} target="_blank"
                className="flex items-center gap-1 text-xs text-green-600 hover:underline">
                <Phone size={11} /> {lead.phone}
              </a>
            )}
            {lead.email && (
              <a href={`mailto:${lead.email}`}
                className="flex items-center gap-1 text-xs text-blue-600 hover:underline">
                <Mail size={11} /> {lead.email}
              </a>
            )}
          </div>

          {lead.message && (
            <div className="mt-1.5 flex items-start gap-1.5">
              <MessageSquare size={11} className="text-gray-300 mt-0.5 shrink-0" />
              <p className="text-xs text-gray-500 line-clamp-2">{lead.message}</p>
            </div>
          )}
        </div>

        {/* Right side */}
        <div className="shrink-0 flex flex-col items-end gap-2">
          {/* Status dropdown */}
          <div className="relative">
            <button onClick={() => setStatusOpen(o => !o)}
              className="flex items-center gap-1.5 rounded-xl px-2.5 py-1 text-[10px] font-bold transition-all"
              style={{ background: cfg.bg, color: cfg.text }}>
              {cfg.label}
              <ChevronDown size={9} className={statusOpen ? 'rotate-180 transition-transform' : 'transition-transform'} />
            </button>
            {statusOpen && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setStatusOpen(false)} />
                <div className="absolute right-0 top-8 z-20 w-40 rounded-2xl border border-gray-100
                                bg-white shadow-xl py-1.5 overflow-hidden">
                  {STATUSES.map(s => {
                    const c = STATUS_MAP[s]
                    return (
                      <button key={s}
                        onClick={() => { onStatusChange(lead.id, s); setStatusOpen(false) }}
                        className="w-full flex items-center justify-between px-3.5 py-2
                                   text-xs hover:bg-gray-50 transition-colors">
                        <span className="font-medium" style={{ color: c.text }}>{c.label}</span>
                        {lead.status === s && <Check size={11} style={{ color: c.text }} />}
                      </button>
                    )
                  })}
                </div>
              </>
            )}
          </div>

          <div className="flex items-center gap-1 text-[10px] text-gray-400">
            <Calendar size={10} /> {formatDate(lead.created_at)}
          </div>
          {lead.source && (
            <p className="text-[10px] text-gray-300">{SOURCE_LABEL[lead.source] ?? lead.source}</p>
          )}
        </div>
      </div>

      {/* Notes toggle */}
      <div className="mt-3 pt-2.5 border-t border-gray-50">
        {notesEdit ? (
          <div className="space-y-2">
            <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2}
              placeholder="Agregar nota…"
              className="w-full rounded-xl border border-gray-200 p-2.5 text-xs text-gray-700
                         placeholder-gray-400 resize-none outline-none focus:ring-2 focus:border-transparent"
              style={{ '--tw-ring-color': primaryColor } as React.CSSProperties}
            />
            <div className="flex gap-2">
              <button onClick={() => { onNotesChange(lead.id, notes); setNotesEdit(false) }}
                className="flex items-center gap-1 rounded-xl px-3 py-1.5 text-xs font-bold text-white"
                style={{ background: primaryColor }}>
                <Check size={10} /> Guardar
              </button>
              <button onClick={() => { setNotes(lead.notes ?? ''); setNotesEdit(false) }}
                className="rounded-xl px-3 py-1.5 text-xs font-semibold bg-gray-100 text-gray-500">
                Cancelar
              </button>
            </div>
          </div>
        ) : (
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-start gap-1.5 flex-1 min-w-0">
              <StickyNote size={11} className="text-gray-300 mt-0.5 shrink-0" />
              {notes ? (
                <p className="text-xs text-gray-500">{notes}</p>
              ) : (
                <p className="text-xs text-gray-300 italic">Sin notas</p>
              )}
            </div>
            <button onClick={() => setNotesEdit(true)}
              className="text-xs font-semibold shrink-0 transition-colors"
              style={{ color: primaryColor }}>
              {notes ? 'Editar' : 'Agregar nota'}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

// ── New Lead Form ─────────────────────────────────────────────
function NewLeadForm({ businessId, primaryColor, onCreated, onClose }: {
  businessId: string; primaryColor: string
  onCreated: (l: Lead) => void; onClose: () => void
}) {
  const supabase = createClient()
  const [saving, setSaving] = useState(false)
  const [name,    setName]    = useState('')
  const [phone,   setPhone]   = useState('')
  const [email,   setEmail]   = useState('')
  const [message, setMessage] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) return
    setSaving(true)
    const { data } = await supabase
      .from('leads')
      .insert({ business_id: businessId, name: name.trim(), phone: phone || null,
                email: email || null, message: message || null,
                status: 'new', source: 'manual' })
      .select('*, product:products(name)')
      .single()
    if (data) onCreated(data as Lead)
    setSaving(false)
  }

  const F = 'w-full rounded-xl border border-gray-200 px-3.5 py-2.5 text-sm outline-none focus:ring-2 focus:border-transparent'

  return (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-4 space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm font-bold text-gray-900">Nuevo lead</p>
        <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
          <X size={16} />
        </button>
      </div>
      <form onSubmit={handleSubmit} className="space-y-3">
        <input value={name} onChange={e => setName(e.target.value)} required
          placeholder="Nombre *" className={F}
          style={{ '--tw-ring-color': primaryColor } as React.CSSProperties} />
        <div className="grid grid-cols-2 gap-3">
          <input value={phone} onChange={e => setPhone(e.target.value)}
            placeholder="Teléfono" className={F}
            style={{ '--tw-ring-color': primaryColor } as React.CSSProperties} />
          <input value={email} onChange={e => setEmail(e.target.value)} type="email"
            placeholder="Email" className={F}
            style={{ '--tw-ring-color': primaryColor } as React.CSSProperties} />
        </div>
        <textarea value={message} onChange={e => setMessage(e.target.value)} rows={2}
          placeholder="Mensaje o consulta"
          className={cn(F, 'resize-none')}
          style={{ '--tw-ring-color': primaryColor } as React.CSSProperties} />
        <div className="flex gap-2">
          <button type="submit" disabled={saving || !name.trim()}
            className="flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-bold
                       text-white disabled:opacity-50 transition-all"
            style={{ background: primaryColor }}>
            {saving ? <div className="h-4 w-4 rounded-full border-2 border-white/30 animate-spin border-t-white" />
                    : <Check size={14} />}
            Guardar
          </button>
          <button type="button" onClick={onClose}
            className="rounded-xl px-4 py-2.5 text-sm font-semibold bg-gray-100 text-gray-600">
            Cancelar
          </button>
        </div>
      </form>
    </div>
  )
}
