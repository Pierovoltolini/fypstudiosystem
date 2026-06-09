// app/admin/visits/VisitsClient.tsx
'use client'
import { useState, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import {
  CalendarCheck, Plus, Phone, Home, Clock,
  CheckCircle2, XCircle, AlertCircle, Check, Loader2, X,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import type { Booking, Product } from '@/types'
import SectionTour from '@/components/admin/SectionTour'

type BookingStatus = 'pending' | 'confirmed' | 'done' | 'cancelled' | 'noshow'

const STATUS: Record<BookingStatus, { label: string; color: string; bg: string; icon: React.ElementType }> = {
  pending:   { label: 'Pendiente',    color: '#F59E0B', bg: '#FEF3C7', icon: AlertCircle  },
  confirmed: { label: 'Confirmada',   color: '#3B82F6', bg: '#EFF6FF', icon: CheckCircle2 },
  done:      { label: 'Realizada',    color: '#10B981', bg: '#ECFDF5', icon: CheckCircle2 },
  cancelled: { label: 'Cancelada',    color: '#EF4444', bg: '#FEF2F2', icon: XCircle      },
  noshow:    { label: 'No se presentó', color: '#6B7280', bg: '#F9FAFB', icon: XCircle   },
}

interface Props {
  businessId: string
  whatsapp: string
  visits: Booking[]
  properties: Pick<Product, 'id' | 'name' | 'price'>[]
}

// ── Formulario nueva visita ────────────────────────────────────
function NewVisitForm({
  businessId,
  properties,
  onCreated,
  onClose,
}: {
  businessId: string
  properties: Pick<Product, 'id' | 'name' | 'price'>[]
  onCreated: (v: Booking) => void
  onClose: () => void
}) {
  const supabase = createClient()
  const [saving,      setSaving]      = useState(false)
  const [error,       setError]       = useState<string | null>(null)
  const [clientName,  setClientName]  = useState('')
  const [clientPhone, setClientPhone] = useState('')
  const [propertyId,  setPropertyId]  = useState(properties[0]?.id ?? '')
  const [date,        setDate]        = useState(() => new Date().toISOString().split('T')[0])
  const [startTime,   setStartTime]   = useState('10:00')
  const [notes,       setNotes]       = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!clientName.trim() || !date || !startTime) return
    setSaving(true)
    setError(null)

    // end_time = start_time + 1 hora
    const [h, m] = startTime.split(':').map(Number)
    const endH   = String((h + 1) % 24).padStart(2, '0')
    const endTime = `${endH}:${String(m).padStart(2, '0')}`

    const { data, error: err } = await supabase
      .from('bookings')
      .insert({
        business_id:    businessId,
        product_id:     propertyId || null,
        customer_name:  clientName.trim(),
        customer_phone: clientPhone.trim() || null,
        date,
        start_time:     startTime,
        end_time:       endTime,
        duration_min:   60,
        status:         'pending',
        source:         'admin',
        notes:          notes.trim() || null,
      })
      .select('*, product:products(id, name, price)')
      .single()

    if (err) {
      setError(err.message)
    } else if (data) {
      onCreated(data as Booking)
    }
    setSaving(false)
  }

  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-5 space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold text-gray-900">Nueva visita</p>
        <button onClick={onClose}
          className="h-7 w-7 flex items-center justify-center rounded-lg text-gray-400 hover:bg-gray-100">
          <X size={15} />
        </button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-3">
        {/* Propiedad */}
        {properties.length > 0 && (
          <div>
            <label className="field-label">Propiedad</label>
            <select value={propertyId} onChange={e => setPropertyId(e.target.value)}
              className="input-base">
              <option value="">Sin propiedad específica</option>
              {properties.map(p => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>
        )}

        {/* Cliente */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="field-label">Nombre del cliente <span className="text-red-400">*</span></label>
            <input
              type="text" required value={clientName} onChange={e => setClientName(e.target.value)}
              placeholder="Nombre completo" className="input-base" />
          </div>
          <div>
            <label className="field-label">WhatsApp / Teléfono</label>
            <input
              type="text" value={clientPhone} onChange={e => setClientPhone(e.target.value)}
              placeholder="59899..." className="input-base" inputMode="numeric" />
          </div>
        </div>

        {/* Fecha y hora */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="field-label">Fecha <span className="text-red-400">*</span></label>
            <input type="date" required value={date} onChange={e => setDate(e.target.value)}
              className="input-base" />
          </div>
          <div>
            <label className="field-label">Hora de inicio <span className="text-red-400">*</span></label>
            <input type="time" required value={startTime} onChange={e => setStartTime(e.target.value)}
              className="input-base" />
          </div>
        </div>

        {/* Notas */}
        <div>
          <label className="field-label">Notas (opcional)</label>
          <textarea
            value={notes} onChange={e => setNotes(e.target.value)}
            placeholder="Intereses, preferencias, observaciones..."
            className="input-base resize-none" rows={2} />
        </div>

        {error && <p className="text-xs text-red-600">{error}</p>}

        <button type="submit" disabled={saving || !clientName.trim()}
          className="flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-semibold
                     text-white disabled:opacity-40 active:scale-[0.97]"
          style={{ background: '#1565FF' }}>
          {saving ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
          {saving ? 'Guardando...' : 'Agendar visita'}
        </button>
      </form>
    </div>
  )
}

// ── Card de visita ─────────────────────────────────────────────
function VisitCard({
  visit,
  whatsapp,
  onStatusChange,
}: {
  visit: Booking
  whatsapp: string
  onStatusChange: (id: string, status: BookingStatus) => void
}) {
  const supabase = createClient()
  const [changing, setChanging] = useState(false)
  const statusCfg = STATUS[visit.status as BookingStatus] ?? STATUS.pending
  const Icon = statusCfg.icon
  const property = visit.product as { name: string } | null

  // WhatsApp del cliente
  const clientWa = visit.customer_phone
    ? `https://wa.me/${visit.customer_phone.replace(/\D/g,'')}?text=${encodeURIComponent(
        `Hola ${visit.customer_name}! Te confirmamos tu visita para el ${visit.date} a las ${visit.start_time.slice(0,5)}.`
      )}`
    : null

  async function changeStatus(newStatus: BookingStatus) {
    setChanging(true)
    const { data } = await supabase
      .from('bookings')
      .update({ status: newStatus })
      .eq('id', visit.id)
      .select('status')
      .single()
    if (data) onStatusChange(visit.id, newStatus)
    setChanging(false)
  }

  // Próximas acciones según status actual
  const nextActions: { label: string; status: BookingStatus }[] =
    visit.status === 'pending'   ? [{ label: 'Confirmar', status: 'confirmed' }, { label: 'Cancelar', status: 'cancelled' }] :
    visit.status === 'confirmed' ? [{ label: 'Realizada', status: 'done' },     { label: 'Cancelar', status: 'cancelled' }] :
    []

  return (
    <div className="bg-white rounded-2xl border border-gray-100 px-4 py-4 hover:border-gray-200 transition-all">
      <div className="flex items-start gap-3">

        {/* Avatar */}
        <div className="h-10 w-10 rounded-xl flex items-center justify-center shrink-0 text-white text-sm font-bold"
          style={{ background: '#1565FF' }}>
          {visit.customer_name.slice(0,1).toUpperCase()}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-sm font-semibold text-gray-900">{visit.customer_name}</p>
            <span className="text-[10px] font-semibold rounded-full px-2 py-0.5 flex items-center gap-1"
              style={{ background: statusCfg.bg, color: statusCfg.color }}>
              <Icon size={10} />{statusCfg.label}
            </span>
          </div>

          {/* Propiedad */}
          {property && (
            <div className="flex items-center gap-1 mt-1 text-xs text-gray-500">
              <Home size={11} className="shrink-0" />
              <span className="truncate">{property.name}</span>
            </div>
          )}

          {/* Fecha y hora */}
          <div className="flex items-center gap-1 mt-0.5 text-xs text-gray-400">
            <Clock size={11} />
            {visit.date} · {visit.start_time.slice(0,5)} – {visit.end_time.slice(0,5)}
          </div>

          {/* Notas */}
          {visit.notes && (
            <p className="text-xs text-gray-400 mt-1 italic">{visit.notes}</p>
          )}

          {/* Acciones */}
          {nextActions.length > 0 && (
            <div className="flex gap-2 mt-3 flex-wrap">
              {nextActions.map(a => (
                <button key={a.status} onClick={() => changeStatus(a.status)}
                  disabled={changing}
                  className={cn(
                    'rounded-xl px-3 py-1.5 text-xs font-semibold disabled:opacity-40 transition-all',
                    a.status === 'cancelled'
                      ? 'bg-red-50 text-red-600 hover:bg-red-100'
                      : 'text-white'
                  )}
                  style={a.status !== 'cancelled' ? { background: '#1565FF' } : {}}>
                  {changing ? <Loader2 size={11} className="animate-spin inline" /> : a.label}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Contacto cliente */}
        {clientWa && (
          <a href={clientWa} target="_blank" rel="noopener noreferrer"
            className="flex h-9 w-9 items-center justify-center rounded-xl shrink-0
                       text-white transition-all hover:opacity-90"
            style={{ background: '#25D366' }}>
            <Phone size={15} />
          </a>
        )}
      </div>
    </div>
  )
}

// ── Shell principal ────────────────────────────────────────────
export default function VisitsClient({ businessId, whatsapp, visits: initial, properties }: Props) {
  const [visits,    setVisits]    = useState<Booking[]>(initial)
  const [showForm,  setShowForm]  = useState(false)
  const [filter,    setFilter]    = useState<BookingStatus | 'all'>('all')

  function handleCreated(v: Booking) {
    setVisits(prev => [v, ...prev])
    setShowForm(false)
  }

  function handleStatusChange(id: string, status: BookingStatus) {
    setVisits(prev => prev.map(v => v.id === id ? { ...v, status } : v))
  }

  const filtered = useMemo(() =>
    filter === 'all' ? visits : visits.filter(v => v.status === filter),
  [visits, filter])

  // Visitas de hoy y futuras
  const today  = new Date().toISOString().split('T')[0]
  const upcoming = useMemo(() =>
    filtered.filter(v => v.date >= today && v.status !== 'cancelled' && v.status !== 'noshow'),
  [filtered, today])
  const past = useMemo(() =>
    filtered.filter(v => v.date < today || v.status === 'done'),
  [filtered, today])

  return (
    <div className="space-y-5 animate-fade-in">
      <SectionTour section="visits" />

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl lg:text-2xl font-bold text-gray-900 tracking-tight">Visitas</h1>
          <p className="text-sm text-gray-400 mt-0.5">
            {upcoming.length} próximas · {past.length} anteriores
          </p>
        </div>
        <button
          onClick={() => setShowForm(f => !f)}
          className="flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold
                     text-white active:scale-[0.97] transition-all"
          style={{ background: '#1565FF' }}>
          <Plus size={15} />
          <span className="hidden sm:inline">Agendar visita</span>
          <span className="sm:hidden">Nueva</span>
        </button>
      </div>

      {/* Formulario */}
      {showForm && (
        <NewVisitForm
          businessId={businessId}
          properties={properties}
          onCreated={handleCreated}
          onClose={() => setShowForm(false)}
        />
      )}

      {/* Filtros */}
      <div className="flex gap-2 flex-wrap">
        {(['all', 'pending', 'confirmed', 'done', 'cancelled'] as const).map(s => (
          <button key={s}
            onClick={() => setFilter(s)}
            className={cn(
              'rounded-xl px-3 py-1.5 text-xs font-semibold transition-all',
              filter === s
                ? 'bg-gray-900 text-white'
                : 'bg-white border border-gray-200 text-gray-600 hover:border-gray-300'
            )}>
            {s === 'all' ? `Todas (${visits.length})` : `${STATUS[s].label} (${visits.filter(v=>v.status===s).length})`}
          </button>
        ))}
      </div>

      {/* Próximas */}
      {upcoming.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-bold text-gray-500 uppercase tracking-widest px-1">Próximas</p>
          {upcoming.map(v => (
            <VisitCard key={v.id} visit={v} whatsapp={whatsapp}
              onStatusChange={handleStatusChange} />
          ))}
        </div>
      )}

      {/* Anteriores */}
      {past.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-bold text-gray-500 uppercase tracking-widest px-1">Anteriores</p>
          {past.map(v => (
            <VisitCard key={v.id} visit={v} whatsapp={whatsapp}
              onStatusChange={handleStatusChange} />
          ))}
        </div>
      )}

      {/* Empty */}
      {filtered.length === 0 && (
        <div className="rounded-2xl border-2 border-dashed border-gray-200 py-16 text-center">
          <CalendarCheck size={32} className="mx-auto text-gray-200 mb-3" />
          <p className="text-sm font-medium text-gray-400">Sin visitas agendadas</p>
          <p className="text-xs text-gray-300 mt-1 mb-5">
            Agendá la primera visita con el botón de arriba
          </p>
        </div>
      )}
    </div>
  )
}
