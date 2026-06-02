// app/admin/superadmin/SuperadminClient.tsx
'use client'
import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import {
  ShieldAlert, Search, TrendingUp, Building2, ShoppingBag, DollarSign,
  Check, X, ChevronDown, Loader2, Calendar, FileText, History, Save,
} from 'lucide-react'
import { cn, formatPrice } from '@/lib/utils'
import type { Business, Plan, SubscriptionStatus } from '@/types'
import { getVertical } from '@/lib/verticals'

type BizRow = Pick<Business, 'id' | 'name' | 'slug' | 'plan' | 'active' | 'subscription_status' | 'vertical_type' | 'created_at' | 'primary_color'>

interface SubRow {
  business_id:        string
  plan:               string
  status:             string
  billing_cycle:      string
  current_period_end: string | null
  internal_note:      string | null
  updated_at:         string
}

interface HistoryEvent {
  event_type: string
  payload:    Record<string, unknown> | null
  created_at: string
}

interface Analytics {
  mrr:         number
  activeBiz30d:number
  newThisWeek: number
  newLastWeek: number
  churn30d:    number
  top5AI:      { name: string; count: number }[]
}

interface Props {
  businesses:  BizRow[]
  ordersByBiz: Record<string, { count: number; revenue: number }>
  subsByBiz:   Record<string, SubRow>
  historyByBiz:Record<string, HistoryEvent[]>
  stats: {
    totalBusinesses: number
    totalOrders30d:  number
    totalRevenue30d: number
    planCounts:      { basic: number; pro: number; premium: number }
  }
  analytics: Analytics
}

const PLAN_CONF: Record<Plan, { label: string; bg: string; text: string }> = {
  basic:   { label: 'Basic',   bg: '#F3F4F6', text: '#374151' },
  pro:     { label: 'Pro',     bg: '#EFF6FF', text: '#1D4ED8' },
  premium: { label: 'Premium', bg: '#FDF4FF', text: '#7C3AED' },
}

const STATUS_CONF: Record<SubscriptionStatus, { label: string; dot: string }> = {
  trial:    { label: 'Trial',     dot: '#3B82F6' },
  active:   { label: 'Activo',    dot: '#10B981' },
  past_due: { label: 'Vencido',   dot: '#F59E0B' },
  canceled: { label: 'Cancelado', dot: '#6B7280' },
  suspended:{ label: 'Suspendido',dot: '#EF4444' },
}

const PLANS: Plan[] = ['basic', 'pro', 'premium']
const STATUSES: SubscriptionStatus[] = ['trial', 'active', 'past_due', 'canceled', 'suspended']

// ── Draft state por negocio ────────────────────────────────────
interface Draft {
  plan:           Plan
  status:         SubscriptionStatus
  periodEnd:      string
  note:           string
}

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString('es-UY', { day: '2-digit', month: 'short', year: 'numeric' })
}

