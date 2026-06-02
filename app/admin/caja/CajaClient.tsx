// app/admin/caja/CajaClient.tsx
'use client'
import { useState, useMemo, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import {
  Wallet, Plus, X, Check, ChevronDown, ArrowUpCircle, ArrowDownCircle,
  Clock, TrendingUp, DollarSign, AlertTriangle, History, Lock,
} from 'lucide-react'
import { cn, formatPrice, formatDate } from '@/lib/utils'
import { useVertical } from '@/lib/vertical-context'

// ── Types ──────────────────────────────────────────────────────
interface Movement {
  id: string
  type: 'ingreso' | 'extraccion'
  amount: number
  reason: string | null
  created_at: string
}

interface Register {
  id: string
  opened_at: string
  closed_at: string | null
  opening_amount: number
  closing_amount: number | null
  expected_amount: number | null
  difference: number | null
  status: 'open' | 'closed'
  notes: string | null
  movements?: Movement[]
}

interface Props {
  openRegister: Register | null
  history:      Register[]
  todaySales:   number
  profileId:    string
}

// ── Helpers ────────────────────────────────────────────────────
function elapsed(from: string): string {
  const diff = Math.floor((Date.now() - new Date(from).getTime()) / 1000)
  const h    = Math.floor(diff / 3600)
  const m    = Math.floor((diff % 3600) / 60)
  return h > 0 ? `${h}h ${m}m` : `${m}m`
}

function diffColor(diff: number | null): string {
  if (diff === null) return 'text-gray-400'
  if (Math.abs(diff) < 1)   return 'text-gray-500'
  return diff > 0 ? 'text-emerald-600' : 'text-red-500'
}

// ── Main component ─────────────────────────────────────────────
export default function CajaClient({ openRegister: initial, history: initialHistory, todaySales, profileId }: Props) {
  const { businessId, currency, color } = useVertical()
  const supabase = createClient()

  const [register,  setRegister]  = useState<Register | null>(initial)
  const [movements, setMovements] = useState<Movement[]>(initial?.movements ?? [])
  const [history,   setHistory]   = useState<Register[]>(initialHistory)
  const [tab,       setTab]       = useState<'caja' | 'historial'>('caja')

  // modal states
  const [showOpen,    setShowOpen]    = useState(false)
  const [showClose,   setShowClose]   = useState(false)
  const [showMovForm, setShowMovForm] = useState(false)
  const [tick,        setTick]        = useState(0)

  // tick each minute to update elapsed time
  useEffect(() => {
    if (!register) return
    const id = setInterval(() => setTick(t => t + 1), 60_000)
    return () => clearInterval(id)
  }, [register])

  // ── Computed ─────────────────────────────────────────────────
  const ingresos    = useMemo(() => movements.filter(m => m.type === 'ingreso').reduce((s, m) => s + m.amount, 0),    [movements])
  const extracciones = useMemo(() => movements.filter(m => m.type === 'extraccion').reduce((s, m) => s + m.amount, 0), [movements])
  const expected    = register ? register.opening_amount + todaySales + ingresos - extracciones : 0

  // ── Handlers ─────────────────────────────────────────────────
  async function handleOpen(openingAmount: number) {
    const { data } = await supabase
      .from('cash_registers')
      .insert({ business_id: businessId, opened_by: profileId, opening_amount: openingAmount, status: 'open' })
      .select('*')
      .single()
    if (data) { setRegister(data as Register); setMovements([]) }
    setShowOpen(false)
  }

  async function handleClose(closingAmount: number, notes: string) {
    if (!register) return
    const diff = closingAmount - expected
    const { data } = await supabase
      .from('cash_registers')
      .update({
        status: 'closed', closed_by: profileId,
        closed_at: new Date().toISOString(),
        closing_amount: closingAmount,
        expected_amount: expected,
        difference: diff,
        notes: notes || null,
      })
      .eq('id', register.id)
      .select('*')
      .single()
    if (data) {
      setHistory(prev => [data as Register, ...prev])
      setRegister(null)
      setMovements([])
    }
    setShowClose(false)
  }

  async function handleMovement(type: 'ingreso' | 'extraccion', amount: number, reason: string) {
    if (!register) return
    const { data } = await supabase
      .from('cash_movements')
      .insert({ business_id: businessId, register_id: register.id, profile_id: profileId, type, amount, reason: reason || null })
      .select('*')
      .single()
    if (data) setMovements(prev => [data as Movement, ...prev])
    setShowMovForm(false)
  }

  // ── Render ────────────────────────────────────────────────────
  return (
    <div className="space-y-5 animate-fade-in">

      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-xl lg:text-2xl font-bold text-gray-900 tracking-tight">Caja</h1>
          <p className="text-sm text-gray-400 mt-0.5">
            {register ? 'Sesión en curso' : 'Sin sesión activa'}
          </p>
        </div>
        {/* Tabs */}
        <div className="flex rounded-xl border border-gray-200 overflow-hidden bg-white text-xs font-semibold">
          {(['caja', 'historial'] as const).map(t => (
            <button key={t} onClick={() => setTab(t)}
              className={cn('px-4 py-3 transition-colors capitalize min-h-[44px]',
                tab === t ? 'text-white' : 'text-gray-500 hover:text-gray-700'
              )}
              style={tab === t ? { background: color } : {}}>
              {t === 'caja' ? 'Caja' : 'Historial'}
            </button>
          ))}
        </div>
      </div>

      {tab === 'caja' ? (
        register ? (
          <OpenRegisterView
            register={register}
            movements={movements}
            expected={expected}
            todaySales={todaySales}
            ingresos={ingresos}
            extracciones={extracciones}
            currency={currency}
            color={color}
            tick={tick}
            onAddMovement={() => setShowMovForm(true)}
            onClose={() => setShowClose(true)}
          />
        ) : (
          <ClosedView color={color} onOpen={() => setShowOpen(true)} />
        )
      ) : (
        <HistoryView history={history} currency={currency} />
      )}

      {/* Modals */}
      {showOpen    && <OpenModal    color={color} currency={currency} onConfirm={handleOpen}    onClose={() => setShowOpen(false)} />}
      {showClose   && <CloseModal   color={color} currency={currency} expected={expected}       onConfirm={handleClose}   onClose={() => setShowClose(false)} />}
      {showMovForm && <MovementModal color={color} currency={currency} onConfirm={handleMovement} onClose={() => setShowMovForm(false)} />}
    </div>
  )
}

// ── Closed state ───────────────────────────────────────────────
function ClosedView({ color, onOpen }: { color: string; onOpen: () => void }) {
  return (
    <div className="rounded-2xl border-2 border-dashed border-gray-200 py-20 text-center">
      <div className="h-14 w-14 rounded-2xl flex items-center justify-center mx-auto mb-4"
        style={{ background: color + '15' }}>
        <Wallet size={26} style={{ color }} />
      </div>
      <p className="text-sm font-semibold text-gray-700 mb-1">No hay una caja abierta</p>
      <p className="text-xs text-gray-400 mb-6">Abrí la caja para comenzar a registrar movimientos</p>
      <button onClick={onOpen}
        className="inline-flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-bold text-white"
        style={{ background: color }}>
        <Plus size={14} /> Abrir caja
      </button>
    </div>
  )
}

// ── Open register view ─────────────────────────────────────────
function OpenRegisterView({
  register, movements, expected, todaySales, ingresos, extracciones,
  currency, color, tick, onAddMovement, onClose,
}: {
  register: Register; movements: Movement[]; expected: number
  todaySales: number; ingresos: number; extracciones: number
  currency: string; color: string; tick: number
  onAddMovement: () => void; onClose: () => void
}) {
  return (
    <div className="space-y-4">
      {/* Status banner */}
      <div className="rounded-2xl p-4 flex items-center justify-between gap-3"
        style={{ background: color + '10', border: `1px solid ${color}30` }}>
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-xl flex items-center justify-center"
            style={{ background: color }}>
            <Wallet size={16} className="text-white" />
          </div>
          <div>
            <p className="text-sm font-bold text-gray-900">Caja abierta</p>
            <p className="text-xs text-gray-500 flex items-center gap-1 mt-0.5">
              <Clock size={10} /> {elapsed(register.opened_at)} · Apertura {formatPrice(register.opening_amount, currency)}
            </p>
          </div>
        </div>
        <button onClick={onClose}
          className="flex items-center gap-1.5 rounded-xl px-4 py-3 text-xs font-bold bg-white border border-gray-200 text-gray-700 hover:border-red-200 hover:text-red-600 transition-colors min-h-[44px]">
          <Lock size={12} /> Cerrar caja
        </button>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KPICard label="Ventas del día" value={formatPrice(todaySales, currency)} icon={<TrendingUp size={16} className="text-emerald-500" />} />
        <KPICard label="Ingresos extras" value={formatPrice(ingresos, currency)} icon={<ArrowUpCircle size={16} className="text-blue-500" />} />
        <KPICard label="Extracciones" value={formatPrice(extracciones, currency)} icon={<ArrowDownCircle size={16} className="text-orange-500" />} />
        <KPICard label="Saldo esperado" value={formatPrice(expected, currency)} icon={<DollarSign size={16} style={{ color }} />} highlight color={color} />
      </div>

      {/* Movements */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm">
        <div className="flex items-center justify-between px-4 pt-4 pb-3 border-b border-gray-50">
          <p className="text-sm font-bold text-gray-900">Movimientos</p>
          <button onClick={onAddMovement}
            className="flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-semibold text-white"
            style={{ background: color }}>
            <Plus size={12} /> Agregar
          </button>
        </div>
        {movements.length === 0 ? (
          <div className="py-10 text-center text-xs text-gray-400">Sin movimientos registrados</div>
        ) : (
          <div className="divide-y divide-gray-50">
            {movements.map(m => (
              <div key={m.id} className="flex items-center justify-between px-4 py-3">
                <div className="flex items-center gap-3">
                  <div className={cn('h-7 w-7 rounded-lg flex items-center justify-center',
                    m.type === 'ingreso' ? 'bg-emerald-50' : 'bg-orange-50')}>
                    {m.type === 'ingreso'
                      ? <ArrowUpCircle size={14} className="text-emerald-500" />
                      : <ArrowDownCircle size={14} className="text-orange-500" />}
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-gray-800 capitalize">{m.type}</p>
                    {m.reason && <p className="text-xs text-gray-400">{m.reason}</p>}
                  </div>
                </div>
                <div className="text-right">
                  <p className={cn('text-sm font-bold', m.type === 'ingreso' ? 'text-emerald-600' : 'text-orange-600')}>
                    {m.type === 'ingreso' ? '+' : '-'}{formatPrice(m.amount, currency)}
                  </p>
                  <p className="text-[10px] text-gray-400">{formatDate(m.created_at)}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

// ── KPI card ───────────────────────────────────────────────────
function KPICard({ label, value, icon, highlight, color }: {
  label: string; value: string; icon: React.ReactNode; highlight?: boolean; color?: string
}) {
  return (
    <div className={cn('rounded-2xl p-4 border', highlight ? 'border-transparent' : 'bg-white border-gray-100 shadow-sm')}
      style={highlight && color ? { background: color + '10', border: `1px solid ${color}30` } : {}}>
      <div className="flex items-center justify-between mb-2">
        <p className="text-xs text-gray-500 font-medium">{label}</p>
        {icon}
      </div>
      <p className={cn('text-lg font-bold', highlight ? '' : 'text-gray-900')}
        style={highlight && color ? { color } : {}}>
        {value}
      </p>
    </div>
  )
}

// ── History view ───────────────────────────────────────────────
function HistoryView({ history, currency }: { history: Register[]; currency: string }) {
  if (history.length === 0) return (
    <div className="rounded-2xl border-2 border-dashed border-gray-200 py-16 text-center">
      <History size={28} className="mx-auto text-gray-200 mb-3" />
      <p className="text-sm text-gray-400">Sin sesiones cerradas todavía</p>
    </div>
  )

  return (
    <div className="space-y-2">
      {history.map(r => (
        <div key={r.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm px-4 py-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-gray-900">{formatDate(r.opened_at)}</p>
              {r.closed_at && (
                <p className="text-xs text-gray-400 mt-0.5">Cerrada {formatDate(r.closed_at)}</p>
              )}
              {r.notes && <p className="text-xs text-gray-500 mt-1 italic">"{r.notes}"</p>}
            </div>
            <div className="text-right shrink-0">
              <p className="text-sm font-bold text-gray-900">{formatPrice(r.closing_amount ?? 0, currency)}</p>
              <p className="text-[11px] text-gray-400">Contado</p>
              {r.difference !== null && (
                <p className={cn('text-xs font-semibold mt-0.5', diffColor(r.difference))}>
                  {r.difference > 0 ? '+' : ''}{formatPrice(r.difference, currency)}
                </p>
              )}
            </div>
          </div>
          <div className="mt-3 pt-2.5 border-t border-gray-50 grid grid-cols-3 gap-2 text-center">
            <div>
              <p className="text-[10px] text-gray-400">Apertura</p>
              <p className="text-xs font-semibold text-gray-700">{formatPrice(r.opening_amount, currency)}</p>
            </div>
            <div>
              <p className="text-[10px] text-gray-400">Esperado</p>
              <p className="text-xs font-semibold text-gray-700">{formatPrice(r.expected_amount ?? 0, currency)}</p>
            </div>
            <div>
              <p className="text-[10px] text-gray-400">Diferencia</p>
              <p className={cn('text-xs font-semibold', diffColor(r.difference))}>
                {r.difference !== null ? (r.difference > 0 ? '+' : '') + formatPrice(r.difference, currency) : '—'}
              </p>
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}

// ── Modal base ─────────────────────────────────────────────────
function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/30 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-5 space-y-4">
        <div className="flex items-center justify-between">
          <p className="text-sm font-bold text-gray-900">{title}</p>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
            <X size={16} />
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}

// ── Open modal ─────────────────────────────────────────────────
function OpenModal({ color, currency, onConfirm, onClose }: {
  color: string; currency: string
  onConfirm: (amount: number) => void; onClose: () => void
}) {
  const [amount, setAmount] = useState('0')
  const [saving, setSaving] = useState(false)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    await onConfirm(parseFloat(amount.replace(',', '.')) || 0)
    setSaving(false)
  }

  return (
    <Modal title="Abrir caja" onClose={onClose}>
      <form onSubmit={submit} className="space-y-4">
        <div>
          <label className="block text-xs font-semibold text-gray-600 mb-1.5">Monto de apertura ({currency})</label>
          <input type="number" min="0" step="0.01" value={amount} onChange={e => setAmount(e.target.value)}
            className="w-full rounded-xl border border-gray-200 px-3.5 py-2.5 text-sm outline-none focus:ring-2 focus:border-transparent text-right font-bold text-lg"
            style={{ '--tw-ring-color': color } as React.CSSProperties}
            autoFocus />
          <p className="text-[11px] text-gray-400 mt-1">Ingresá el dinero físico con el que abrís la caja</p>
        </div>
        <div className="flex gap-2">
          <button type="submit" disabled={saving}
            className="flex-1 flex items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-bold text-white disabled:opacity-50"
            style={{ background: color }}>
            {saving ? <div className="h-4 w-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                    : <Check size={14} />}
            Abrir caja
          </button>
          <button type="button" onClick={onClose}
            className="rounded-xl px-4 py-2.5 text-sm font-semibold bg-gray-100 text-gray-600">
            Cancelar
          </button>
        </div>
      </form>
    </Modal>
  )
}

// ── Close modal (arqueo) ───────────────────────────────────────
function CloseModal({ color, currency, expected, onConfirm, onClose }: {
  color: string; currency: string; expected: number
  onConfirm: (amount: number, notes: string) => void; onClose: () => void
}) {
  const [counted, setCounted] = useState('')
  const [notes,   setNotes]   = useState('')
  const [saving,  setSaving]  = useState(false)

  const countedNum = parseFloat(counted.replace(',', '.')) || 0
  const diff       = counted ? countedNum - expected : null

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!counted) return
    setSaving(true)
    await onConfirm(countedNum, notes)
    setSaving(false)
  }

  return (
    <Modal title="Cierre de caja" onClose={onClose}>
      <form onSubmit={submit} className="space-y-4">
        {/* Expected */}
        <div className="rounded-xl p-3 bg-gray-50 space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="text-gray-500">Saldo esperado</span>
            <span className="font-bold text-gray-900">{formatPrice(expected, currency)}</span>
          </div>
        </div>

        {/* Counted */}
        <div>
          <label className="block text-xs font-semibold text-gray-600 mb-1.5">Dinero contado ({currency})</label>
          <input type="number" min="0" step="0.01" value={counted} onChange={e => setCounted(e.target.value)}
            placeholder="0"
            className="w-full rounded-xl border border-gray-200 px-3.5 py-2.5 text-sm outline-none focus:ring-2 focus:border-transparent text-right font-bold text-lg"
            style={{ '--tw-ring-color': color } as React.CSSProperties}
            autoFocus required />
        </div>

        {/* Difference */}
        {diff !== null && (
          <div className={cn('rounded-xl p-3 flex items-center gap-2 text-sm font-bold',
            Math.abs(diff) < 1  ? 'bg-emerald-50 text-emerald-700' :
            diff > 0            ? 'bg-blue-50 text-blue-700'       : 'bg-red-50 text-red-600')}>
            {Math.abs(diff) < 1
              ? <Check size={14} />
              : <AlertTriangle size={14} />}
            {Math.abs(diff) < 1
              ? 'Sin diferencia — caja cuadrada'
              : `Diferencia: ${diff > 0 ? '+' : ''}${formatPrice(diff, currency)}`}
          </div>
        )}

        {/* Notes */}
        <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2}
          placeholder="Notas del cierre (opcional)"
          className="w-full rounded-xl border border-gray-200 px-3.5 py-2.5 text-xs outline-none focus:ring-2 focus:border-transparent resize-none placeholder-gray-400"
          style={{ '--tw-ring-color': color } as React.CSSProperties} />

        <div className="flex gap-2">
          <button type="submit" disabled={saving || !counted}
            className="flex-1 flex items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-bold text-white disabled:opacity-50"
            style={{ background: color }}>
            {saving ? <div className="h-4 w-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                    : <Lock size={14} />}
            Cerrar caja
          </button>
          <button type="button" onClick={onClose}
            className="rounded-xl px-4 py-2.5 text-sm font-semibold bg-gray-100 text-gray-600">
            Cancelar
          </button>
        </div>
      </form>
    </Modal>
  )
}

// ── Movement modal ─────────────────────────────────────────────
function MovementModal({ color, currency, onConfirm, onClose }: {
  color: string; currency: string
  onConfirm: (type: 'ingreso' | 'extraccion', amount: number, reason: string) => void
  onClose: () => void
}) {
  const [type,   setType]   = useState<'ingreso' | 'extraccion'>('ingreso')
  const [amount, setAmount] = useState('')
  const [reason, setReason] = useState('')
  const [saving, setSaving] = useState(false)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    const n = parseFloat(amount.replace(',', '.'))
    if (!n || n <= 0) return
    setSaving(true)
    await onConfirm(type, n, reason)
    setSaving(false)
  }

  return (
    <Modal title="Registrar movimiento" onClose={onClose}>
      <form onSubmit={submit} className="space-y-4">
        {/* Type toggle */}
        <div className="grid grid-cols-2 gap-2">
          {(['ingreso', 'extraccion'] as const).map(t => (
            <button key={t} type="button" onClick={() => setType(t)}
              className={cn('rounded-xl py-2.5 text-xs font-bold border transition-all capitalize flex items-center justify-center gap-1.5',
                type === t ? 'text-white border-transparent' : 'bg-white border-gray-200 text-gray-600'
              )}
              style={type === t ? { background: t === 'ingreso' ? '#10B981' : '#F97316' } : {}}>
              {t === 'ingreso'
                ? <ArrowUpCircle size={13} />
                : <ArrowDownCircle size={13} />}
              {t === 'ingreso' ? 'Ingreso' : 'Extracción'}
            </button>
          ))}
        </div>

        <div>
          <label className="block text-xs font-semibold text-gray-600 mb-1.5">Monto ({currency})</label>
          <input type="number" min="0.01" step="0.01" value={amount} onChange={e => setAmount(e.target.value)}
            placeholder="0"
            className="w-full rounded-xl border border-gray-200 px-3.5 py-2.5 text-sm outline-none focus:ring-2 focus:border-transparent text-right font-bold text-lg"
            style={{ '--tw-ring-color': color } as React.CSSProperties}
            autoFocus required />
        </div>

        <div>
          <label className="block text-xs font-semibold text-gray-600 mb-1.5">Motivo</label>
          <input value={reason} onChange={e => setReason(e.target.value)}
            placeholder={type === 'ingreso' ? 'ej: Venta en efectivo' : 'ej: Pago a proveedor'}
            className="w-full rounded-xl border border-gray-200 px-3.5 py-2.5 text-sm outline-none focus:ring-2 focus:border-transparent"
            style={{ '--tw-ring-color': color } as React.CSSProperties} />
        </div>

        <div className="flex gap-2">
          <button type="submit" disabled={saving || !amount}
            className="flex-1 flex items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-bold text-white disabled:opacity-50"
            style={{ background: type === 'ingreso' ? '#10B981' : '#F97316' }}>
            {saving ? <div className="h-4 w-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                    : <Check size={14} />}
            Guardar
          </button>
          <button type="button" onClick={onClose}
            className="rounded-xl px-4 py-2.5 text-sm font-semibold bg-gray-100 text-gray-600">
            Cancelar
          </button>
        </div>
      </form>
    </Modal>
  )
}
