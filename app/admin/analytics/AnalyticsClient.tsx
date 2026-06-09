// app/admin/analytics/AnalyticsClient.tsx
'use client'
import { useState, useMemo, useCallback } from 'react'
import * as XLSX from 'xlsx'
import jsPDF from 'jspdf'
import PlanGate from '@/components/admin/PlanGate'
import SectionTour from '@/components/admin/SectionTour'
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Cell,
} from 'recharts'
import {
  TrendingUp, TrendingDown, ShoppingBag, Users, Package,
  BarChart2, ArrowUpRight, ArrowDownRight, Minus, DollarSign, Wallet, Clock, Tag,
  Download, FileSpreadsheet, FileText,
} from 'lucide-react'
import { cn, formatPrice } from '@/lib/utils'
import type { Order, OrderItem } from '@/types'
import { useVertical } from '@/lib/vertical-context'

// ── Tipos internos ────────────────────────────────────────────
type Range = '7d' | '30d' | '90d' | 'month'

const RANGES: { key: Range; label: string; days: number }[] = [
  { key: '7d',    label: '7 días',     days: 7  },
  { key: '30d',   label: '30 días',    days: 30 },
  { key: 'month', label: 'Este mes',   days: 0  },
  { key: '90d',   label: '90 días',    days: 90 },
]

interface RawItem { product_name: string; quantity: number; unit_price: number; subtotal: number; cost_price?: number | null }
interface CajaSession {
  id: string; opened_at: string; closed_at: string | null
  opening_amount: number; closing_amount: number | null
  expected_amount: number | null; difference: number | null; status: string
}

// ── Helpers ───────────────────────────────────────────────────

function getRangeDates(range: Range): { from: Date; prevFrom: Date; prevTo: Date } {
  const now   = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())

  if (range === 'month') {
    const from    = new Date(today.getFullYear(), today.getMonth(), 1)
    const prevTo  = new Date(from.getTime() - 1)
    const prevFrom = new Date(prevTo.getFullYear(), prevTo.getMonth(), 1)
    return { from, prevFrom, prevTo }
  }

  const conf    = RANGES.find(r => r.key === range)!
  const from    = new Date(today.getTime() - conf.days * 86_400_000)
  const prevTo  = new Date(from.getTime() - 1)
  const prevFrom = new Date(prevTo.getTime() - conf.days * 86_400_000)
  return { from, prevFrom, prevTo }
}

function filterOrders(orders: Order[], from: Date, to: Date): Order[] {
  return orders.filter(o => {
    const d = new Date(o.created_at)
    return d >= from && d <= to
  })
}

function confirmedRevenue(orders: Order[]) {
  return orders.filter(o => o.confirmed_sale).reduce((a, o) => a + o.total, 0)
}

function pct(curr: number, prev: number) {
  if (prev === 0) return curr > 0 ? 100 : 0
  return Math.round(((curr - prev) / prev) * 100)
}

function buildDailyChart(orders: Order[], from: Date, to: Date, color: string) {
  const days: { date: string; revenue: number; orders: number }[] = []
  const cur = new Date(from)
  while (cur <= to) {
    const label = cur.toLocaleDateString('es-UY', { day: 'numeric', month: 'short' })
    const dayOrders = orders.filter(o => {
      const d = new Date(o.created_at)
      return d.getFullYear() === cur.getFullYear() &&
             d.getMonth()    === cur.getMonth()    &&
             d.getDate()     === cur.getDate()
    })
    days.push({
      date:    label,
      revenue: confirmedRevenue(dayOrders),
      orders:  dayOrders.length,
    })
    cur.setDate(cur.getDate() + 1)
  }
  return days
}

function topProducts(orders: Order[], limit = 8) {
  const map: Record<string, { qty: number; revenue: number }> = {}
  orders.forEach(o => {
    const items = (o.items ?? []) as unknown as RawItem[]
    items.forEach(i => {
      if (!map[i.product_name]) map[i.product_name] = { qty: 0, revenue: 0 }
      map[i.product_name].qty     += i.quantity
      map[i.product_name].revenue += i.subtotal ?? i.quantity * i.unit_price
    })
  })
  return Object.entries(map)
    .map(([name, v]) => ({ name, ...v }))
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, limit)
}

function statusBreakdown(orders: Order[]) {
  const map: Record<string, number> = {}
  orders.forEach(o => { map[o.status] = (map[o.status] ?? 0) + 1 })
  return Object.entries(map)
    .map(([status, count]) => ({ status, count }))
    .sort((a, b) => b.count - a.count)
}

