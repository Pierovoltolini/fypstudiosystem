// app/admin/tables/ReservationsTab.tsx
'use client'
import { useState, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import {
  Plus, X, Loader2, Check, Phone, Users, Clock,
  ChevronLeft, ChevronRight, StickyNote, Utensils,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import type { RestaurantTable, TableReservation } from '@/types'

type ResStatus = TableReservation['status']

const STATUS_CFG: Record<ResStatus, { label: string; bg: string; text: string }> = {
  pending:   { label: 'Pendiente',  bg: 'bg-amber-50',  text: 'text-amber-700'  },
  confirmed: { label: 'Confirmada', bg: 'bg-blue-50',   text: 'text-blue-700'   },
  seated:    { label: 'Sentada',    bg: 'bg-green-50',  text: 'text-green-700'  },
  cancelled: { label: 'Cancelada',  bg: 'bg-red-50',    text: 'text-red-500'    },
  noshow:    { label: 'No asistió', bg: 'bg-gray-100',  text: 'text-gray-500'   },
}

const NEXT_STATUS: Partial<Record<ResStatus, ResStatus>> = {
  pending:   'confirmed',
  confirmed: 'seated',
  seated:    'cancelled',
}
const NEXT_LABEL: Partial<Record<ResStatus, string>> = {
  pending:   'Confirmar',
  confirmed: 'Sentar',
  seated:    'Cancelar',
}

function toDateStr(d: Date) {
  return d.toISOString().split('T')[0]
}

const EMPTY = {
  customer_name: '', customer_phone: '', party_size: 2,
  date: toDateStr(new Date()), time: '20:00',
  table_id: '' as string, notes: '',
}

interface Props {
  businessId: string
  tables:     RestaurantTable[]
  color:      string
  initialReservations: TableReservation[]
}

export default function ReservationsTab({ businessId, tables, color, initialReservations }: Props) {
  const supabase = createClient()
  const [reservations, setReservations] = useState<TableReservation[]>(initialReservations)
  const [showForm,  setShowForm]  = useState(false)
  const [form,      setForm]      = useState({ ...EMPTY })
  const [saving,    setSaving]    = useState(false)
  const [updating,  setUpdating]  = useState<string | null>(null)
  const [error,     setError]     = useState<string | null>(null)
  const [viewDate,  setViewDate]  = useState(toDateStr(new Date()))

  function setF<K extends keyof typeof EMPTY>(k: K, v: (typeof EMPTY)[K]) {
    setForm(prev => ({ ...prev, [k]: v })); setError(null)
  }

  const dayReservations = useMemo(() =>
    reservations
      .filter(r => r.date === viewDate && r.status !== 'cancelled')
      .sort((a, b) => a.time.localeCompare(b.time)),
    [reservations, viewDate]
  )

  function prevDay() {
    const d = new Date(viewDate + 'T12:00:00')
    d.setDate(d.getDate() - 1)
    setViewDate(toDateStr(d))
  }
  function nextDay() {
    const d = new Date(viewDate + 'T12:00:00')
    d.setDate(d.getDate() + 1)
    setViewDate(toDateStr(d))
  }
  function goToday() { setViewDate(toDateStr(new Date())) }

  async function save() {
    if (!form.customer_name.trim()) { setError('Nombre requerido'); return }
    setSaving(true); setError(null)
    const table = tables.find(t => t.id === form.table_id) ?? null
    const { data, error: err } = await supabase
      .from('table_reservations')
      .insert({
        business_id:    businessId,
        table_id:       form.table_id || null,
        customer_name:  form.customer_name.trim(),
        customer_phone: form.customer_phone.trim() || null,
        party_size:     form.party_size,
        date:           form.date,
        time:           form.time,
        notes:          form.notes.trim() || null,
        status:         'pending',
      })
      .select('*')
      .single()
    if (err) { setError(err.message); setSaving(false); return }
    setReservations(prev => [...prev, { ...data, table } as TableReservation])
    setForm({ ...EMPTY, date: form.date })
    setViewDate(form.date)
    setShowForm(false)
    setSaving(false)
  }

  async function advance(r: TableReservation) {
    const next = NEXT_STATUS[r.status]
    if (!next) return
    setUpdating(r.id)
    await supabase.from('table_reservations').update({ status: next }).eq('id', r.id)
    setReservations(prev => prev.map(x => x.id === r.id ? { ...x, status: next } : x))
    setUpdating(null)
  }

  async function markNoshow(r: TableReservation) {
    setUpdating(r.id)
    await supabase.from('table_reservations').update({ status: 'noshow' }).eq('id', r.id)
    setReservations(prev => prev.map(x => x.id === r.id ? { ...x, status: 'noshow' } : x))
    setUpdating(null)
  }

  async function cancel(r: TableReservation) {
    setUpdating(r.id)
    await supabase.from('table_reservations').update({ status: 'cancelled' }).eq('id', r.id)
    setReservations(prev => prev.map(x => x.id === r.id ? { ...x, status: 'cancelled' } : x))
    setUpdating(null)
  }

  const isToday = viewDate === toDateStr(new Date())
  const dateLabel = new Date(viewDate + 'T12:00:00').toLocaleDateString('es-UY', {
    weekday: 'long', day: 'numeric', month: 'long',
  })

  return (
    <div className="space-y-4">
      {/* Day navigator */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <button onClick={prevDay}
            className="flex h-8 w-8 items-center justify-center rounded-xl border border-gray-200
                       text-gray-500 hover:bg-gray-50 transition-colors">
            <ChevronLeft size={15} />
          </button>
          <div className="text-center min-w-[160px]">
            <p className="text-sm font-semibold text-gray-900 capitalize">{dateLabel}</p>
            {!isToday && (
              <button onClick={goToday} className="text-[11px] font-medium"
                style={{ color }}>Volver a hoy</button>
            )}
          </div>
          <button onClick={nextDay}
            className="flex h-8 w-8 items-center justify-center rounded-xl border border-gray-200
                       text-gray-500 hover:bg-gray-50 transition-colors">
            <ChevronRight size={15} />
          </button>
        </div>

        <button onClick={() => { setShowForm(v => !v); setF('date', viewDate) }}
          className="flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold
                     text-white transition-all hover:opacity-90 shrink-0"
          style={{ background: color }}>
          <Plus size={14} /> Nueva reserva
        </button>
      </div>

      {/* Form */}
      {showForm && (
        <div className="bg-white rounded-2xl border border-gray-100 p-5 space-y-4 shadow-sm">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold text-gray-700">Nueva reserva</p>
            <button onClick={() => setShowForm(false)}
              className="text-gray-400 hover:text-gray-600 transition-colors">
              <X size={16} />
            </button>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <label className="text-xs text-gray-500 mb-1 block">Nombre del cliente *</label>
              <input value={form.customer_name}
                onChange={e => setF('customer_name', e.target.value)}
                placeholder="Juan García"
                className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm outline-none
                           focus:ring-2 focus:border-transparent"
                style={{ '--tw-ring-color': color } as React.CSSProperties}
              />
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 flex items-center gap-1"><Phone size={10} /> Teléfono</label>
              <input value={form.customer_phone}
                onChange={e => setF('customer_phone', e.target.value)}
                placeholder="099 123 456"
                className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm outline-none
                           focus:ring-2 focus:border-transparent"
                style={{ '--tw-ring-color': color } as React.CSSProperties}
              />
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 flex items-center gap-1"><Users size={10} /> Personas</label>
              <input type="number" min="1" value={form.party_size}
                onChange={e => setF('party_size', parseInt(e.target.value) || 1)}
                className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm outline-none
                           focus:ring-2 focus:border-transparent"
                style={{ '--tw-ring-color': color } as React.CSSProperties}
              />
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 flex items-center gap-1"><Clock size={10} /> Fecha</label>
              <input type="date" value={form.date}
                onChange={e => setF('date', e.target.value)}
                className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm outline-none
                           focus:ring-2 focus:border-transparent"
                style={{ '--tw-ring-color': color } as React.CSSProperties}
              />
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 flex items-center gap-1"><Clock size={10} /> Hora</label>
              <input type="time" value={form.time}
                onChange={e => setF('time', e.target.value)}
                className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm outline-none
                           focus:ring-2 focus:border-transparent"
                style={{ '--tw-ring-color': color } as React.CSSProperties}
              />
            </div>
            <div className="col-span-2">
              <label className="text-xs text-gray-500 mb-1 flex items-center gap-1"><Utensils size={10} /> Mesa (opcional)</label>
              <select value={form.table_id}
                onChange={e => setF('table_id', e.target.value)}
                className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm outline-none
                           focus:ring-2 focus:border-transparent bg-white"
                style={{ '--tw-ring-color': color } as React.CSSProperties}
              >
                <option value="">Sin asignar</option>
                {tables.filter(t => t.active).map(t => (
                  <option key={t.id} value={t.id}>{t.name} ({t.capacity} pers.)</option>
                ))}
              </select>
            </div>
            <div className="col-span-2">
              <label className="text-xs text-gray-500 mb-1 flex items-center gap-1"><StickyNote size={10} /> Notas</label>
              <input value={form.notes}
                onChange={e => setF('notes', e.target.value)}
                placeholder="Cumpleaños, alérgenos, silla de bebé…"
                className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm outline-none
                           focus:ring-2 focus:border-transparent"
                style={{ '--tw-ring-color': color } as React.CSSProperties}
              />
            </div>
          </div>

          {error && <p className="text-xs text-red-500">{error}</p>}

          <button onClick={save} disabled={saving}
            className="w-full flex items-center justify-center gap-2 rounded-xl py-3 text-sm font-bold
                       text-white disabled:opacity-60 transition-all"
            style={{ background: color }}>
            {saving ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
            Guardar reserva
          </button>
        </div>
      )}

      {/* List */}
      {dayReservations.length === 0 ? (
        <div className="rounded-2xl border-2 border-dashed border-gray-200 py-16 text-center">
          <p className="text-2xl mb-2">📅</p>
          <p className="text-sm text-gray-400">Sin reservas para este día</p>
        </div>
      ) : (
        <div className="space-y-3">
          {dayReservations.map(r => {
            const cfg  = STATUS_CFG[r.status]
            const next = NEXT_STATUS[r.status]
            const nlbl = NEXT_LABEL[r.status]
            const table = tables.find(t => t.id === r.table_id)
            return (
              <div key={r.id}
                className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-bold text-gray-900">{r.customer_name}</p>
                      <span className={cn('text-[10px] font-bold px-2 py-0.5 rounded-full', cfg.bg, cfg.text)}>
                        {cfg.label}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 mt-1 flex-wrap">
                      <span className="text-xs text-gray-500 flex items-center gap-1">
                        <Clock size={11} /> {r.time.slice(0,5)}
                      </span>
                      <span className="text-xs text-gray-500 flex items-center gap-1">
                        <Users size={11} /> {r.party_size} pers.
                      </span>
                      {table && (
                        <span className="text-xs text-gray-500 flex items-center gap-1">
                          <Utensils size={11} /> {table.name}
                        </span>
                      )}
                      {r.customer_phone && (
                        <span className="text-xs text-gray-400 flex items-center gap-1">
                          <Phone size={10} /> {r.customer_phone}
                        </span>
                      )}
                    </div>
                    {r.notes && (
                      <p className="mt-1.5 text-xs text-amber-700 bg-amber-50 rounded-lg px-2.5 py-1.5">
                        📝 {r.notes}
                      </p>
                    )}
                  </div>
                </div>

                {/* Actions */}
                {!['seated','cancelled','noshow'].includes(r.status) && (
                  <div className="flex items-center gap-2 flex-wrap">
                    {next && nlbl && (
                      <button onClick={() => advance(r)} disabled={updating === r.id}
                        className="flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-bold
                                   text-white transition-all active:scale-[0.97] disabled:opacity-50"
                        style={{ background: color }}>
                        {updating === r.id ? <Loader2 size={11} className="animate-spin" /> : <Check size={11} />}
                        {nlbl}
                      </button>
                    )}
                    {r.status !== 'noshow' && (
                      <button onClick={() => markNoshow(r)} disabled={updating === r.id}
                        className="flex items-center gap-1 rounded-xl px-3 py-2 text-xs font-medium
                                   text-gray-500 bg-gray-100 hover:bg-gray-200 transition-colors">
                        No asistió
                      </button>
                    )}
                    <button onClick={() => cancel(r)} disabled={updating === r.id}
                      className="flex items-center gap-1 rounded-xl px-3 py-2 text-xs font-medium
                                 text-red-500 bg-red-50 hover:bg-red-100 transition-colors ml-auto">
                      <X size={11} /> Cancelar
                    </button>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