// ── Pie chart SVG simple ─────────────────────────────────────
function PlanPieChart({ basic, pro, premium }: { basic: number; pro: number; premium: number }) {
  const total = basic + pro + premium
  if (total === 0) return <p className="text-xs text-gray-400 text-center py-4">Sin datos</p>

  const segments = [
    { label: 'Basic',   value: basic,   color: '#6B7280' },
    { label: 'Pro',     value: pro,     color: '#1D4ED8' },
    { label: 'Premium', value: premium, color: '#7C3AED' },
  ]

  const size = 120
  const cx = size / 2, cy = size / 2, r = 44
  let startAngle = -Math.PI / 2

  const paths = segments.map(seg => {
    const angle = (seg.value / total) * 2 * Math.PI
    const endAngle = startAngle + angle
    const x1 = cx + r * Math.cos(startAngle)
    const y1 = cy + r * Math.sin(startAngle)
    const x2 = cx + r * Math.cos(endAngle)
    const y2 = cy + r * Math.sin(endAngle)
    const largeArc = angle > Math.PI ? 1 : 0
    const d = `M ${cx} ${cy} L ${x1} ${y1} A ${r} ${r} 0 ${largeArc} 1 ${x2} ${y2} Z`
    const path = { d, color: seg.color, label: seg.label, value: seg.value }
    startAngle = endAngle
    return path
  })

  return (
    <div className="flex items-center gap-5">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        {paths.filter(p => p.value > 0).map(p => (
          <path key={p.label} d={p.d} fill={p.color} opacity={0.9} />
        ))}
        <circle cx={cx} cy={cy} r={22} fill="white" />
        <text x={cx} y={cy + 4} textAnchor="middle" fontSize="11" fontWeight="700" fill="#111827">{total}</text>
      </svg>
      <div className="space-y-1.5">
        {segments.map(s => (
          <div key={s.label} className="flex items-center gap-2">
            <div className="h-2.5 w-2.5 rounded-full shrink-0" style={{ background: s.color }} />
            <span className="text-xs text-gray-600">{s.label}</span>
            <span className="text-xs font-bold text-gray-900 ml-auto pl-3">{s.value}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

export default function SuperadminClient({
  businesses: initial, ordersByBiz, subsByBiz, historyByBiz, stats, analytics,
}: Props) {
  const supabase = createClient()

  const [businesses,   setBusinesses]   = useState<BizRow[]>(initial)
  const [analyticsOpen, setAnalyticsOpen] = useState(true)
  const [subs, setSubs]             = useState<Record<string, SubRow>>(subsByBiz)
  const [search,     setSearch]     = useState('')
  const [filterPlan, setFilterPlan] = useState<Plan | 'all'>('all')
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [drafts,     setDrafts]     = useState<Record<string, Draft>>({})
  const [saving,     setSaving]     = useState<string | null>(null)
  const [saveError,  setSaveError]  = useState<string | null>(null)
  const [toggling,   setToggling]   = useState<string | null>(null)
  const [showHistory,setShowHistory]= useState<string | null>(null)

  const filtered = businesses.filter(b => {
    const matchSearch = !search ||
      b.name.toLowerCase().includes(search.toLowerCase()) ||
      b.slug.includes(search.toLowerCase())
    const matchPlan = filterPlan === 'all' || b.plan === filterPlan
    return matchSearch && matchPlan
  })

  // Inicializa el draft cuando se abre una fila
  function openRow(id: string) {
    if (expandedId === id) { setExpandedId(null); return }
    setExpandedId(id)
    setShowHistory(null)
    setSaveError(null)
    if (!drafts[id]) {
      const sub = subs[id]
      const biz = businesses.find(b => b.id === id)
      setDrafts(prev => ({
        ...prev,
        [id]: {
          plan:      (sub?.plan ?? biz?.plan ?? 'basic') as Plan,
          status:    (sub?.status ?? biz?.subscription_status ?? 'active') as SubscriptionStatus,
          periodEnd: sub?.current_period_end
            ? sub.current_period_end.slice(0, 10)
            : '',
          note: sub?.internal_note ?? '',
        },
      }))
    }
  }

  function patchDraft(id: string, patch: Partial<Draft>) {
    setDrafts(prev => ({ ...prev, [id]: { ...prev[id], ...patch } }))
  }

  async function savePlanChange(bizId: string) {
    const draft = drafts[bizId]
    if (!draft) return
    setSaving(bizId)
    setSaveError(null)

    const res = await fetch('/api/superadmin/plan', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        business_id:        bizId,
        plan:               draft.plan,
        status:             draft.status,
        current_period_end: draft.periodEnd || null,
        internal_note:      draft.note || null,
      }),
    })
    const data = await res.json()

    if (!res.ok) {
      setSaveError(data.error ?? 'Error al guardar')
    } else {
      // Actualizar estado local
      setBusinesses(prev =>
        prev.map(b => b.id === bizId ? { ...b, plan: draft.plan, subscription_status: draft.status } : b)
      )
      setSubs(prev => ({
        ...prev,
        [bizId]: {
          ...prev[bizId],
          business_id:        bizId,
          plan:               draft.plan,
          status:             draft.status,
          billing_cycle:      prev[bizId]?.billing_cycle ?? 'monthly',
          current_period_end: draft.periodEnd || null,
          internal_note:      draft.note || null,
          updated_at:         new Date().toISOString(),
        },
      }))
    }
    setSaving(null)
  }

  async function toggleActive(b: BizRow) {
    setToggling(b.id)
    await supabase.from('businesses').update({ active: !b.active }).eq('id', b.id)
    setBusinesses(prev => prev.map(x => x.id === b.id ? { ...x, active: !x.active } : x))
    setToggling(null)
  }

  return (
    <div className="space-y-6 animate-fade-in">

      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="h-10 w-10 rounded-2xl bg-yellow-500/15 flex items-center justify-center">
          <ShieldAlert size={20} className="text-yellow-500" />
        </div>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Superadmin</h1>
          <p className="text-sm text-gray-400 mt-0.5">Panel de control de la plataforma</p>
        </div>
      </div>

      {/* ── Sección de Analytics ── */}
      <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
        <button
          onClick={() => setAnalyticsOpen(o => !o)}
          className="w-full flex items-center justify-between px-5 py-4 hover:bg-gray-50 transition-colors"
        >
          <div className="flex items-center gap-2">
            <TrendingUp size={16} className="text-indigo-500" />
            <span className="text-sm font-bold text-gray-900">Analytics de la plataforma</span>
          </div>
          <ChevronDown size={14} className={cn('text-gray-400 transition-transform', analyticsOpen && 'rotate-180')} />
        </button>

        {analyticsOpen && (
          <div className="border-t border-gray-100 p-5 space-y-6">

            {/* KPIs principales */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              {[
                { label: 'Negocios activos 30d', value: analytics.activeBiz30d,    sub: `de ${stats.totalBusinesses} totales`,     color: '#10B981' },
                { label: 'MRR estimado',         value: `U$S ${analytics.mrr.toFixed(0)}`, sub: 'Pro × 9 + Premium × 19',         color: '#6366F1' },
                { label: 'Churn 30d',            value: analytics.churn30d,         sub: 'bajaron a plan basic',                   color: analytics.churn30d > 0 ? '#EF4444' : '#9CA3AF' },
                { label: 'Nuevos esta semana',   value: analytics.newThisWeek,      sub: `vs ${analytics.newLastWeek} semana ant.`, color: '#F59E0B' },
              ].map(({ label, value, sub, color }) => (
                <div key={label} className="rounded-xl bg-gray-50 p-4">
                  <p className="text-xs text-gray-500 mb-1">{label}</p>
                  <p className="text-2xl font-bold" style={{ color }}>{value}</p>
                  <p className="text-[11px] text-gray-400 mt-0.5">{sub}</p>
                </div>
              ))}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {/* Distribución de planes */}
              <div>
                <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">
                  Distribución de planes
                </p>
                <PlanPieChart
                  basic={stats.planCounts.basic}
                  pro={stats.planCounts.pro}
                  premium={stats.planCounts.premium}
                />
              </div>

              {/* Top 5 uso de IA */}
              <div>
                <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">
                  Top 5 · Uso de IA este mes
                </p>
                {analytics.top5AI.length === 0 ? (
                  <p className="text-xs text-gray-400 py-4">Sin datos de IA este mes</p>
                ) : (
                  <div className="space-y-2">
                    {analytics.top5AI.map((row, i) => (
                      <div key={i} className="flex items-center gap-3">
                        <span className="text-xs font-bold text-gray-300 w-4">{i + 1}</span>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-2 mb-0.5">
                            <span className="text-xs font-medium text-gray-800 truncate">{row.name}</span>
                            <span className="text-xs font-bold text-indigo-600 shrink-0">{row.count}</span>
                          </div>
                          <div className="h-1.5 rounded-full bg-gray-100 overflow-hidden">
                            <div
                              className="h-full rounded-full bg-indigo-400 transition-all"
                              style={{ width: `${Math.min(100, (row.count / (analytics.top5AI[0]?.count || 1)) * 100)}%` }}
                            />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

          </div>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: 'Negocios',   value: stats.totalBusinesses, icon: Building2,   color: '#6366F1', sub: `${stats.planCounts.pro} Pro · ${stats.planCounts.premium} Premium` },
          { label: 'Pedidos 30d',value: stats.totalOrders30d.toLocaleString('es'), icon: ShoppingBag, color: '#EA580C', sub: 'Todos los negocios' },
          { label: 'Revenue 30d',value: `$${Math.round(stats.totalRevenue30d / 1000)}k`, icon: DollarSign, color: '#10B981', sub: 'En moneda local' },
          { label: 'Plan Basic', value: stats.planCounts.basic, icon: TrendingUp, color: '#F59E0B', sub: 'Sin plan pago' },
        ].map(({ label, value, icon: Icon, color, sub }) => (
          <div key={label} className="bg-white rounded-2xl border border-gray-100 p-4">
            <div className="flex items-center gap-2 mb-2">
              <div className="h-7 w-7 rounded-lg flex items-center justify-center"
                style={{ background: color + '18' }}>
                <Icon size={14} style={{ color }} />
              </div>
              <span className="text-xs text-gray-500">{label}</span>
            </div>
            <p className="text-2xl font-bold text-gray-900">{value}</p>
            <p className="text-[11px] text-gray-400 mt-0.5">{sub}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Buscar negocio o slug..."
            className="w-full rounded-xl border border-gray-200 pl-8 pr-3 py-2.5 text-sm
                       focus:outline-none focus:border-gray-400 transition-colors"
          />
        </div>
        <div className="flex gap-1 bg-gray-100 rounded-xl p-1">
          {(['all', 'basic', 'pro', 'premium'] as const).map(p => (
            <button key={p} onClick={() => setFilterPlan(p)}
              className={cn(
                'rounded-lg px-3 py-1.5 text-xs font-medium transition-all capitalize',
                filterPlan === p ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500'
              )}>
              {p === 'all' ? 'Todos' : p}
            </button>
          ))}
        </div>
      </div>

      {/* Businesses list */}
      <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
        <div className="px-5 py-3.5 border-b border-gray-100 bg-gray-50/50">
          <p className="text-sm font-medium text-gray-700">
            {filtered.length} negocio{filtered.length !== 1 ? 's' : ''}
          </p>
        </div>

        <div className="divide-y divide-gray-50">
          {filtered.length === 0 && (
            <div className="py-12 text-center text-sm text-gray-400">Sin resultados</div>
          )}
          {filtered.map(b => {
            const vertical    = getVertical(b.vertical_type)
            const planConf    = PLAN_CONF[b.plan]
            const statusConf  = STATUS_CONF[b.subscription_status]
            const orders      = ordersByBiz[b.id] ?? { count: 0, revenue: 0 }
            const sub         = subs[b.id]
            const draft       = drafts[b.id]
            const isExpanded  = expandedId === b.id
            const isSaving    = saving === b.id
            const isToggling  = toggling === b.id
            const history     = historyByBiz[b.id] ?? []
            const viewHistory = showHistory === b.id

            return (
              <div key={b.id}>
                {/* ── Fila principal ── */}
                <button
                  onClick={() => openRow(b.id)}
                  className="w-full flex items-center gap-4 px-5 py-4 text-left hover:bg-gray-50 transition-colors"
                >
                  <div className="h-9 w-9 rounded-xl flex items-center justify-center shrink-0 text-white text-sm font-bold"
                    style={{ background: b.primary_color ?? '#6366F1' }}>
                    {b.name.slice(0, 1).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className={cn('text-sm font-semibold', !b.active && 'line-through text-gray-400')}>
                        {b.name}
                      </p>
                      <span className="text-xs text-gray-400">{vertical.emoji} {b.slug}</span>
                    </div>
                    <div className="flex items-center gap-2 mt-1 flex-wrap">
                      <span className="flex items-center gap-1 text-[11px] font-medium rounded-full px-2 py-0.5"
                        style={{ background: planConf.bg, color: planConf.text }}>
                        {planConf.label}
                      </span>
                      <span className="flex items-center gap-1 text-[11px] text-gray-500">
                        <span className="h-1.5 w-1.5 rounded-full inline-block"
                          style={{ background: statusConf.dot }} />
                        {statusConf.label}
                      </span>
                      {sub?.current_period_end && (
                        <span className="text-[11px] text-gray-400">
                          · Vence {fmtDate(sub.current_period_end)}
                        </span>
                      )}
                      {sub?.internal_note && (
                        <span className="text-[11px] text-blue-500 truncate max-w-[200px]" title={sub.internal_note}>
                          · 📝 {sub.internal_note}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="text-right shrink-0 hidden sm:block">
                    <p className="text-sm font-semibold text-gray-900">{orders.count} pedidos</p>
                    <p className="text-xs text-gray-400">30d</p>
                  </div>
                  <ChevronDown size={14} className={cn('text-gray-400 transition-transform shrink-0', isExpanded && 'rotate-180')} />
                </button>

                {/* ── Panel expandido ── */}
                {isExpanded && draft && (
                  <div className="px-5 pb-5 pt-3 bg-gray-50/50 border-t border-gray-100 space-y-4">

                    {/* Toggle historial */}
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setShowHistory(viewHistory ? null : b.id)}
                        className={cn(
                          'flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg transition-all',
                          viewHistory
                            ? 'bg-gray-200 text-gray-700'
                            : 'bg-white border border-gray-200 text-gray-500 hover:border-gray-300'
                        )}>
                        <History size={12} />
                        {viewHistory ? 'Editar plan' : `Historial (${history.length})`}
                      </button>
                      <a href={`/store/${b.slug}`} target="_blank"
                        className="text-xs text-blue-600 hover:underline">
                        Ver tienda ↗
                      </a>
                      <button
                        onClick={() => toggleActive(b)}
                        disabled={isToggling}
                        className={cn(
                          'flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-all disabled:opacity-50',
                          b.active
                            ? 'bg-red-50 text-red-600 hover:bg-red-100'
                            : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                        )}>
                        {isToggling
                          ? <Loader2 size={11} className="animate-spin" />
                          : b.active ? <X size={11} /> : <Check size={11} />
                        }
                        {b.active ? 'Desactivar' : 'Activar'}
                      </button>
                    </div>

                    {/* ── Vista de historial ── */}
                    {viewHistory ? (
                      <div className="space-y-2">
                        {history.length === 0 ? (
                          <p className="text-xs text-gray-400 py-2">Sin cambios manuales registrados.</p>
                        ) : (
                          history.map((ev, i) => {
                            const p = ev.payload ?? {}
                            return (
                              <div key={i} className="flex items-start gap-3 rounded-xl bg-white border border-gray-100 px-3 py-2.5">
                                <div className="h-6 w-6 rounded-lg bg-blue-50 flex items-center justify-center shrink-0 mt-0.5">
                                  <History size={11} className="text-blue-500" />
                                </div>
                                <div className="flex-1 min-w-0">
                                  <p className="text-xs font-semibold text-gray-800">
                                    {p.previous_plan as string ?? '?'} → {p.new_plan as string ?? '?'}
                                  </p>
                                  {typeof p.note === 'string' && p.note && (
                                    <p className="text-[11px] text-gray-500 mt-0.5">📝 {p.note}</p>
                                  )}
                                  {typeof p.period_end === 'string' && p.period_end && (
                                    <p className="text-[11px] text-gray-400">Vence: {fmtDate(p.period_end)}</p>
                                  )}
                                </div>
                                <span className="text-[10px] text-gray-400 shrink-0">{fmtDate(ev.created_at)}</span>
                              </div>
                            )
                          })
                        )}
                      </div>
                    ) : (
                      /* ── Editor de plan ── */
                      <div className="space-y-4">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">

                          {/* Plan */}
                          <div>
                            <label className="block text-xs font-semibold text-gray-500 mb-1.5">Plan</label>
                            <div className="flex gap-1">
                              {PLANS.map(p => (
                                <button key={p} onClick={() => patchDraft(b.id, { plan: p })}
                                  className={cn(
                                    'flex-1 rounded-lg py-1.5 text-xs font-medium transition-all capitalize',
                                    draft.plan === p
                                      ? 'bg-gray-900 text-white'
                                      : 'bg-white border border-gray-200 text-gray-600 hover:border-gray-400'
                                  )}>
                                  {p}
                                </button>
                              ))}
                            </div>
                          </div>

                          {/* Estado */}
                          <div>
                            <label className="block text-xs font-semibold text-gray-500 mb-1.5">Estado</label>
                            <div className="flex flex-wrap gap-1">
                              {STATUSES.map(s => (
                                <button key={s} onClick={() => patchDraft(b.id, { status: s })}
                                  className={cn(
                                    'rounded-lg px-2 py-1 text-[10px] font-medium transition-all',
                                    draft.status === s
                                      ? 'text-white'
                                      : 'bg-white border border-gray-200 text-gray-600 hover:border-gray-400'
                                  )}
                                  style={draft.status === s ? { background: STATUS_CONF[s].dot } : {}}>
                                  {STATUS_CONF[s].label}
                                </button>
                              ))}
                            </div>
                          </div>

                          {/* Fecha de vencimiento */}
                          <div>
                            <label className="flex items-center gap-1.5 text-xs font-semibold text-gray-500 mb-1.5">
                              <Calendar size={11} /> Vencimiento del plan
                            </label>
                            <input
                              type="date"
                              value={draft.periodEnd}
                              onChange={e => patchDraft(b.id, { periodEnd: e.target.value })}
                              className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm
                                         focus:outline-none focus:border-gray-400 transition-colors"
                            />
                          </div>

                          {/* Nota interna */}
                          <div>
                            <label className="flex items-center gap-1.5 text-xs font-semibold text-gray-500 mb-1.5">
                              <FileText size={11} /> Nota interna
                            </label>
                            <input
                              type="text"
                              value={draft.note}
                              onChange={e => patchDraft(b.id, { note: e.target.value })}
                              placeholder="Ej: pagó por transferencia el 01/06"
                              className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm
                                         focus:outline-none focus:border-gray-400 transition-colors"
                            />
                          </div>
                        </div>

                        {/* Error */}
                        {saveError && saving !== b.id && (
                          <p className="text-xs text-red-500 bg-red-50 rounded-lg px-3 py-2">{saveError}</p>
                        )}

                        {/* Guardar */}
                        <div className="flex items-center justify-between pt-1">
                          <p className="text-[11px] text-gray-400">
                            Registrado: {fmtDate(b.created_at)} · Pedidos 30d: {orders.count} · ${Math.round(orders.revenue).toLocaleString('es')}
                          </p>
                          <button
                            onClick={() => savePlanChange(b.id)}
                            disabled={isSaving}
                            className="flex items-center gap-2 rounded-xl bg-gray-900 px-4 py-2
                                       text-xs font-bold text-white hover:bg-gray-700
                                       disabled:opacity-50 transition-all"
                          >
                            {isSaving
                              ? <><Loader2 size={12} className="animate-spin" /> Guardando...</>
                              : <><Save size={12} /> Guardar cambios</>
                            }
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