// ── Costs helpers ─────────────────────────────────────────────
function computeCOGS(orders: Order[], from: Date, to: Date): number {
  return orders
    .filter(o => o.confirmed_sale && new Date(o.created_at) >= from && new Date(o.created_at) <= to)
    .flatMap(o => (o.items ?? []) as unknown as RawItem[])
    .reduce((s, i) => s + ((i.cost_price ?? 0) * i.quantity), 0)
}

function costsByPeriod(costs: { amount: number; date: string }[], from: Date, to: Date): number {
  return costs
    .filter(c => { const d = new Date(c.date); return d >= from && d <= to })
    .reduce((s, c) => s + c.amount, 0)
}

function marginPct(revenue: number, cost: number): number {
  if (revenue === 0) return 0
  return Math.round(((revenue - cost) / revenue) * 100)
}

// ── Hourly heatmap helper ─────────────────────────────────────
function buildHourlyChart(orders: Order[]) {
  const counts = Array.from({ length: 24 }, (_, h) => ({ hour: h, count: 0 }))
  orders.forEach(o => {
    const h = new Date(o.created_at).getHours()
    counts[h].count++
  })
  return counts
}

// ── Props ─────────────────────────────────────────────────────
interface Props {
  orders:        Order[]
  customers:     { id: string; created_at: string }[]
  costs:         { amount: number; type: string; date: string }[]
  cajaSessions:  CajaSession[]
}

