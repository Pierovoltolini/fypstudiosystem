// app/admin/tables/TablesClient.tsx
'use client'
import { useState, useEffect, useRef, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Plus, Edit2, Trash2, Users, QrCode, Copy, Download, Check, X as XIcon, Clock, Utensils, Bell, Receipt, Sparkles, AlertTriangle, CalendarDays, LayoutGrid, Map } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { RestaurantTable, TableSession, TableStatus, TableShape, TableReservation } from '@/types'
import ReservationsTab from './ReservationsTab'
import { QRCodeSVG, QRCodeCanvas } from 'qrcode.react'
import { useVertical } from '@/lib/vertical-context'
import SectionTour from '@/components/admin/SectionTour'

const STATUS_CONF: Record<TableStatus, {
  label: string; bg: string; text: string; dot: string; btnLabel: string; pulse?: boolean
}> = {
  free:              { label: 'Libre',             bg: '#F0FDF4', text: '#166534', dot: '#22C55E', btnLabel: 'Abrir mesa' },
  occupied:          { label: 'Ocupada',           bg: '#FEF2F2', text: '#991B1B', dot: '#EF4444', btnLabel: 'Cerrar mesa' },
  reserved:          { label: 'Reservada',         bg: '#FFFBEB', text: '#92400E', dot: '#F59E0B', btnLabel: 'Liberar' },
  unavailable:       { label: 'No disponible',     bg: '#F3F4F6', text: '#6B7280', dot: '#9CA3AF', btnLabel: 'Habilitar' },
  waiting_attention: { label: 'Llamó al mozo',     bg: '#FFF7ED', text: '#C2410C', dot: '#F97316', btnLabel: 'Atender',  pulse: true },
  bill_requested:    { label: 'Pide la cuenta',    bg: '#EFF6FF', text: '#1D4ED8', dot: '#3B82F6', btnLabel: 'Cobrar',   pulse: true },
  needs_cleaning:    { label: 'Limpieza pendiente',bg: '#FAF5FF', text: '#6D28D9', dot: '#8B5CF6', btnLabel: 'Lista' },
}

const SHAPES: { value: TableShape; label: string }[] = [
  { value: 'square',    label: 'Cuadrada' },
  { value: 'round',     label: 'Redonda' },
  { value: 'rectangle', label: 'Rectangular' },
]

const PRESET_COLORS = ['#6366F1', '#EC4899', '#F59E0B', '#10B981', '#3B82F6', '#EF4444', '#8B5CF6', '#14B8A6']

interface FormData {
  name: string
  capacity: string
  sort_order: string
  section: string
  shape: TableShape
  color: string
  alert_after_minutes: string
}

interface SessionFormData {
  people_count: string
  waiter_name: string
  notes: string
}

function formatMinutes(minutes: number) {
  if (minutes < 60) return `${Math.round(minutes)}min`
  const h = Math.floor(minutes / 60)
  const m = Math.round(minutes % 60)
  return m > 0 ? `${h}h ${m}m` : `${h}h`
}

