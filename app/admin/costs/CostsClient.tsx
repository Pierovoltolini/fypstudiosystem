// app/admin/costs/CostsClient.tsx
'use client'
import { useState, useEffect, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Plus, Trash2, Loader2, ChevronDown, AlertCircle } from 'lucide-react'
import { useVertical } from '@/lib/vertical-context'

type CostEntry = {
  id: string
  business_id: string
  name: string
  type: string
  amount: number
  date: string
  notes?: string
  created_at?: string
}

type Order = { total: number }

const F = 'w-full bg-white border border-gray-200 rounded-xl px-4 py-3 text-sm text-gray-900 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 placeholder:text-gray-300 transition-all'
const L = 'block text-[10px] tracking-[0.15em] uppercase font-bold text-blue-600 mb-1.5'

function SectionTitle({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-3 mb-6">
      <div className="w-1 h-5 rounded-full bg-gradient-to-b from-blue-500 to-sky-400 shrink-0" />
      <span className="text-[11px] tracking-[0.2em] uppercase font-black text-blue-700 shrink-0">{label}</span>
      <div className="flex-1 h-px bg-gradient-to-r from-blue-200 to-transparent" />
    </div>
  )
}

export default function CostsClient({ orders, cogs }: {
  orders: Order[]
  cogs: number
}) {
  const { businessId, currency } = useVertical()
  const supabase = createClient()

  const [costs,     setCosts]     = useState<CostEntry[]>([])
  const [loading,   setLoading]   = useState(true)
  const [saving,    setSaving]    = useState(false)
  const [error,     setError]     = useState<string | null>(null)
  const [filterType, setFilterType] = useState('all')

  // Form
  const [name,   setName]   = useState('')
  const [type,   setType]   = useState('')
  const [amount, setAmount] = useState('')
  const [date,   setDate]   = useState(new Date().toISOString().slice(0, 10))
  const [notes,  setNotes]  = useState('')

  useEffect(() => {
    async function load() {
      setLoading(true)
      const { data, error: supaErr } = await supabase
        .from('business_costs')
        .select('*')
        .eq('business_id', businessId)
        .order('date', { ascending: false })

      if (!supaErr && data) {
        setCosts(data as CostEntry[])
      } else {
        const saved = typeof window !== 'undefined'
          ? localStorage.getItem(`fyp_costs_${businessId}`)
          : null
        if (saved) {
          try { setCosts(JSON.parse(saved)) } catch { /* noop */ }
        }
      }
      setLoading(false)
    }
    load()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [businessId])

  useEffect(() => {
    if (!loading && typeof window !== 'undefined') {
      localStorage.setItem(`fyp_costs_${businessId}`, JSON.stringify(costs))
    }
  }, [costs, businessId, loading])

  async function handleAdd() {
    const parsed = parseFloat(amount)
    if (!name.trim() || isNaN(parsed) || parsed <= 0) return
    setSaving(true); setError(null)
    const entry = {
      business_id: businessId,
      name:   name.trim(),
      type:   type.trim() || 'General',
      amount: parsed,
      date,
      notes:  notes.trim() || null,
    }
    const { data: inserted, error: insErr } = await supabase
      .from('business_costs').insert(entry).select().single()

    if (!insErr && inserted) {
      setCosts(prev => [inserted, ...prev])
    } else {
      setCosts(prev => [{ ...entry, id: crypto.randomUUID(), notes: entry.notes ?? undefined }, ...prev])
      if (insErr) setError('Guardado localmente. Conectá la tabla business_costs en Supabase para persistencia completa.')
    }
    setName(''); setType(''); setAmount(''); setNotes('')
    setSaving(false)
  }

  async function handleDelete(id: string) {
    await supabase.from('business_costs').delete().eq('id', id)
    setCosts(prev => prev.filter(c => c.id !== id))
  }

  const existingTypes = useMemo(
    () => Array.from(new Set(costs.map(c => c.type))).filter(Boolean).sort(),
    [costs]
  )

  const revenue     = orders.reduce((s, o) => s + (o.total ?? 0), 0)
  const totalCosts  = costs.reduce((s, c) => s + (c.amount ?? 0), 0)
  const result      = revenue - cogs - totalCosts
  const grossMargin = revenue > 0 ? ((revenue - cogs) / revenue) * 100 : 0
  const margin      = revenue > 0 ? (result / revenue) * 100 : 0

  const filtered = filterType === 'all' ? costs : costs.filter(c => c.type === filterType)

  const byType = useMemo(() => {
    const g: Record<string, number> = {}
    costs.forEach(c => { g[c.type] = (g[c.type] ?? 0) + c.amount })
    return Object.entries(g).sort((a, b) => b[1] - a[1])
  }, [costs])

  const fmt  = (n: number) => n.toLocaleString('es-AR', { minimumFractionDigits: 0 })
  const fmtD = (d: string) => new Date(d + 'T12:00:00').toLocaleDateString('es-AR', { day: '2-digit', month: 'short', year: '2-digit' })

  return (
    <div className="animate-fade-in max-w-3xl space-y-6 pb-10">

      {/* ── HEADER ── */}
      <div className="pb-7 border-b border-gray-200 animate-fade-up">
        <p className="text-[10px] tracking-[0.3em] uppercase text-blue-500 font-bold mb-3">
          FYP · STUDIO
        </p>
        <h1 className="text-3xl lg:text-4xl font-black text-gray-900 tracking-tight leading-tight">
          Llevá todos los costos<br />
          <span className="bg-gradient-to-r from-blue-600 to-sky-500 bg-clip-text text-transparent">
            de tu comercio
          </span>
        </h1>
        <p className="text-sm text-gray-400 font-light mt-3 leading-relaxed">
          Maximizá tus beneficios con nuestros controles de costos y rentabilidad.
        </p>
      </div>

      {/* ── MÉTRICAS ── */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 animate-fade-up-1">
        <div className="bg-blue-50 border border-blue-100 rounded-2xl p-4">
          <p className="text-[10px] tracking-[0.12em] uppercase font-bold text-blue-400 mb-2">Ingresos del mes</p>
          <p className="text-lg font-black text-blue-700 leading-tight">
            <span className="text-xs font-bold">{currency} </span>{fmt(revenue)}
          </p>
          <p className="text-[11px] text-blue-400 mt-0.5">{orders.length} pedidos</p>
        </div>

        <div className="bg-amber-50 border border-amber-100 rounded-2xl p-4">
          <p className="text-[10px] tracking-[0.12em] uppercase font-bold text-amber-500 mb-2">CMV (costo ventas)</p>
          <p className="text-lg font-black text-amber-700 leading-tight">
            <span className="text-xs font-bold">{currency} </span>{fmt(cogs)}
          </p>
          <p className="text-[11px] text-amber-400 mt-0.5">
            {cogs === 0 ? 'sin datos de costo' : `margen bruto ${grossMargin.toFixed(0)}%`}
          </p>
        </div>

        <div className="bg-red-50 border border-red-100 rounded-2xl p-4">
          <p className="text-[10px] tracking-[0.12em] uppercase font-bold text-red-400 mb-2">Costos fijos</p>
          <p className="text-lg font-black text-red-600 leading-tight">
            <span className="text-xs font-bold">{currency} </span>{fmt(totalCosts)}
          </p>
          <p className="text-[11px] text-red-400 mt-0.5">{costs.length} registros</p>
        </div>

        <div className={`rounded-2xl p-4 border ${result >= 0 ? 'bg-green-50 border-green-100' : 'bg-red-50 border-red-100'}`}>
          <p className="text-[10px] tracking-[0.12em] uppercase font-bold text-gray-400 mb-2">Resultado neto</p>
          <p className={`text-lg font-black leading-tight ${result >= 0 ? 'text-green-700' : 'text-red-600'}`}>
            <span className="text-xs font-bold">{currency} </span>{fmt(result)}
          </p>
          <p className="text-[11px] text-gray-400 mt-0.5">
            {result >= 0 ? 'positivo' : 'negativo'} este mes
          </p>
        </div>

        <div className="bg-gray-50 border border-gray-100 rounded-2xl p-4">
          <p className="text-[10px] tracking-[0.12em] uppercase font-bold text-gray-400 mb-2">Margen neto</p>
          <p className={`text-lg font-black leading-tight ${margin >= 30 ? 'text-green-700' : margin >= 15 ? 'text-amber-600' : 'text-red-600'}`}>
            {revenue === 0 ? '—' : `${margin.toFixed(1)}%`}
          </p>
          <p className="text-[11px] text-gray-400 mt-0.5">
            {revenue === 0 ? 'sin ventas' : margin >= 30 ? 'Excelente' : margin >= 15 ? 'Aceptable' : 'Por mejorar'}
          </p>
        </div>
      </div>

      {/* ── FORMULARIO ── */}
      <div className="bg-gradient-to-br from-blue-50/80 to-sky-50/50 rounded-2xl p-6 border border-blue-100/80 animate-fade-up-2">
        <SectionTitle label="Registrar costo" />

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="sm:col-span-2">
            <label className={L}>Nombre del costo <span className="text-red-400">*</span></label>
            <input
              type="text" value={name}
              onChange={e => setName(e.target.value)}
              placeholder="Ej: Harina 25kg Molino Sur, Gas mayo, Sueldo Juan"
              className={F}
              onKeyDown={e => e.key === 'Enter' && handleAdd()}
            />
          </div>

          <div>
            <label className={L}>Tipo de costo <span className="text-red-400">*</span></label>
            <input
              type="text" value={type}
              onChange={e => setType(e.target.value)}
              placeholder="Mercadería, Insumos, Personal, Servicios..."
              className={F}
              list="cost-types-list"
            />
            <datalist id="cost-types-list">
              {existingTypes.map(t => <option key={t} value={t} />)}
              {['Mercadería', 'Insumos', 'Personal', 'Servicios', 'Alquiler', 'Logística', 'Marketing', 'Impuestos', 'Equipamiento']
                .filter(t => !existingTypes.includes(t))
                .map(t => <option key={t} value={t} />)}
            </datalist>
          </div>

          <div>
            <label className={L}>Monto ({currency}) <span className="text-red-400">*</span></label>
            <input
              type="number" value={amount}
              onChange={e => setAmount(e.target.value)}
              placeholder="0"
              min="0" step="any"
              className={F}
              onKeyDown={e => e.key === 'Enter' && handleAdd()}
            />
          </div>

          <div>
            <label className={L}>Fecha</label>
            <input
              type="date" value={date}
              onChange={e => setDate(e.target.value)}
              className={F}
            />
          </div>

          <div>
            <label className={L}>Referencia / Notas</label>
            <input
              type="text" value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="Factura #123, proveedor, detalle..."
              className={F}
            />
          </div>
        </div>

        <div className="mt-5 flex items-center gap-4">
          <button
            onClick={handleAdd}
            disabled={saving || !name.trim() || !amount || parseFloat(amount) <= 0}
            className="flex items-center gap-2.5 bg-gradient-to-r from-blue-600 to-sky-500
                       text-white px-8 py-3.5 rounded-xl
                       text-[11px] font-black tracking-[0.15em] uppercase
                       shadow-lg shadow-blue-200/70 hover:shadow-xl hover:from-blue-700 hover:to-sky-600
                       transition-all active:scale-[0.98] disabled:opacity-40"
          >
            {saving ? <Loader2 size={13} className="animate-spin" /> : <Plus size={13} />}
            {saving ? 'Guardando...' : 'Registrar costo'}
          </button>
        </div>

        {error && (
          <div className="mt-4 flex items-start gap-2.5 border border-amber-200 bg-amber-50 rounded-xl px-4 py-3">
            <AlertCircle size={13} className="text-amber-500 shrink-0 mt-0.5" />
            <p className="text-xs text-amber-700">{error}</p>
          </div>
        )}
      </div>

      {/* ── TABLA DE COSTOS ── */}
      <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden animate-fade-up-3">

        {/* Barra superior */}
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <div className="w-1 h-5 rounded-full bg-gradient-to-b from-blue-500 to-sky-400 shrink-0" />
            <span className="text-[11px] tracking-[0.2em] uppercase font-black text-blue-700">
              Registro de costos
            </span>
            {costs.length > 0 && (
              <span className="text-[10px] bg-blue-100 text-blue-600 font-black px-2 py-0.5 rounded-full">
                {costs.length}
              </span>
            )}
          </div>

          {existingTypes.length > 0 && (
            <div className="relative">
              <select
                value={filterType}
                onChange={e => setFilterType(e.target.value)}
                className="appearance-none bg-gray-50 border border-gray-200 rounded-xl pl-3 pr-8 py-2
                           text-xs font-bold text-gray-600 outline-none focus:border-blue-400 cursor-pointer"
              >
                <option value="all">Todos los tipos</option>
                {existingTypes.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
              <ChevronDown size={11} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
            </div>
          )}
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-16 gap-3 text-gray-400">
            <Loader2 size={16} className="animate-spin" />
            <span className="text-sm">Cargando registros...</span>
          </div>

        ) : filtered.length === 0 ? (
          <div className="text-center py-16">
            <p className="text-sm font-semibold text-gray-500">
              {filterType !== 'all' ? `Sin costos del tipo "${filterType}"` : 'Sin costos registrados'}
            </p>
            <p className="text-xs text-gray-400 mt-1">
              {filterType !== 'all'
                ? 'Cambiá el filtro o agregá un costo de este tipo.'
                : 'Usá el formulario de arriba para registrar tus primeros gastos.'}
            </p>
          </div>

        ) : (
          <>
            {/* Tabla desktop */}
            <div className="hidden sm:block overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50/60">
                    <th className="text-left px-6 py-3 text-[10px] tracking-[0.15em] uppercase font-black text-gray-400 w-[35%]">Nombre</th>
                    <th className="text-left px-4 py-3 text-[10px] tracking-[0.15em] uppercase font-black text-gray-400">Tipo</th>
                    <th className="text-left px-4 py-3 text-[10px] tracking-[0.15em] uppercase font-black text-gray-400">Referencia</th>
                    <th className="text-left px-4 py-3 text-[10px] tracking-[0.15em] uppercase font-black text-gray-400">Fecha</th>
                    <th className="text-right px-4 py-3 text-[10px] tracking-[0.15em] uppercase font-black text-gray-400">Monto</th>
                    <th className="w-10 px-2" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {filtered.map(c => (
                    <tr key={c.id} className="hover:bg-blue-50/20 transition-colors group">
                      <td className="px-6 py-3.5">
                        <p className="text-sm font-semibold text-gray-900">{c.name}</p>
                      </td>
                      <td className="px-4 py-3.5">
                        <span className="inline-block text-[10px] font-black tracking-[0.06em] uppercase
                                         text-blue-600 bg-blue-50 border border-blue-100 px-2.5 py-1 rounded-lg">
                          {c.type}
                        </span>
                      </td>
                      <td className="px-4 py-3.5 text-xs text-gray-400 max-w-[140px] truncate">
                        {c.notes || <span className="text-gray-200">—</span>}
                      </td>
                      <td className="px-4 py-3.5 text-xs text-gray-500 font-medium whitespace-nowrap">
                        {fmtD(c.date)}
                      </td>
                      <td className="px-4 py-3.5 text-right">
                        <span className="text-sm font-black text-gray-900">{currency} {fmt(c.amount)}</span>
                      </td>
                      <td className="px-2 py-3.5">
                        <button
                          onClick={() => handleDelete(c.id)}
                          className="opacity-0 group-hover:opacity-100 p-1.5 hover:bg-red-50 rounded-lg
                                     transition-all text-gray-300 hover:text-red-500"
                        >
                          <Trash2 size={13} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Lista mobile */}
            <div className="sm:hidden divide-y divide-gray-100">
              {filtered.map(c => (
                <div key={c.id} className="px-5 py-4 flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-gray-900 truncate">{c.name}</p>
                    <div className="flex items-center gap-2 mt-1 flex-wrap">
                      <span className="text-[10px] font-black uppercase tracking-wide text-blue-600 bg-blue-50 border border-blue-100 px-2 py-0.5 rounded-lg">
                        {c.type}
                      </span>
                      <span className="text-[11px] text-gray-400">{fmtD(c.date)}</span>
                    </div>
                    {c.notes && <p className="text-xs text-gray-400 mt-0.5 truncate">{c.notes}</p>}
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-sm font-black text-gray-900">{currency} {fmt(c.amount)}</p>
                    <button
                      onClick={() => handleDelete(c.id)}
                      className="mt-1.5 p-1 text-gray-300 hover:text-red-500 transition-colors"
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {/* Footer: totales por tipo */}
            <div className="border-t border-gray-200 bg-gray-50/60 px-6 py-4">
              <div className="flex items-start justify-between gap-4 flex-wrap">
                {byType.length > 0 && (
                  <div className="flex flex-wrap gap-x-6 gap-y-1.5">
                    {byType.map(([t, total]) => (
                      <div key={t} className="text-xs">
                        <span className="text-gray-400 font-medium">{t}</span>
                        <span className="mx-1.5 text-gray-200">·</span>
                        <span className="font-black text-gray-700">{currency} {fmt(total)}</span>
                      </div>
                    ))}
                  </div>
                )}
                <div className="text-right ml-auto shrink-0">
                  <p className="text-[10px] uppercase font-bold text-gray-400 tracking-wide">Total registrado</p>
                  <p className="text-lg font-black text-gray-900">{currency} {fmt(totalCosts)}</p>
                </div>
              </div>
            </div>
          </>
        )}
      </div>

    </div>
  )
}