// ── Component ─────────────────────────────────────────────────
export default function AnalyticsClient({ orders, customers, costs, cajaSessions }: Props) {
  const { currency, color: primaryColor, vertical, group, business } = useVertical()
  const orderLabel   = vertical.orderLabel
  const productLabel = vertical.productLabel
  const [range, setRange] = useState<Range>('30d')

  const today = new Date()

  const { from, prevFrom, prevTo } = useMemo(() => getRangeDates(range), [range])
  const to = today

  const curr = useMemo(() => filterOrders(orders, from, to), [orders, from, to])
  const prev = useMemo(() => filterOrders(orders, prevFrom, prevTo), [orders, prevFrom, prevTo])

  // KPIs
  const currRevenue   = confirmedRevenue(curr)
  const prevRevenue   = confirmedRevenue(prev)
  const currOrders    = curr.length
  const prevOrders    = prev.length
  const currAvgTicket = currOrders > 0 ? currRevenue / currOrders : 0
  const prevAvgTicket = prevOrders > 0 ? prevRevenue / prevOrders : 0

  const currCustomers = customers.filter(c => new Date(c.created_at) >= from).length
  const prevCustomers = customers.filter(c => {
    const d = new Date(c.created_at); return d >= prevFrom && d <= prevTo
  }).length

  // Delivery split (gastro)
  const deliveries     = curr.filter(o => o.delivery_type === 'delivery').length
  const pickups        = curr.filter(o => o.delivery_type === 'pickup').length
  const mesaOrderCount = curr.filter(o => o.delivery_type === 'dine_in').length

  // Chart
  const dailyChart = useMemo(() => buildDailyChart(curr, from, to, primaryColor), [curr, from, to])

  // Top productos
  const top = useMemo(() => topProducts(curr), [curr])
  const maxRevenue = top[0]?.revenue ?? 1

  // Status breakdown
  const breakdown = useMemo(() => statusBreakdown(curr), [curr])

  // Margins
  const cogs     = useMemo(() => computeCOGS(orders, from, to), [orders, from, to])
  const opCosts  = useMemo(() => costsByPeriod(costs, from, to), [costs, from, to])
  const hasCOGS  = cogs > 0
  const grossMarginPct = marginPct(currRevenue, cogs)
  const netMarginPct   = marginPct(currRevenue, cogs + opCosts)
  const grossProfit    = currRevenue - cogs
  const netProfit      = currRevenue - cogs - opCosts

  // Caja
  const cajaInRange = useMemo(() =>
    cajaSessions.filter(s => new Date(s.opened_at) >= from && new Date(s.opened_at) <= to),
    [cajaSessions, from, to]
  )
  const cajaTotal   = cajaInRange.filter(s => s.status === 'closed').reduce((a, s) => a + (s.closing_amount ?? 0), 0)
  const cajaDiff    = cajaInRange.filter(s => s.status === 'closed').reduce((a, s) => a + (s.difference ?? 0), 0)
  const hasCaja     = cajaInRange.length > 0

  // Discounts
  const discountOrders = useMemo(() =>
    curr.filter(o => o.discount_amount != null && o.discount_amount > 0),
    [curr]
  )
  const totalDiscounts = discountOrders.reduce((s, o) => s + (o.discount_amount ?? 0), 0)
  const topCoupons = useMemo(() => {
    const map: Record<string, { count: number; total: number }> = {}
    discountOrders.forEach(o => {
      const k = o.discount_code ?? '(sin código)'
      if (!map[k]) map[k] = { count: 0, total: 0 }
      map[k].count++
      map[k].total += o.discount_amount ?? 0
    })
    return Object.entries(map)
      .map(([code, v]) => ({ code, ...v }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 5)
  }, [discountOrders])

  // Hourly
  const hourlyChart = useMemo(() => buildHourlyChart(curr), [curr])
  const maxHourly   = Math.max(...hourlyChart.map(h => h.count), 1)

  const rangeLabel  = RANGES.find(r => r.key === range)?.label ?? range
  const businessName = business?.name ?? 'Negocio'
  const exportDate   = new Date().toLocaleDateString('es-AR')

  // ── Excel export ─────────────────────────────────────────────
  const exportToExcel = useCallback(() => {
    const wb = XLSX.utils.book_new()

    // Sheet 1: KPIs
    const kpiRows = [
      ['Métrica', 'Período actual', 'Período anterior', 'Variación'],
      ['Ingresos',         currRevenue,   prevRevenue,   `${pct(currRevenue, prevRevenue)}%`],
      ['Pedidos',          currOrders,    prevOrders,    `${pct(currOrders, prevOrders)}%`],
      ['Ticket promedio',  currAvgTicket, prevAvgTicket, `${pct(currAvgTicket, prevAvgTicket)}%`],
      ['Nuevos clientes',  currCustomers, prevCustomers, `${pct(currCustomers, prevCustomers)}%`],
    ]
    const wsKPI = XLSX.utils.aoa_to_sheet([
      [`Reporte de ventas — ${businessName}`],
      [`Período: ${rangeLabel}  |  Exportado: ${exportDate}`],
      [],
      ...kpiRows,
    ])
    XLSX.utils.book_append_sheet(wb, wsKPI, 'KPIs')

    // Sheet 2: Ventas por día
    const dailyRows = [['Fecha', 'Ingresos', 'Pedidos'], ...dailyChart.map(d => [d.date, d.revenue, d.orders])]
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(dailyRows), 'Ventas por día')

    // Sheet 3: Top productos
    const topRows = [['Producto', 'Unidades', 'Ingresos'], ...top.map(p => [p.name, p.qty, p.revenue])]
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(topRows), 'Top Productos')

    XLSX.writeFile(wb, `${businessName.replace(/[^a-z0-9]/gi, '_')}_reportes_${range}.xlsx`)
  }, [businessName, rangeLabel, exportDate, range, currRevenue, prevRevenue, currOrders, prevOrders, currAvgTicket, prevAvgTicket, currCustomers, prevCustomers, dailyChart, top])

  // ── PDF export ───────────────────────────────────────────────
  const exportToPDF = useCallback(() => {
    const doc   = new jsPDF()
    const blue  = [21, 101, 255] as [number, number, number]
    const gray  = [107, 114, 128] as [number, number, number]
    const dark  = [17, 24, 39] as [number, number, number]
    let y = 20

    // Header
    doc.setFillColor(...blue)
    doc.rect(0, 0, 210, 14, 'F')
    doc.setTextColor(255, 255, 255)
    doc.setFontSize(9)
    doc.setFont('helvetica', 'bold')
    doc.text('FYP Studio — Reporte de Ventas', 14, 9)

    // Title
    y = 28
    doc.setTextColor(...dark)
    doc.setFontSize(18)
    doc.text(businessName, 14, y)
    y += 8
    doc.setFontSize(10)
    doc.setTextColor(...gray)
    doc.setFont('helvetica', 'normal')
    doc.text(`Período: ${rangeLabel}  ·  Exportado: ${exportDate}`, 14, y)
    y += 12

    // KPIs
    doc.setFontSize(12)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(...dark)
    doc.text('Resumen del período', 14, y)
    y += 8

    const kpis = [
      { label: 'Ingresos',        value: formatPrice(currRevenue, currency),   delta: pct(currRevenue, prevRevenue) },
      { label: 'Pedidos',         value: String(currOrders),                   delta: pct(currOrders, prevOrders) },
      { label: 'Ticket promedio', value: formatPrice(currAvgTicket, currency), delta: pct(currAvgTicket, prevAvgTicket) },
      { label: 'Nuevos clientes', value: String(currCustomers),                delta: pct(currCustomers, prevCustomers) },
    ]
    kpis.forEach((kpi, i) => {
      const col = i % 2 === 0 ? 14 : 110
      if (i % 2 === 0 && i > 0) y += 22
      doc.setFillColor(247, 249, 252)
      doc.roundedRect(col, y, 90, 18, 3, 3, 'F')
      doc.setFontSize(8)
      doc.setFont('helvetica', 'normal')
      doc.setTextColor(...gray)
      doc.text(kpi.label, col + 4, y + 6)
      doc.setFontSize(12)
      doc.setFont('helvetica', 'bold')
      doc.setTextColor(...dark)
      doc.text(kpi.value, col + 4, y + 14)
      const dColor = kpi.delta > 0 ? [16, 185, 129] : kpi.delta < 0 ? [239, 68, 68] : [156, 163, 175]
      doc.setFontSize(8)
      doc.setFont('helvetica', 'normal')
      doc.setTextColor(dColor[0], dColor[1], dColor[2])
      doc.text(`${kpi.delta > 0 ? '+' : ''}${kpi.delta}% vs anterior`, col + 60, y + 14)
    })
    y += 28

    // Top productos
    if (top.length > 0) {
      doc.setFontSize(12)
      doc.setFont('helvetica', 'bold')
      doc.setTextColor(...dark)
      doc.text('Top productos del período', 14, y)
      y += 7
      top.slice(0, 8).forEach((p, i) => {
        doc.setFontSize(9)
        doc.setFont('helvetica', 'normal')
        doc.setTextColor(...gray)
        doc.text(`${i + 1}.`, 14, y)
        doc.setTextColor(...dark)
        doc.text(p.name.slice(0, 40), 22, y)
        doc.setTextColor(...gray)
        doc.text(`${p.qty} uds  ·  ${formatPrice(p.revenue, currency)}`, 130, y)
        y += 6
      })
    }

    // Footer
    doc.setFontSize(8)
    doc.setTextColor(...gray)
    doc.text('Generado por FYP Studio', 14, 285)

    doc.save(`${businessName.replace(/[^a-z0-9]/gi, '_')}_reportes_${range}.pdf`)
  }, [businessName, rangeLabel, exportDate, range, currency, currRevenue, prevRevenue, currOrders, prevOrders, currAvgTicket, prevAvgTicket, currCustomers, prevCustomers, top])

  const [exportOpen, setExportOpen] = useState(false)

  const KPIS = [
    {
      label:   'Ingresos',
      value:   formatPrice(currRevenue, currency),
      delta:   pct(currRevenue, prevRevenue),
      icon:    TrendingUp,
      color:   '#10B981',
    },
    {
      label:   orderLabel + 's',
      value:   currOrders,
      delta:   pct(currOrders, prevOrders),
      icon:    ShoppingBag,
      color:   primaryColor,
    },
    {
      label:   'Ticket promedio',
      value:   formatPrice(currAvgTicket, currency),
      delta:   pct(currAvgTicket, prevAvgTicket),
      icon:    BarChart2,
      color:   '#8B5CF6',
    },
    {
      label:   'Nuevos clientes',
      value:   currCustomers,
      delta:   pct(currCustomers, prevCustomers),
      icon:    Users,
      color:   '#F59E0B',
    },
  ]

  const STATUS_LABEL: Record<string, string> = {
    pending: 'Pendiente', confirmed: 'Confirmado', preparing: 'En proceso',
    ready: 'Listo', shipped: 'Enviado', delivered: 'Entregado',
    done: 'Realizado', cancelled: 'Cancelado',
  }
  const STATUS_COLOR: Record<string, string> = {
    pending: '#F59E0B', confirmed: '#3B82F6', preparing: '#8B5CF6',
    ready: '#10B981', shipped: '#06B6D4', delivered: '#6B7280',
    done: '#6B7280', cancelled: '#EF4444',
  }

  return (
    <div className="space-y-5 animate-fade-in">
      <SectionTour section="analytics" />

      {/* Header */}
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-xl lg:text-2xl font-bold text-gray-900 tracking-tight flex items-center gap-2">
            <BarChart2 size={22} style={{ color: primaryColor }} />
            Reportes
          </h1>
          <p className="text-sm text-gray-400 mt-0.5">Métricas de tu negocio</p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {/* Range selector */}
          <div className="flex items-center gap-1 bg-gray-100 rounded-xl p-1">
            {RANGES.map(r => (
              <button key={r.key} onClick={() => setRange(r.key)}
                className={cn(
                  'rounded-lg px-3 py-1.5 text-xs font-semibold transition-all',
                  range === r.key ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
                )}>
                {r.label}
              </button>
            ))}
          </div>

          {/* Export button — solo Pro y Premium */}
          <PlanGate required="pro" feature="Exportación de reportes" description="Exportá tus reportes en Excel y PDF activando el plan Pro.">
          <div className="relative">
            <button
              onClick={() => setExportOpen(o => !o)}
              className="flex items-center gap-1.5 rounded-xl border border-gray-200 px-3 py-1.5
                         text-xs font-semibold text-gray-600 hover:bg-gray-50 transition-all"
            >
              <Download size={12} />
              Exportar
            </button>
            {exportOpen && (
              <>
                <div className="fixed inset-0 z-20" onClick={() => setExportOpen(false)} />
                <div className="absolute right-0 top-full mt-1.5 z-30 bg-white rounded-xl
                                border border-gray-200 shadow-lg overflow-hidden w-40">
                  <button
                    onClick={() => { exportToExcel(); setExportOpen(false) }}
                    className="flex items-center gap-2.5 w-full px-3 py-2.5 text-xs font-medium
                               text-gray-700 hover:bg-gray-50 transition-colors"
                  >
                    <FileSpreadsheet size={13} className="text-emerald-600" />
                    Excel (.xlsx)
                  </button>
                  <button
                    onClick={() => { exportToPDF(); setExportOpen(false) }}
                    className="flex items-center gap-2.5 w-full px-3 py-2.5 text-xs font-medium
                               text-gray-700 hover:bg-gray-50 transition-colors border-t border-gray-100"
                  >
                    <FileText size={13} className="text-red-500" />
                    PDF
                  </button>
                </div>
              </>
            )}
          </div>
          </PlanGate>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {KPIS.map(({ label, value, delta, icon: Icon, color }) => (
          <div key={label} className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <div className="h-8 w-8 rounded-xl flex items-center justify-center"
                style={{ background: color + '18' }}>
                <Icon size={15} style={{ color }} />
              </div>
              <DeltaBadge delta={delta} />
            </div>
            <p className="text-xl font-bold text-gray-900">{value}</p>
            <p className="text-xs text-gray-400 mt-0.5">{label}</p>
          </div>
        ))}
      </div>

      {/* Revenue Chart */}
      <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
        <div className="flex items-center justify-between mb-5">
          <p className="text-sm font-bold text-gray-900">Ingresos por día</p>
          <p className="text-xs text-gray-400">{formatPrice(currRevenue, currency)} total</p>
        </div>
        <ResponsiveContainer width="100%" height={180}>
          <AreaChart data={dailyChart} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
            <defs>
              <linearGradient id="analyticsGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%"  stopColor={primaryColor} stopOpacity={0.3} />
                <stop offset="95%" stopColor={primaryColor} stopOpacity={0}   />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" vertical={false} />
            <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#9CA3AF' }}
              tickLine={false} axisLine={false}
              interval={Math.floor(dailyChart.length / 6)} />
            <YAxis tick={{ fontSize: 10, fill: '#9CA3AF' }} tickLine={false} axisLine={false}
              tickFormatter={v => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : String(v)} />
            <Tooltip
              contentStyle={{ borderRadius: 12, border: 'none', boxShadow: '0 4px 20px rgba(0,0,0,0.1)', fontSize: 12 }}
              formatter={(v) => [formatPrice(Number(v), currency), 'Ingresos']}
              labelStyle={{ color: '#374151', fontWeight: 600 }}
            />
            <Area type="monotone" dataKey="revenue" stroke={primaryColor} strokeWidth={2}
              fill="url(#analyticsGrad)" dot={false} activeDot={{ r: 4, strokeWidth: 0 }} />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* Secciones detalladas — solo Pro y Premium */}
      <PlanGate required="pro" feature="Reportes completos" description="Los reportes detallados (productos, actividad por hora, caja, rentabilidad) están disponibles en el plan Pro.">

      {/* Two-column: Top productos + Status breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

        {/* Top Productos */}
        <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
          <p className="text-sm font-bold text-gray-900 mb-4">
            Top {productLabel.toLowerCase()}s
          </p>
          {top.length === 0 ? (
            <div className="flex flex-col items-center py-8 text-center">
              <Package size={24} className="text-gray-200 mb-2" />
              <p className="text-xs text-gray-400">Sin datos en este período</p>
            </div>
          ) : (
            <div className="space-y-3">
              {top.map((p, i) => (
                <div key={p.name} className="flex items-center gap-3">
                  <span className="text-xs font-bold text-gray-300 w-4 shrink-0">{i + 1}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-baseline justify-between mb-1 gap-2">
                      <p className="text-xs font-semibold text-gray-800 truncate">{p.name}</p>
                      <p className="text-xs text-gray-500 shrink-0">{p.qty} uds</p>
                    </div>
                    <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                      <div className="h-full rounded-full transition-all"
                        style={{ width: `${(p.revenue / maxRevenue) * 100}%`, background: primaryColor }} />
                    </div>
                    <p className="text-[10px] text-gray-400 mt-0.5">{formatPrice(p.revenue, currency)}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Estado de pedidos */}
        <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
          <p className="text-sm font-bold text-gray-900 mb-4">Estado de {orderLabel.toLowerCase()}s</p>
          {breakdown.length === 0 ? (
            <div className="flex flex-col items-center py-8 text-center">
              <ShoppingBag size={24} className="text-gray-200 mb-2" />
              <p className="text-xs text-gray-400">Sin datos en este período</p>
            </div>
          ) : (
            <div className="space-y-3">
              {breakdown.map(({ status, count }) => {
                const total = currOrders || 1
                const color = STATUS_COLOR[status] ?? '#6B7280'
                return (
                  <div key={status} className="flex items-center gap-3">
                    <div className="h-2 w-2 rounded-full shrink-0" style={{ background: color }} />
                    <p className="text-xs text-gray-700 flex-1">{STATUS_LABEL[status] ?? status}</p>
                    <div className="flex items-center gap-2">
                      <div className="w-24 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                        <div className="h-full rounded-full"
                          style={{ width: `${(count / total) * 100}%`, background: color }} />
                      </div>
                      <p className="text-xs font-semibold text-gray-700 w-6 text-right">{count}</p>
                    </div>
                  </div>
                )
              })}
            </div>
          )}

          {/* Gastro: Delivery vs Retiro */}
          {(group === 'gastro' || group === 'comercio') && currOrders > 0 && (
            <div className="mt-5 pt-4 border-t border-gray-100 space-y-2">
              <p className="text-xs font-bold text-gray-500 uppercase tracking-wide">Tipo de entrega</p>
              {[
                { label: 'Delivery', count: deliveries,     color: '#3B82F6' },
                { label: 'Retiro',   count: pickups,        color: '#8B5CF6' },
                { label: 'Mesa',     count: mesaOrderCount, color: '#F59E0B' },
              ].map(({ label, count, color }) => (
                <div key={label} className="flex items-center gap-3">
                  <p className="text-xs text-gray-700 w-16">{label}</p>
                  <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                    <div className="h-full rounded-full"
                      style={{ width: `${(count / currOrders) * 100}%`, background: color }} />
                  </div>
                  <p className="text-xs font-semibold text-gray-700 w-6 text-right">{count}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Bar chart: pedidos por día */}
      <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
        <p className="text-sm font-bold text-gray-900 mb-5">
          {orderLabel}s por día
        </p>
        <ResponsiveContainer width="100%" height={140}>
          <BarChart data={dailyChart} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}
            barSize={range === '7d' ? 20 : range === '30d' ? 8 : 4}>
            <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" vertical={false} />
            <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#9CA3AF' }}
              tickLine={false} axisLine={false}
              interval={Math.floor(dailyChart.length / 6)} />
            <YAxis tick={{ fontSize: 10, fill: '#9CA3AF' }} tickLine={false} axisLine={false}
              allowDecimals={false} />
            <Tooltip
              contentStyle={{ borderRadius: 12, border: 'none', boxShadow: '0 4px 20px rgba(0,0,0,0.1)', fontSize: 12 }}
              formatter={(v) => [Number(v), orderLabel + 's']}
              labelStyle={{ color: '#374151', fontWeight: 600 }}
            />
            <Bar dataKey="orders" radius={[4, 4, 0, 0]} fill={primaryColor + '99'} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Mapa de calor por hora */}
      {curr.length > 0 && (
        <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
          <div className="flex items-center gap-2 mb-5">
            <div className="h-8 w-8 rounded-xl flex items-center justify-center"
              style={{ background: primaryColor + '18' }}>
              <Clock size={15} style={{ color: primaryColor }} />
            </div>
            <p className="text-sm font-bold text-gray-900">Actividad por hora</p>
            <p className="text-xs text-gray-400 ml-auto">Horarios pico del período</p>
          </div>
          <div className="flex items-end gap-0.5 h-16">
            {hourlyChart.map(({ hour, count }) => {
              const pctH  = count / maxHourly
              const isTop = pctH > 0.7
              const isMid = pctH > 0.35
              return (
                <div key={hour} className="flex-1 flex flex-col items-center gap-1 group relative">
                  <div
                    className="w-full rounded-t-sm transition-all"
                    style={{
                      height: `${Math.max(pctH * 100, count > 0 ? 8 : 2)}%`,
                      background: isTop ? primaryColor : isMid ? primaryColor + '88' : primaryColor + '33',
                    }}
                  />
                  {/* Tooltip on hover */}
                  {count > 0 && (
                    <div className="absolute bottom-full mb-1 left-1/2 -translate-x-1/2 hidden group-hover:flex
                                    bg-gray-900 text-white text-[10px] font-semibold rounded-lg px-2 py-1
                                    whitespace-nowrap z-10 pointer-events-none">
                      {hour}:00 — {count}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
          {/* Hour labels */}
          <div className="flex mt-1.5">
            {[0, 6, 12, 18, 23].map(h => (
              <div key={h} className="text-[9px] text-gray-400"
                style={{ marginLeft: h === 0 ? 0 : `${(h / 23) * 100}%`, position: h === 0 ? 'relative' : 'absolute', transform: h !== 0 ? 'translateX(-50%)' : 'none' }}>
                {h}h
              </div>
            ))}
          </div>
          {/* Top hours summary */}
          {(() => {
            const top3 = [...hourlyChart].sort((a,b) => b.count - a.count).slice(0,3).filter(h => h.count > 0)
            if (!top3.length) return null
            return (
              <div className="flex gap-2 mt-4 flex-wrap">
                {top3.map(({ hour, count }, i) => (
                  <span key={hour} className="flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-semibold"
                    style={{ background: primaryColor + (i === 0 ? 'ff' : i === 1 ? '88' : '44'), color: i === 0 ? 'white' : primaryColor }}>
                    {i === 0 ? '🔥' : i === 1 ? '⚡' : '📊'} {hour}:00 – {count} pedidos
                  </span>
                ))}
              </div>
            )
          })()}
        </div>
      )}

      {/* Caja */}
      {hasCaja && (
        <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
          <div className="flex items-center gap-2 mb-5">
            <div className="h-8 w-8 rounded-xl flex items-center justify-center bg-violet-50">
              <Wallet size={15} className="text-violet-600" />
            </div>
            <p className="text-sm font-bold text-gray-900">Caja</p>
            <span className="text-xs text-gray-400 ml-auto">{cajaInRange.length} sesión{cajaInRange.length !== 1 ? 'es' : ''}</span>
          </div>
          <div className="grid grid-cols-3 gap-3 mb-4">
            <div className="rounded-xl bg-gray-50 p-3 text-center">
              <p className="text-lg font-black text-gray-900">{cajaInRange.filter(s => s.status === 'closed').length}</p>
              <p className="text-[10px] text-gray-400 mt-0.5">Cierres</p>
            </div>
            <div className="rounded-xl bg-gray-50 p-3 text-center">
              <p className="text-lg font-black text-gray-900">{formatPrice(cajaTotal, currency)}</p>
              <p className="text-[10px] text-gray-400 mt-0.5">Total contado</p>
            </div>
            <div className={cn('rounded-xl p-3 text-center', Math.abs(cajaDiff) < 1 ? 'bg-emerald-50' : cajaDiff > 0 ? 'bg-blue-50' : 'bg-red-50')}>
              <p className={cn('text-lg font-black', Math.abs(cajaDiff) < 1 ? 'text-emerald-700' : cajaDiff > 0 ? 'text-blue-700' : 'text-red-600')}>
                {cajaDiff > 0 ? '+' : ''}{formatPrice(cajaDiff, currency)}
              </p>
              <p className="text-[10px] text-gray-400 mt-0.5">Diferencia total</p>
            </div>
          </div>
          <div className="space-y-2">
            {cajaInRange.slice(-5).reverse().map(s => (
              <div key={s.id} className="flex items-center justify-between py-1.5 border-t border-gray-50 first:border-0 text-xs">
                <div className="flex items-center gap-2">
                  <div className={cn('h-2 w-2 rounded-full', s.status === 'open' ? 'bg-emerald-400 animate-pulse' : 'bg-gray-300')} />
                  <span className="text-gray-600">{new Date(s.opened_at).toLocaleDateString('es-UY', { day: '2-digit', month: 'short' })}</span>
                  {s.status === 'open' && <span className="text-emerald-600 font-semibold">Abierta</span>}
                </div>
                <div className="flex items-center gap-3 text-right">
                  {s.closing_amount !== null && (
                    <span className="font-semibold text-gray-800">{formatPrice(s.closing_amount, currency)}</span>
                  )}
                  {s.difference !== null && (
                    <span className={cn('font-bold', Math.abs(s.difference) < 1 ? 'text-gray-400' : s.difference > 0 ? 'text-blue-600' : 'text-red-500')}>
                      {s.difference > 0 ? '+' : ''}{formatPrice(s.difference, currency)}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Descuentos */}
      {discountOrders.length > 0 && (
        <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
          <div className="flex items-center gap-2 mb-5">
            <div className="h-8 w-8 rounded-xl flex items-center justify-center bg-pink-50">
              <Tag size={15} className="text-pink-600" />
            </div>
            <p className="text-sm font-bold text-gray-900">Descuentos y cupones</p>
          </div>
          <div className="grid grid-cols-3 gap-3 mb-4">
            <div className="rounded-xl bg-gray-50 p-3 text-center">
              <p className="text-lg font-black text-gray-900">{discountOrders.length}</p>
              <p className="text-[10px] text-gray-400 mt-0.5">Pedidos con descuento</p>
            </div>
            <div className="rounded-xl bg-pink-50 p-3 text-center">
              <p className="text-lg font-black text-pink-700">−{formatPrice(totalDiscounts, currency)}</p>
              <p className="text-[10px] text-gray-400 mt-0.5">Total descontado</p>
            </div>
            <div className="rounded-xl bg-gray-50 p-3 text-center">
              <p className="text-lg font-black text-gray-900">
                {currOrders > 0 ? Math.round((discountOrders.length / currOrders) * 100) : 0}%
              </p>
              <p className="text-[10px] text-gray-400 mt-0.5">% pedidos con promo</p>
            </div>
          </div>
          {topCoupons.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-3">Cupones usados</p>
              {topCoupons.map(({ code, count, total }) => (
                <div key={code} className="flex items-center justify-between py-1.5 border-t border-gray-50 first:border-0 text-xs">
                  <div className="flex items-center gap-2">
                    <span className="rounded-lg bg-pink-50 px-2 py-0.5 text-[11px] font-bold text-pink-700 uppercase tracking-wide">
                      {code}
                    </span>
                    <span className="text-gray-400">{count} uso{count !== 1 ? 's' : ''}</span>
                  </div>
                  <span className="font-semibold text-pink-600">−{formatPrice(total, currency)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Rentabilidad */}
      {(hasCOGS || opCosts > 0) && (
        <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
          <div className="flex items-center gap-2 mb-5">
            <div className="h-8 w-8 rounded-xl flex items-center justify-center"
              style={{ background: '#10B98118' }}>
              <DollarSign size={15} className="text-emerald-600" />
            </div>
            <p className="text-sm font-bold text-gray-900">Rentabilidad</p>
          </div>


          <div className="space-y-3">
            {/* Ingresos */}
            <div className="flex items-center justify-between py-2">
              <span className="text-sm text-gray-600">Ingresos confirmados</span>
              <span className="text-sm font-bold text-gray-900">{formatPrice(currRevenue, currency)}</span>
            </div>

            {/* CMV */}
            {hasCOGS && (
              <div className="flex items-center justify-between py-2 border-t border-gray-50">
                <div>
                  <span className="text-sm text-gray-600">CMV (costo de ventas)</span>
                  <p className="text-[10px] text-gray-400">Basado en costo × cantidad vendida</p>
                </div>
                <span className="text-sm font-semibold text-red-500">−{formatPrice(cogs, currency)}</span>
              </div>
            )}

            {/* Gross margin */}
            {hasCOGS && (
              <div className="flex items-center justify-between rounded-xl py-3 px-4"
                style={{ background: grossProfit >= 0 ? '#F0FDF4' : '#FEF2F2' }}>
                <div>
                  <p className="text-sm font-bold text-gray-800">Margen bruto</p>
                  <p className="text-xs text-gray-500">{grossMarginPct}% del total</p>
                </div>
                <p className={cn(
                  'text-lg font-black',
                  grossProfit >= 0 ? 'text-emerald-600' : 'text-red-600'
                )}>
                  {formatPrice(grossProfit, currency)}
                </p>
              </div>
            )}

            {/* Costos operativos */}
            {opCosts > 0 && (
              <div className="flex items-center justify-between py-2 border-t border-gray-50">
                <div>
                  <span className="text-sm text-gray-600">Costos operativos</span>
                  <p className="text-[10px] text-gray-400">Gastos del período registrados en Costos</p>
                </div>
                <span className="text-sm font-semibold text-amber-600">−{formatPrice(opCosts, currency)}</span>
              </div>
            )}

            {/* Net margin */}
            {(hasCOGS || opCosts > 0) && (
              <div className="flex items-center justify-between rounded-xl py-3 px-4 mt-1"
                style={{ background: netProfit >= 0 ? '#EFF6FF' : '#FEF2F2' }}>
                <div>
                  <p className="text-sm font-bold text-gray-800">Resultado neto</p>
                  <p className="text-xs text-gray-500">{netMarginPct}% del total</p>
                </div>
                <p className={cn(
                  'text-lg font-black',
                  netProfit >= 0 ? 'text-blue-600' : 'text-red-600'
                )}>
                  {formatPrice(netProfit, currency)}
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      </PlanGate>

    </div>
  )
}

// ── Delta Badge ───────────────────────────────────────────────
function DeltaBadge({ delta }: { delta: number }) {
  if (delta === 0) return (
    <span className="flex items-center gap-0.5 text-[10px] font-semibold text-gray-400">
      <Minus size={10} /> 0%
    </span>
  )
  const up = delta > 0
  return (
    <span className={cn(
      'flex items-center gap-0.5 text-[10px] font-bold rounded-full px-1.5 py-0.5',
      up ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'
    )}>
      {up ? <ArrowUpRight size={10} /> : <ArrowDownRight size={10} />}
      {Math.abs(delta)}%
    </span>
  )
}