export default function TablesClient({
  initialTables,
  initialSessions,
  initialReservations = [],
}: {
  initialTables:        RestaurantTable[]
  initialSessions:      TableSession[]
  initialReservations?: TableReservation[]
}) {
  const { businessId, business, color: primaryColor } = useVertical()
  const businessSlug = business.slug
  const supabase     = createClient()
  const [tables, setTables]               = useState<RestaurantTable[]>(initialTables)
  const [sessions, setSessions]           = useState<TableSession[]>(initialSessions)
  const [modal, setModal]                 = useState<{ mode: 'add' | 'edit'; table?: RestaurantTable } | null>(null)
  const [form, setForm]                   = useState<FormData>({ name: '', capacity: '4', sort_order: '0', section: '', shape: 'square', color: '#6366F1', alert_after_minutes: '' })
  const [sessionModal, setSessionModal]   = useState<RestaurantTable | null>(null)
  const [sessionForm, setSessionForm]     = useState<SessionFormData>({ people_count: '2', waiter_name: '', notes: '' })
  const [saving, setSaving]               = useState(false)
  const [sessionSaving, setSessionSaving] = useState(false)
  const [togglingId, setTogglingId]       = useState<string | null>(null)
  const [deleting, setDeleting]           = useState<string | null>(null)
  const [qrTable, setQrTable]             = useState<RestaurantTable | null>(null)
  const [copied, setCopied]               = useState(false)
  const [now, setNow]                     = useState(Date.now())
  const [activeTab, setActiveTab]         = useState<'mesas' | 'reservas'>('mesas')
  const [viewMode,  setViewMode]          = useState<'grid' | 'map'>('grid')
  const [dismissedAlerts, setDismissedAlerts] = useState<string[]>([])

  // Tick every minute to keep session elapsed time fresh
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 60_000)
    return () => clearInterval(t)
  }, [])

  // Realtime — restaurant_tables + table_sessions
  useEffect(() => {
    const ch = supabase
      .channel(`tables-rt-${businessId}`)
      .on('postgres_changes', {
        event: '*', schema: 'public', table: 'restaurant_tables',
        filter: `business_id=eq.${businessId}`,
      }, ({ eventType, new: n, old }) => {
        if (eventType === 'INSERT') {
          setTables(prev => [...prev, n as RestaurantTable].sort((a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name)))
        } else if (eventType === 'UPDATE') {
          setTables(prev => prev.map(t => t.id === (n as RestaurantTable).id ? n as RestaurantTable : t))
        } else if (eventType === 'DELETE') {
          setTables(prev => prev.filter(t => t.id !== (old as { id: string }).id))
        }
      })
      .on('postgres_changes', {
        event: '*', schema: 'public', table: 'table_sessions',
        filter: `business_id=eq.${businessId}`,
      }, ({ eventType, new: n, old }) => {
        if (eventType === 'INSERT') {
          setSessions(prev => [...prev, n as TableSession])
        } else if (eventType === 'UPDATE') {
          setSessions(prev => prev.map(s => s.id === (n as TableSession).id ? n as TableSession : s))
        } else if (eventType === 'DELETE') {
          setSessions(prev => prev.filter(s => s.id !== (old as { id: string }).id))
        }
      })
      .subscribe()
    return () => { supabase.removeChannel(ch) }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [businessId])

  function getActiveSession(tableId: string) {
    return sessions.find(s => s.table_id === tableId && s.status === 'open') ?? null
  }

  function openAdd() {
    setForm({ name: '', capacity: '4', sort_order: String(tables.length), section: '', shape: 'square', color: '#6366F1', alert_after_minutes: '' })
    setModal({ mode: 'add' })
  }

  function openEdit(table: RestaurantTable) {
    setForm({
      name:                table.name,
      capacity:            String(table.capacity),
      sort_order:          String(table.sort_order),
      section:             table.section ?? '',
      shape:               table.shape,
      color:               table.color,
      alert_after_minutes: table.alert_after_minutes ? String(table.alert_after_minutes) : '',
    })
    setModal({ mode: 'edit', table })
  }

  async function saveForm() {
    if (!form.name.trim()) return
    setSaving(true)
    const alertMins = parseInt(form.alert_after_minutes)
    const payload = {
      name:                form.name.trim(),
      capacity:            Math.max(1, parseInt(form.capacity) || 4),
      sort_order:          parseInt(form.sort_order) || 0,
      section:             form.section.trim() || null,
      shape:               form.shape,
      color:               form.color,
      alert_after_minutes: alertMins > 0 ? alertMins : null,
    }
    if (modal?.mode === 'add') {
      await supabase.from('restaurant_tables')
        .insert({ ...payload, business_id: businessId, status: 'free', active: true })
    } else if (modal?.table) {
      await supabase.from('restaurant_tables')
        .update(payload).eq('id', modal.table.id)
    }
    setSaving(false)
    setModal(null)
  }

  async function openSession() {
    if (!sessionModal) return
    setSessionSaving(true)
    const { data: sess } = await supabase.from('table_sessions').insert({
      business_id:  businessId,
      table_id:     sessionModal.id,
      people_count: Math.max(1, parseInt(sessionForm.people_count) || 1),
      waiter_name:  sessionForm.waiter_name.trim() || null,
      notes:        sessionForm.notes.trim() || null,
      status:       'open',
    }).select().single()
    if (sess) {
      setSessions(prev => [...prev, sess as TableSession])
      // Trigger in DB will set table to occupied, but also update locally for instant feedback
      setTables(prev => prev.map(t => t.id === sessionModal.id ? { ...t, status: 'occupied' } : t))
    }
    setSessionSaving(false)
    setSessionModal(null)
  }

  async function closeSession(table: RestaurantTable) {
    const sess = getActiveSession(table.id)
    setTogglingId(table.id)
    if (sess) {
      const closedAt = new Date().toISOString()
      await supabase.from('table_sessions')
        .update({ status: 'closed', closed_at: closedAt })
        .eq('id', sess.id)
      setSessions(prev => prev.map(s => s.id === sess.id ? { ...s, status: 'closed', closed_at: closedAt } : s))
    }
    // DB trigger now sets table to needs_cleaning; mirror locally
    setTables(prev => prev.map(t => t.id === table.id ? { ...t, status: 'needs_cleaning' } : t))
    setTogglingId(null)
  }

  async function handleStatusAction(table: RestaurantTable) {
    const s = table.status as TableStatus
    if (s === 'free') {
      setSessionForm({ people_count: '2', waiter_name: '', notes: '' })
      setSessionModal(table)
    } else if (s === 'occupied' || s === 'waiting_attention' || s === 'bill_requested') {
      await closeSession(table)
    } else if (s === 'needs_cleaning') {
      // Mark as free after cleaning
      setTogglingId(table.id)
      setTables(prev => prev.map(t => t.id === table.id ? { ...t, status: 'free' } : t))
      await supabase.from('restaurant_tables').update({ status: 'free' }).eq('id', table.id)
      setTogglingId(null)
    } else {
      // reserved / unavailable → free directly
      setTogglingId(table.id)
      setTables(prev => prev.map(t => t.id === table.id ? { ...t, status: 'free' } : t))
      await supabase.from('restaurant_tables').update({ status: 'free' }).eq('id', table.id)
      setTogglingId(null)
    }
  }

  async function attendTable(table: RestaurantTable) {
    // After attending: revert waiting_attention / bill_requested back to occupied
    setTogglingId(table.id)
    setTables(prev => prev.map(t => t.id === table.id ? { ...t, status: 'occupied' } : t))
    await supabase.from('restaurant_tables').update({ status: 'occupied' }).eq('id', table.id)
    setTogglingId(null)
  }

  async function markReserved(table: RestaurantTable) {
    setTables(prev => prev.map(t => t.id === table.id ? { ...t, status: 'reserved' } : t))
    await supabase.from('restaurant_tables').update({ status: 'reserved' }).eq('id', table.id)
  }

  async function markUnavailable(table: RestaurantTable) {
    setTables(prev => prev.map(t => t.id === table.id ? { ...t, status: 'unavailable' } : t))
    await supabase.from('restaurant_tables').update({ status: 'unavailable' }).eq('id', table.id)
  }

  async function deleteTable(id: string) {
    setDeleting(id)
    setTables(prev => prev.filter(t => t.id !== id))
    await supabase.from('restaurant_tables').update({ active: false }).eq('id', id)
    setDeleting(null)
  }

  function tableUrl(table: RestaurantTable) {
    const base = typeof window !== 'undefined' ? window.location.origin : ''
    return `${base}/store/${businessSlug}?mesa=${table.qr_token}`
  }

  async function copyUrl(table: RestaurantTable) {
    await navigator.clipboard.writeText(tableUrl(table))
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  function downloadQR(table: RestaurantTable) {
    const canvas = document.getElementById(`qr-canvas-${table.id}`) as HTMLCanvasElement | null
    if (!canvas) return
    const link = document.createElement('a')
    link.href = canvas.toDataURL('image/png')
    link.download = `qr-${table.name.toLowerCase().replace(/\s+/g, '-')}.png`
    link.click()
  }

  // Group tables by section for display
  const sections = Array.from(new Set(tables.map(t => t.section ?? ''))).sort((a, b) => {
    if (a === '') return 1
    if (b === '') return -1
    return a.localeCompare(b)
  })
  const grouped: Record<string, RestaurantTable[]> = {}
  for (const sec of sections) {
    grouped[sec] = tables
      .filter(t => (t.section ?? '') === sec)
      .sort((a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name))
  }

  const free            = tables.filter(t => t.status === 'free').length
  const occupied        = tables.filter(t => ['occupied', 'waiting_attention', 'bill_requested'].includes(t.status)).length
  const reserved        = tables.filter(t => t.status === 'reserved').length
  const alerts          = tables.filter(t => t.status === 'waiting_attention' || t.status === 'bill_requested').length
  const needsCleaning   = tables.filter(t => t.status === 'needs_cleaning').length

  // Solo dispara si el propietario configuró un umbral explícito
  function isLongWait(table: RestaurantTable): boolean {
    if (!table.alert_after_minutes) return false
    if (!['occupied', 'waiting_attention', 'bill_requested'].includes(table.status)) return false
    const sess = getActiveSession(table.id)
    if (!sess) return false
    return (now - new Date(sess.opened_at).getTime()) / 60_000 >= table.alert_after_minutes
  }

  const overdueTablesForBanner = tables.filter(t => isLongWait(t) && !dismissedAlerts.includes(t.id))

  return (
    <div>
      <SectionTour section="tables" />
      {/* Tab switcher */}
      <div className="flex items-center gap-1 bg-gray-100 rounded-xl p-1 w-fit mb-5">
        {([
          { key: 'mesas',    label: 'Mesas',    icon: Utensils    },
          { key: 'reservas', label: 'Reservas', icon: CalendarDays },
        ] as const).map(({ key, label, icon: Icon }) => (
          <button key={key} onClick={() => setActiveTab(key)}
            className={cn(
              'flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-medium transition-all',
              activeTab === key ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
            )}>
            <Icon size={14} />{label}
          </button>
        ))}
      </div>

      {activeTab === 'reservas' && (
        <ReservationsTab
          businessId={businessId}
          tables={tables}
          color={primaryColor}
          initialReservations={initialReservations}
        />
      )}

      {activeTab === 'mesas' && <div>

      {/* Status bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <div className="flex items-center gap-3 text-sm flex-wrap">
          <StatusPill color="#22C55E" label={`${free} libres`} />
          <StatusPill color="#EF4444" label={`${occupied} ocupadas`} />
          {reserved > 0 && <StatusPill color="#F59E0B" label={`${reserved} reservadas`} />}
          {alerts > 0 && <StatusPill color="#F97316" label={`${alerts} alertas`} pulse />}
          {needsCleaning > 0 && <StatusPill color="#8B5CF6" label={`${needsCleaning} limpieza`} />}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {/* View toggle */}
          <div className="flex items-center gap-0.5 bg-gray-100 rounded-xl p-1">
            <button
              onClick={() => setViewMode('grid')}
              title="Vista grilla"
              className={cn('flex h-8 w-8 items-center justify-center rounded-lg transition-all',
                viewMode === 'grid' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-400 hover:text-gray-700')}>
              <LayoutGrid size={14} />
            </button>
            <button
              onClick={() => setViewMode('map')}
              title="Mapa del salón"
              className={cn('flex h-8 w-8 items-center justify-center rounded-lg transition-all',
                viewMode === 'map' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-400 hover:text-gray-700')}>
              <Map size={14} />
            </button>
          </div>
          <button
            onClick={openAdd}
            className="flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold
                       text-white transition-all hover:opacity-90"
            style={{ background: primaryColor }}
          >
            <Plus size={15} /> Nueva mesa
          </button>
        </div>
      </div>

      {/* ── Map view ─────────────────────────────────────────────── */}
      {viewMode === 'map' && tables.length > 0 && (
        <FloorPlanMap
          tables={tables}
          sessions={sessions}
          now={now}
          primaryColor={primaryColor}
          togglingId={togglingId}
          onAction={handleStatusAction}
          onAttend={attendTable}
          onCloseSession={closeSession}
          onEdit={openEdit}
          onQR={setQrTable}
          onMarkReserved={markReserved}
          onMarkUnavailable={markUnavailable}
          onPositionChange={async (tableId, x, y) => {
            setTables(prev => prev.map(t => t.id === tableId ? { ...t, x_pos: x, y_pos: y } : t))
            await supabase.from('restaurant_tables').update({ x_pos: x, y_pos: y }).eq('id', tableId)
          }}
        />
      )}

      {/* ── Grid view ────────────────────────────────────────────── */}
      {(viewMode === 'grid' || tables.length === 0) && (
      /* Floor plan — grouped by section */
      tables.length === 0 ? (
        <div className="py-20 text-center">
          <div className="text-4xl mb-3">🍽️</div>
          <p className="text-gray-500 text-sm mb-4">Todavía no tenés mesas configuradas</p>
          <button onClick={openAdd} className="text-sm font-semibold underline" style={{ color: primaryColor }}>
            Agregar primera mesa
          </button>
        </div>
      ) : (
        <div className="space-y-6">
          {sections.map(sec => (
            <div key={sec}>
              {sec && (
                <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3 flex items-center gap-2">
                  <span className="h-px flex-1 bg-gray-100" />
                  {sec}
                  <span className="h-px flex-1 bg-gray-100" />
                </h3>
              )}
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                {grouped[sec].map(table => {
                  const conf      = STATUS_CONF[table.status as TableStatus] ?? STATUS_CONF.free
                  const sess      = getActiveSession(table.id)
                  const isTogg    = togglingId === table.id
                  const elapsed   = sess ? (now - new Date(sess.opened_at).getTime()) / 60_000 : 0
                  const longWait  = isLongWait(table)
                  const isDismissed = dismissedAlerts.includes(table.id)
                  const showPopup = longWait && !isDismissed
                  const isAlert   = table.status === 'waiting_attention' || table.status === 'bill_requested'

                  return (
                    <div key={table.id} className={cn('relative', showPopup && 'mt-10')}>

                      {/* ── Popup de alerta flotante ── */}
                      {showPopup && (
                        <div className="absolute -top-10 left-0 right-0 z-20 flex justify-center px-1">
                          <div className="relative w-full bg-red-600 text-white rounded-xl px-2.5 py-1.5 shadow-lg shadow-red-300 flex items-center gap-1.5">
                            <AlertTriangle size={12} className="shrink-0 animate-pulse" />
                            <span className="flex-1 text-[11px] font-bold leading-tight truncate">
                              ⏱ {Math.round(elapsed)} min sin atender
                            </span>
                            <button
                              onClick={e => { e.stopPropagation(); setDismissedAlerts(prev => [...prev, table.id]) }}
                              className="flex h-5 w-5 shrink-0 items-center justify-center rounded-lg bg-white/25 hover:bg-white/40 transition-colors"
                            >
                              <XIcon size={10} />
                            </button>
                            {/* Triángulo apuntando hacia abajo */}
                            <span className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 w-3 h-3 bg-red-600 rotate-45 rounded-sm" />
                          </div>
                        </div>
                      )}

                      {/* ── Tarjeta de mesa ── */}
                      <div
                        className={cn(
                          'rounded-2xl border flex flex-col gap-2 p-4 transition-all',
                          isAlert && 'ring-2',
                          showPopup && 'ring-2 ring-red-400',
                        )}
                        style={{
                          background:  conf.bg,
                          borderColor: conf.dot + '55',
                          ...(isAlert ? { ringColor: conf.dot } : {}),
                        }}
                      >
                      {/* Header */}
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ background: table.color }} />
                          <p className="font-bold text-gray-900 text-base leading-tight truncate">{table.name}</p>
                        </div>
                        <span
                          className={cn(
                            'flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold shrink-0',
                            conf.pulse && 'animate-pulse',
                          )}
                          style={{ background: conf.dot + '22', color: conf.text }}
                        >
                          {table.status === 'waiting_attention' && <Bell size={9} />}
                          {table.status === 'bill_requested'    && <Receipt size={9} />}
                          {table.status === 'needs_cleaning'    && <Sparkles size={9} />}
                          {!['waiting_attention','bill_requested','needs_cleaning'].includes(table.status) && (
                            <span className="h-1.5 w-1.5 rounded-full inline-block" style={{ background: conf.dot }} />
                          )}
                          {conf.label}
                        </span>
                      </div>

                      {/* Capacity row */}
                      <div className="flex items-center gap-1.5 text-xs text-gray-400">
                        <Users size={11} />
                        <span>{table.capacity} personas</span>
                        {table.shape === 'round' && <span className="ml-1">●</span>}
                        {table.shape === 'rectangle' && <span className="ml-1 text-[10px]">▬</span>}
                      </div>

                      {/* Active session info */}
                      {sess && (
                        <div className="rounded-xl bg-white/60 px-2.5 py-2 space-y-1 border border-white/80">
                          <div className="flex items-center justify-between text-[11px] text-gray-500">
                            <span className={cn('flex items-center gap-1', elapsed > 60 && 'text-red-500 font-semibold')}>
                              <Clock size={10} /> {formatMinutes(elapsed)}
                            </span>
                            <span className="flex items-center gap-1">
                              <Users size={10} /> {sess.people_count}p
                            </span>
                          </div>
                          {sess.waiter_name && (
                            <p className="text-[11px] text-gray-500 truncate flex items-center gap-1">
                              <Utensils size={10} /> {sess.waiter_name}
                            </p>
                          )}
                          {sess.total_billed > 0 && (
                            <p className="text-xs font-semibold text-gray-700">
                              ${sess.total_billed.toFixed(2)}
                            </p>
                          )}
                        </div>
                      )}

                      {/* Action buttons */}
                      <div className="flex items-center gap-1.5 mt-auto pt-1">
                        {/* Primary action */}
                        {isAlert ? (
                          <>
                            <button
                              onClick={() => attendTable(table)}
                              disabled={isTogg}
                              className="flex-1 rounded-xl py-1.5 text-xs font-bold transition-all border animate-pulse hover:animate-none disabled:opacity-50 text-white"
                              style={{ background: conf.dot }}
                            >
                              {isTogg ? '…' : conf.btnLabel}
                            </button>
                            <button
                              onClick={() => closeSession(table)}
                              disabled={isTogg}
                              className="rounded-xl px-2.5 py-1.5 text-xs font-semibold transition-all border border-gray-200 bg-white/50 text-gray-600"
                            >
                              Cerrar
                            </button>
                          </>
                        ) : (
                          <button
                            onClick={() => handleStatusAction(table)}
                            disabled={isTogg}
                            className="flex-1 rounded-xl py-1.5 text-xs font-semibold transition-all border hover:opacity-90 disabled:opacity-50"
                            style={{ background: conf.dot + '18', color: conf.text, borderColor: conf.dot + '44' }}
                          >
                            {isTogg ? '…' : conf.btnLabel}
                          </button>
                        )}

                        {table.status === 'free' && (
                          <button
                            onClick={() => markReserved(table)}
                            title="Marcar reservada"
                            className="flex h-8 w-8 items-center justify-center rounded-xl border
                                       bg-white/50 text-amber-400 hover:text-amber-600 transition-all text-xs font-bold"
                          >
                            R
                          </button>
                        )}

                        {table.status === 'free' && (
                          <button
                            onClick={() => markUnavailable(table)}
                            title="Deshabilitar mesa"
                            className="flex h-8 w-8 items-center justify-center rounded-xl border
                                       bg-white/50 text-gray-300 hover:text-gray-500 transition-all"
                          >
                            <XIcon size={12} />
                          </button>
                        )}

                        <button
                          onClick={() => setQrTable(table)}
                          title="Ver QR"
                          className="flex h-8 w-8 items-center justify-center rounded-xl border
                                     bg-white/50 text-gray-400 hover:text-gray-700 transition-all"
                        >
                          <QrCode size={13} />
                        </button>

                        <button
                          onClick={() => openEdit(table)}
                          className="flex h-8 w-8 items-center justify-center rounded-xl border
                                     bg-white/50 text-gray-400 hover:text-gray-700 transition-all"
                        >
                          <Edit2 size={13} />
                        </button>

                        <button
                          onClick={() => deleteTable(table.id)}
                          disabled={deleting === table.id}
                          className="flex h-8 w-8 items-center justify-center rounded-xl border
                                     bg-white/50 text-red-300 hover:text-red-500 transition-all disabled:opacity-30"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      )
      )}

      {/* ── QR Modal ─────────────────────────────────────────────── */}
      {qrTable && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="w-full max-w-xs bg-white rounded-2xl shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
              <div>
                <p className="font-semibold text-gray-900">{qrTable.name}</p>
                <p className="text-xs text-gray-400 mt-0.5">{qrTable.capacity} personas</p>
              </div>
              <button
                onClick={() => { setQrTable(null); setCopied(false) }}
                className="flex h-7 w-7 items-center justify-center rounded-lg text-gray-400 hover:bg-gray-100 transition-colors"
              >
                <XIcon size={15} />
              </button>
            </div>

            <div className="flex flex-col items-center gap-4 px-5 py-6">
              <div className="p-3 bg-white rounded-2xl border border-gray-100 shadow-sm">
                <QRCodeSVG value={tableUrl(qrTable)} size={192} fgColor="#111111" bgColor="#ffffff" level="M" />
              </div>
              <div className="hidden">
                <QRCodeCanvas id={`qr-canvas-${qrTable.id}`} value={tableUrl(qrTable)} size={512} fgColor="#111111" bgColor="#ffffff" level="M" />
              </div>
              <p className="text-xs text-gray-400 text-center leading-relaxed px-2">
                El cliente escanea el QR y accede al menú con{' '}
                <span className="font-medium text-gray-600">la mesa pre-seleccionada</span>
              </p>
            </div>

            <div className="px-5 pb-5 grid grid-cols-2 gap-2">
              <button
                onClick={() => copyUrl(qrTable)}
                className={cn(
                  'flex items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-medium transition-all border',
                  copied
                    ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                    : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                )}
              >
                {copied ? <Check size={14} /> : <Copy size={14} />}
                {copied ? 'Copiado' : 'Copiar link'}
              </button>
              <button
                onClick={() => downloadQR(qrTable)}
                className="flex items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-semibold text-white transition-all"
                style={{ background: primaryColor }}
              >
                <Download size={14} /> Descargar
              </button>
            </div>
          </div>
        </div>
      )}

      </div>}

      {/* ── Open session modal ────────────────────────────────────── */}
      {sessionModal && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center
                        p-4 bg-black/40 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl">
            <div className="flex items-center justify-between mb-5">
              <div>
                <h3 className="text-base font-semibold text-gray-900">Abrir {sessionModal.name}</h3>
                <p className="text-xs text-gray-400 mt-0.5">Nueva sesión</p>
              </div>
              <button
                onClick={() => setSessionModal(null)}
                className="flex h-7 w-7 items-center justify-center rounded-lg text-gray-400 hover:bg-gray-100"
              >
                <XIcon size={15} />
              </button>
            </div>

            <div className="space-y-4">
              <Field label="Cantidad de personas">
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => setSessionForm(f => ({ ...f, people_count: String(Math.max(1, parseInt(f.people_count) - 1)) }))}
                    className="flex h-9 w-9 items-center justify-center rounded-xl border border-gray-200
                               text-gray-600 hover:bg-gray-50 font-bold text-lg transition-colors"
                  >−</button>
                  <span className="flex-1 text-center text-2xl font-bold text-gray-900">
                    {sessionForm.people_count}
                  </span>
                  <button
                    type="button"
                    onClick={() => setSessionForm(f => ({ ...f, people_count: String(parseInt(f.people_count) + 1) }))}
                    className="flex h-9 w-9 items-center justify-center rounded-xl border border-gray-200
                               text-gray-600 hover:bg-gray-50 font-bold text-lg transition-colors"
                  >+</button>
                </div>
              </Field>

              <Field label="Mozo / Encargado (opcional)">
                <input
                  type="text"
                  value={sessionForm.waiter_name}
                  onChange={e => setSessionForm(f => ({ ...f, waiter_name: e.target.value }))}
                  placeholder="Nombre del mozo"
                  className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm
                             focus:outline-none focus:border-gray-400 transition-colors"
                />
              </Field>

              <Field label="Notas (opcional)">
                <input
                  type="text"
                  value={sessionForm.notes}
                  onChange={e => setSessionForm(f => ({ ...f, notes: e.target.value }))}
                  placeholder="Ej: cumpleaños, alérgicos, etc."
                  className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm
                             focus:outline-none focus:border-gray-400 transition-colors"
                />
              </Field>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setSessionModal(null)}
                className="flex-1 rounded-xl border border-gray-200 py-2.5 text-sm font-medium
                           text-gray-600 hover:bg-gray-50 transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={openSession}
                disabled={sessionSaving}
                className="flex-1 rounded-xl py-2.5 text-sm font-semibold text-white
                           transition-all hover:opacity-90 disabled:opacity-40"
                style={{ background: primaryColor }}
              >
                {sessionSaving ? 'Abriendo…' : 'Abrir mesa'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Add / Edit table modal ────────────────────────────────── */}
      {modal && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center
                        p-4 bg-black/40 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl">
            <h3 className="text-base font-semibold text-gray-900 mb-5">
              {modal.mode === 'add' ? 'Nueva mesa' : 'Editar mesa'}
            </h3>

            <div className="space-y-4">
              <Field label="Nombre">
                <input
                  type="text"
                  value={form.name}
                  onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  onKeyDown={e => e.key === 'Enter' && saveForm()}
                  placeholder="Ej: Mesa 1, Barra, Terraza"
                  className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm
                             focus:outline-none focus:border-gray-400 transition-colors"
                  autoFocus
                />
              </Field>

              <div className="grid grid-cols-2 gap-3">
                <Field label="Capacidad">
                  <input
                    type="number" min="1" max="50"
                    value={form.capacity}
                    onChange={e => setForm(f => ({ ...f, capacity: e.target.value }))}
                    className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm
                               focus:outline-none focus:border-gray-400 transition-colors"
                  />
                </Field>
                <Field label="Orden">
                  <input
                    type="number" min="0"
                    value={form.sort_order}
                    onChange={e => setForm(f => ({ ...f, sort_order: e.target.value }))}
                    className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm
                               focus:outline-none focus:border-gray-400 transition-colors"
                  />
                </Field>
              </div>

              <Field label="Sección (opcional)">
                <input
                  type="text"
                  value={form.section}
                  onChange={e => setForm(f => ({ ...f, section: e.target.value }))}
                  placeholder="Ej: Salón, Terraza, VIP, Barra"
                  className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm
                             focus:outline-none focus:border-gray-400 transition-colors"
                />
              </Field>

              <Field label="Alerta de demora (minutos, opcional)">
                <input
                  type="number" min="1" max="999"
                  value={form.alert_after_minutes}
                  onChange={e => setForm(f => ({ ...f, alert_after_minutes: e.target.value }))}
                  placeholder="Ej: 30"
                  className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm
                             focus:outline-none focus:border-gray-400 transition-colors"
                />
              </Field>

              <Field label="Forma">
                <div className="flex gap-2">
                  {SHAPES.map(s => (
                    <button
                      key={s.value}
                      type="button"
                      onClick={() => setForm(f => ({ ...f, shape: s.value }))}
                      className={cn(
                        'flex-1 rounded-xl border py-2 text-xs font-medium transition-all',
                        form.shape === s.value
                          ? 'border-gray-700 bg-gray-900 text-white'
                          : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                      )}
                    >
                      {s.label}
                    </button>
                  ))}
                </div>
              </Field>

              <Field label="Color de identificación">
                <div className="flex items-center gap-2 flex-wrap">
                  {PRESET_COLORS.map(c => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setForm(f => ({ ...f, color: c }))}
                      className={cn(
                        'h-7 w-7 rounded-full border-2 transition-all',
                        form.color === c ? 'border-gray-700 scale-110' : 'border-transparent hover:border-gray-300'
                      )}
                      style={{ background: c }}
                    />
                  ))}
                  <input
                    type="color"
                    value={form.color}
                    onChange={e => setForm(f => ({ ...f, color: e.target.value }))}
                    className="h-7 w-7 rounded-full cursor-pointer border-0 p-0 bg-transparent"
                    title="Color personalizado"
                  />
                </div>
              </Field>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setModal(null)}
                className="flex-1 rounded-xl border border-gray-200 py-2.5 text-sm font-medium
                           text-gray-600 hover:bg-gray-50 transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={saveForm}
                disabled={saving || !form.name.trim()}
                className="flex-1 rounded-xl py-2.5 text-sm font-semibold text-white
                           transition-all hover:opacity-90 disabled:opacity-40"
                style={{ background: primaryColor }}
              >
                {saving ? 'Guardando…' : 'Guardar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Floor Plan Map ────────────────────────────────────────────
function FloorPlanMap({
  tables, sessions, now, primaryColor, togglingId,
  onAction, onAttend, onCloseSession, onEdit, onQR, onMarkReserved, onMarkUnavailable, onPositionChange,
}: {
  tables:     RestaurantTable[]
  sessions:   TableSession[]
  now:        number
  primaryColor: string
  togglingId: string | null
  onAction:         (t: RestaurantTable) => void
  onAttend:         (t: RestaurantTable) => void
  onCloseSession:   (t: RestaurantTable) => void
  onEdit:           (t: RestaurantTable) => void
  onQR:             (t: RestaurantTable) => void
  onMarkReserved:   (t: RestaurantTable) => void
  onMarkUnavailable:(t: RestaurantTable) => void
  onPositionChange: (tableId: string, x: number, y: number) => void
}) {
  const containerRef = useRef<HTMLDivElement>(null)
  const dragRef = useRef<{ tableId: string; startX: number; startY: number; origX: number; origY: number } | null>(null)
  const [livePos,   setLivePos]   = useState<Record<string, { x: number; y: number }>>({})
  const [dragging,  setDragging]  = useState<string | null>(null)
  const [selected,  setSelected]  = useState<RestaurantTable | null>(null)

  // Auto-layout: if all tables are at 0,0, distribute them in a grid
  const needsAutoLayout = useMemo(() => tables.every(t => t.x_pos === 0 && t.y_pos === 0), [tables])
  const autoPositions   = useMemo(() => {
    if (!needsAutoLayout) return {} as Record<string, { x: number; y: number }>
    const cols = Math.max(2, Math.ceil(Math.sqrt(tables.length * 1.6)))
    const rows = Math.ceil(tables.length / cols)
    const result: Record<string, { x: number; y: number }> = {}
    tables.forEach((t, i) => {
      const col = i % cols
      const row = Math.floor(i / cols)
      result[t.id] = {
        x: 8 + (col / Math.max(cols - 1, 1)) * 84,
        y: 10 + (row / Math.max(rows - 1, 1)) * 78,
      }
    })
    return result
  }, [tables, needsAutoLayout])

  function getPos(table: RestaurantTable) {
    return livePos[table.id] ?? autoPositions[table.id] ?? { x: table.x_pos, y: table.y_pos }
  }

  function onMouseDown(e: React.MouseEvent, table: RestaurantTable) {
    e.preventDefault()
    e.stopPropagation()
    dragRef.current = {
      tableId: table.id,
      startX:  e.clientX,
      startY:  e.clientY,
      origX:   getPos(table).x,
      origY:   getPos(table).y,
    }
    setDragging(table.id)
    setSelected(null)
  }

  function onMouseMove(e: React.MouseEvent) {
    if (!dragRef.current || !containerRef.current) return
    const rect = containerRef.current.getBoundingClientRect()
    const dx = ((e.clientX - dragRef.current.startX) / rect.width)  * 100
    const dy = ((e.clientY - dragRef.current.startY) / rect.height) * 100
    const nx = Math.max(4, Math.min(96, dragRef.current.origX + dx))
    const ny = Math.max(4, Math.min(96, dragRef.current.origY + dy))
    setLivePos(prev => ({ ...prev, [dragRef.current!.tableId]: { x: nx, y: ny } }))
  }

  function onMouseUp(e: React.MouseEvent) {
    if (!dragRef.current) return
    const d     = dragRef.current
    dragRef.current = null
    setDragging(null)
    const moved = Math.abs(e.clientX - d.startX) > 6 || Math.abs(e.clientY - d.startY) > 6
    if (moved) {
      const pos = livePos[d.tableId]
      if (pos) {
        onPositionChange(d.tableId, pos.x, pos.y)
        setLivePos(prev => { const p = { ...prev }; delete p[d.tableId]; return p })
      }
    } else {
      const t = tables.find(t => t.id === d.tableId)
      if (t) setSelected(prev => prev?.id === t.id ? null : t)
    }
  }

  function onTouchStart(e: React.TouchEvent, table: RestaurantTable) {
    const touch = e.touches[0]
    dragRef.current = {
      tableId: table.id, startX: touch.clientX, startY: touch.clientY,
      origX: getPos(table).x, origY: getPos(table).y,
    }
    setDragging(table.id)
  }

  function onTouchMove(e: React.TouchEvent) {
    if (!dragRef.current || !containerRef.current) return
    e.preventDefault()
    const touch = e.touches[0]
    const rect  = containerRef.current.getBoundingClientRect()
    const dx = ((touch.clientX - dragRef.current.startX) / rect.width)  * 100
    const dy = ((touch.clientY - dragRef.current.startY) / rect.height) * 100
    const nx = Math.max(4, Math.min(96, dragRef.current.origX + dx))
    const ny = Math.max(4, Math.min(96, dragRef.current.origY + dy))
    setLivePos(prev => ({ ...prev, [dragRef.current!.tableId]: { x: nx, y: ny } }))
  }

  function onTouchEnd(e: React.TouchEvent) {
    if (!dragRef.current) return
    const d = dragRef.current
    dragRef.current = null
    setDragging(null)
    const touch = e.changedTouches[0]
    const moved = Math.abs(touch.clientX - d.startX) > 8 || Math.abs(touch.clientY - d.startY) > 8
    if (moved) {
      const pos = livePos[d.tableId]
      if (pos) {
        onPositionChange(d.tableId, pos.x, pos.y)
        setLivePos(prev => { const p = { ...prev }; delete p[d.tableId]; return p })
      }
    } else {
      const t = tables.find(t => t.id === d.tableId)
      if (t) setSelected(prev => prev?.id === t.id ? null : t)
    }
  }

  const sel = selected ? tables.find(t => t.id === selected.id) ?? null : null
  const selConf = sel ? (STATUS_CONF[sel.status as TableStatus] ?? STATUS_CONF.free) : null
  const selSess = sel ? sessions.find(s => s.table_id === sel.id && s.status === 'open') ?? null : null
  const selElapsed = selSess ? (now - new Date(selSess.opened_at).getTime()) / 60_000 : 0
  const isSelAlert = sel && (sel.status === 'waiting_attention' || sel.status === 'bill_requested')

  return (
    <div className="space-y-3">
      {/* Canvas */}
      <div
        ref={containerRef}
        className="relative w-full rounded-2xl border border-gray-200 overflow-hidden select-none"
        style={{
          aspectRatio: '16/7',
          background: '#F8F9FA',
          backgroundImage: 'radial-gradient(circle, #d1d5db 1px, transparent 1px)',
          backgroundSize: '28px 28px',
          cursor: dragging ? 'grabbing' : 'default',
        }}
        onMouseMove={onMouseMove}
        onMouseUp={onMouseUp}
        onMouseLeave={onMouseUp}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
      >
        {/* Hint */}
        <div className="absolute top-2.5 left-3 bg-white/80 backdrop-blur-sm rounded-lg px-2.5 py-1 pointer-events-none">
          <p className="text-[10px] text-gray-400 font-medium">Arrastrá para mover · Tocá para acciones</p>
        </div>

        {/* Auto-layout hint */}
        {needsAutoLayout && (
          <div className="absolute top-2.5 right-3 bg-amber-50/90 border border-amber-200 rounded-lg px-2.5 py-1 pointer-events-none">
            <p className="text-[10px] text-amber-600 font-medium">Posiciones automáticas — arrastrá para personalizar</p>
          </div>
        )}

        {tables.map(table => {
          const conf    = STATUS_CONF[table.status as TableStatus] ?? STATUS_CONF.free
          const pos     = getPos(table)
          const sess    = sessions.find(s => s.table_id === table.id && s.status === 'open')
          const isDrag  = dragging === table.id
          const isSel   = selected?.id === table.id
          const isAlert = table.status === 'waiting_attention' || table.status === 'bill_requested'
          const elapsed = sess ? (now - new Date(sess.opened_at).getTime()) / 60_000 : 0
          const isOverdue = !!table.alert_after_minutes && !!sess && elapsed >= table.alert_after_minutes

          const W = table.shape === 'rectangle' ? 108 : 78
          const H = table.shape === 'rectangle' ? 64  : 78

          return (
            <div
              key={table.id}
              onMouseDown={e => onMouseDown(e, table)}
              onTouchStart={e => onTouchStart(e, table)}
              style={{
                position:    'absolute',
                left:        `${pos.x}%`,
                top:         `${pos.y}%`,
                transform:   'translate(-50%, -50%)',
                width:       `${W}px`,
                height:      `${H}px`,
                background:  isSel ? conf.dot + '22' : conf.bg,
                borderColor: isSel ? conf.dot : isOverdue ? '#DC2626' : conf.dot + '99',
                borderWidth:  isSel ? '2px' : isOverdue ? '2px' : '1.5px',
                cursor:      isDrag ? 'grabbing' : 'grab',
                zIndex:      isDrag ? 20 : isSel ? 10 : 1,
                boxShadow:   isDrag ? '0 8px 28px rgba(0,0,0,0.18)' : isSel ? `0 0 0 3px ${conf.dot}44` : isOverdue ? '0 0 0 3px #FCA5A5' : '0 1px 6px rgba(0,0,0,0.07)',
                transition:  isDrag ? 'none' : 'box-shadow 0.15s, border-color 0.15s',
              }}
              className={cn(
                'relative border flex flex-col items-center justify-center gap-0.5',
                table.shape === 'round' ? 'rounded-full' : 'rounded-xl',
                isAlert && !isDrag && 'animate-pulse',
              )}
            >
              {/* ── Popup de alerta de reloj ── */}
              {isOverdue && !isDrag && (
                <div className="absolute -top-7 left-1/2 -translate-x-1/2 z-30 pointer-events-none">
                  <div className="relative bg-red-600 text-white rounded-lg px-2 py-1 flex items-center gap-1 shadow-lg whitespace-nowrap animate-pulse">
                    <Clock size={9} className="shrink-0" />
                    <span className="text-[10px] font-extrabold">{Math.round(elapsed)}m</span>
                    {/* Flecha hacia abajo */}
                    <span className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 w-3 h-3 bg-red-600 rotate-45 rounded-sm" />
                  </div>
                </div>
              )}

              {/* Color dot */}
              <span className="h-2 w-2 rounded-full shrink-0" style={{ background: table.color }} />

              {/* Name */}
              <p className="text-[11px] font-bold text-gray-800 leading-none text-center px-1 truncate w-full text-center">
                {table.name}
              </p>

              {/* Session: people count + elapsed */}
              {sess && (
                <p className={cn(
                  'text-[9px] font-medium flex items-center gap-0.5 leading-none',
                  isOverdue ? 'text-red-500 font-bold' : elapsed > 60 ? 'text-red-500' : 'text-gray-400',
                )}>
                  <Users size={7} /> {sess.people_count}p
                  {elapsed > 0 && ` · ${Math.round(elapsed)}m`}
                </p>
              )}

              {/* Status icons */}
              {table.status === 'waiting_attention' && <Bell    size={10} className="text-orange-500" />}
              {table.status === 'bill_requested'    && <Receipt size={10} className="text-blue-500"   />}
              {table.status === 'needs_cleaning'    && <Sparkles size={10} className="text-purple-500"/>}
            </div>
          )
        })}
      </div>

      {/* Action panel for selected table */}
      {sel && selConf && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 animate-slide-up">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2.5">
              <div className="h-8 w-8 rounded-xl flex items-center justify-center"
                style={{ background: selConf.bg, border: `1.5px solid ${selConf.dot}66` }}>
                <span className="h-2.5 w-2.5 rounded-full" style={{ background: sel.color }} />
              </div>
              <div>
                <p className="text-sm font-bold text-gray-900">{sel.name}</p>
                <p className="text-xs text-gray-400 flex items-center gap-1">
                  <Users size={10} /> {sel.capacity} personas
                  {selSess && (
                    <span className={cn('ml-1', selElapsed > 60 && 'text-red-500 font-semibold')}>
                      · <Clock size={10} className="inline" /> {Math.round(selElapsed)}min
                    </span>
                  )}
                </p>
              </div>
            </div>
            <span className={cn('flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-bold', selConf.pulse && 'animate-pulse')}
              style={{ background: selConf.dot + '22', color: selConf.text }}>
              {selConf.label}
            </span>
          </div>

          {selSess && selSess.waiter_name && (
            <p className="text-xs text-gray-500 flex items-center gap-1 mb-3">
              <Utensils size={11} /> {selSess.waiter_name}
              {selSess.total_billed > 0 && ` · $${selSess.total_billed.toFixed(2)}`}
            </p>
          )}

          <div className="flex items-center gap-2 flex-wrap">
            {/* Primary action */}
            {isSelAlert ? (
              <>
                <button onClick={() => { onAttend(sel); setSelected(null) }}
                  disabled={!!togglingId}
                  className="rounded-xl px-3.5 py-2 text-xs font-bold text-white transition-all disabled:opacity-40 animate-pulse hover:animate-none"
                  style={{ background: selConf.dot }}>
                  {selConf.btnLabel}
                </button>
                <button onClick={() => { onCloseSession(sel); setSelected(null) }}
                  className="rounded-xl border border-gray-200 px-3.5 py-2 text-xs font-semibold text-gray-600 hover:bg-gray-50 transition-colors">
                  Cerrar mesa
                </button>
              </>
            ) : (
              <button onClick={() => { onAction(sel); setSelected(null) }}
                disabled={!!togglingId}
                className="rounded-xl px-3.5 py-2 text-xs font-semibold transition-all disabled:opacity-40"
                style={{ background: selConf.dot + '18', color: selConf.text, border: `1px solid ${selConf.dot}44` }}>
                {selConf.btnLabel}
              </button>
            )}

            {sel.status === 'free' && (
              <button onClick={() => { onMarkReserved(sel); setSelected(null) }}
                className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-700 hover:bg-amber-100 transition-colors">
                Reservar
              </button>
            )}
            {sel.status === 'free' && (
              <button onClick={() => { onMarkUnavailable(sel); setSelected(null) }}
                className="rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-xs font-semibold text-gray-500 hover:bg-gray-100 transition-colors">
                No disponible
              </button>
            )}

            <div className="flex items-center gap-1 ml-auto">
              <button onClick={() => { onQR(sel); setSelected(null) }}
                className="flex h-8 w-8 items-center justify-center rounded-xl border bg-gray-50 text-gray-400 hover:text-gray-700 transition-colors">
                <QrCode size={13} />
              </button>
              <button onClick={() => { onEdit(sel); setSelected(null) }}
                className="flex h-8 w-8 items-center justify-center rounded-xl border bg-gray-50 text-gray-400 hover:text-gray-700 transition-colors">
                <Edit2 size={13} />
              </button>
              <button onClick={() => setSelected(null)}
                className="flex h-8 w-8 items-center justify-center rounded-xl border bg-gray-50 text-gray-400 hover:text-gray-700 transition-colors">
                <XIcon size={13} />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function StatusPill({ color, label, pulse }: { color: string; label: string; pulse?: boolean }) {
  return (
    <span className="flex items-center gap-1.5 text-gray-600 font-medium">
      <span className={cn('h-2.5 w-2.5 rounded-full', pulse && 'animate-pulse')} style={{ background: color }} />
      {label}
    </span>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="text-xs font-medium text-gray-500 block mb-1">{label}</label>
      {children}
    </div>
  )
}
