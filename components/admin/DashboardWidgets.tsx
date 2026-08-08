'use client'
// Todos los widgets del dashboard — cada uno fetcha sus propios datos
import { useState, useEffect, useMemo } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { useVertical } from '@/lib/vertical-context'
import { getBookingLabel } from '@/lib/verticals'
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts'
import {
  ShoppingBag, Users, Wallet, AlertTriangle, TrendingDown,
  Zap, Loader2, Package, ChefHat, CalendarDays, Scan, BarChart2,
  CheckCircle2, Clock, Target, MessageCircle, Home, TrendingUp,
  Calendar, CalendarCheck,
} from 'lucide-react'
import { formatPrice } from '@/lib/utils'
import { orderStatusColor, orderStatusLabel } from '@/lib/utils'
import QuickNotesWidget from './QuickNotesWidget'
import AiInsightsWidget from './AiInsightsWidget'

// ── Shared ────────────────────────────────────────────────────
function WidgetSkeleton() {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm">
      <div className="h-4 w-32 bg-gray-100 rounded animate-pulse mb-3" />
      <div className="space-y-2">
        <div className="h-3 w-full bg-gray-100 rounded animate-pulse" />
        <div className="h-3 w-3/4 bg-gray-100 rounded animate-pulse" />
      </div>
    </div>
  )
}

function WidgetEmpty({ message }: { message: string }) {
  return <p className="text-xs text-gray-400 text-center py-4">{message}</p>
}

// Link al pie del widget — separador + enlace alineado a la derecha
function WidgetFooterLink({ href, label, color }: { href: string; label: string; color: string }) {
  return (
    <div className="mt-3 pt-2.5 border-t border-gray-50 flex justify-end">
      <Link href={href} className="text-xs font-semibold transition-opacity hover:opacity-70" style={{ color }}>
        {label} →
      </Link>
    </div>
  )
}

// ── 1. Gráfico de ventas ──────────────────────────────────────
export function SalesChartWidget() {
  const { businessId, currency, color } = useVertical()
  const supabase = createClient()
  const [chartData, setChartData] = useState<{ label: string; ventas: number }[]>([])
  const [total,     setTotal]     = useState(0)
  const [loading,   setLoading]   = useState(true)

  useEffect(() => {
    const today = new Date().toISOString().split('T')[0]
    supabase
      .from('orders')
      .select('created_at, total')
      .eq('business_id', businessId)
      .eq('confirmed_sale', true)
      .gte('created_at', today + 'T00:00:00')
      .then(({ data }) => {
        const orders = data ?? []
        setTotal(orders.reduce((s, o) => s + o.total, 0))
        const base = new Date(); base.setHours(0, 0, 0, 0)
        setChartData(Array.from({ length: 12 }, (_, i) => {
          const from = new Date(base); from.setHours(i * 2)
          const to   = new Date(base); to.setHours(i * 2 + 2)
          return {
            label: `${i * 2}h`,
            ventas: orders.filter(o => {
              const d = new Date(o.created_at); return d >= from && d < to
            }).reduce((s, o) => s + o.total, 0),
          }
        }))
        setLoading(false)
      })
  }, [businessId])

  if (loading) return <WidgetSkeleton />

  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm">
      <div className="flex items-center justify-between mb-3">
        <p className="text-sm font-semibold text-gray-900">Ventas · Hoy</p>
        <p className="text-sm font-bold text-gray-900">{formatPrice(total, currency)}</p>
      </div>
      {chartData.every(p => p.ventas === 0) ? (
        <WidgetEmpty message="Sin ventas confirmadas hoy" />
      ) : (
        <ResponsiveContainer width="100%" height={110}>
          <AreaChart data={chartData} margin={{ top: 0, right: 0, left: -38, bottom: 0 }}>
            <defs>
              <linearGradient id="wGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%"   stopColor={color} stopOpacity={0.22} />
                <stop offset="100%" stopColor={color} stopOpacity={0}    />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" vertical={false} />
            <XAxis dataKey="label" tick={{ fontSize: 9, fill: '#9CA3AF' }}
              axisLine={false} tickLine={false} interval={2} />
            <YAxis tick={{ fontSize: 9, fill: '#9CA3AF' }} axisLine={false} tickLine={false}
              tickFormatter={v => v === 0 ? '' : formatPrice(v, currency).replace(/[^0-9K]/g, '')} />
            <Tooltip
              content={({ active, payload, label }) =>
                active && payload?.length ? (
                  <div className="rounded-xl bg-white border border-gray-100 shadow-lg px-3 py-2 text-xs">
                    <p className="text-gray-500 mb-0.5">{label}</p>
                    <p style={{ color }}>{formatPrice(payload[0].value as number, currency)}</p>
                  </div>
                ) : null
              }
            />
            <Area type="monotone" dataKey="ventas" stroke={color} strokeWidth={2}
              fill="url(#wGrad)" dot={false} activeDot={{ r: 3, fill: color }} />
          </AreaChart>
        </ResponsiveContainer>
      )}
    </div>
  )
}

// ── 2. Resumen de costos ──────────────────────────────────────
export function CostsSummaryWidget() {
  const { businessId, currency, color } = useVertical()
  const supabase = createClient()
  const [costs,   setCosts]   = useState<{ name: string; amount: number; type: string }[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const monthStart = new Date(); monthStart.setDate(1); monthStart.setHours(0, 0, 0, 0)
    supabase
      .from('business_costs')
      .select('name, amount, type')
      .eq('business_id', businessId)
      .gte('date', monthStart.toISOString().split('T')[0])
      .order('amount', { ascending: false })
      .limit(5)
      .then(({ data }) => { setCosts(data ?? []); setLoading(false) })
  }, [businessId])

  if (loading) return <WidgetSkeleton />

  const total = costs.reduce((s, c) => s + c.amount, 0)

  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm">
      <p className="text-sm font-semibold text-gray-900 mb-3">Costos del mes</p>
      {costs.length === 0 ? (
        <WidgetEmpty message="Sin costos registrados este mes" />
      ) : (
        <>
          <p className="text-2xl font-bold text-gray-900 mb-3">{formatPrice(total, currency)}</p>
          <div className="space-y-2">
            {costs.map((c, i) => (
              <div key={i} className="flex items-center justify-between">
                <div className="flex items-center gap-2 min-w-0">
                  <div className="h-1.5 w-1.5 rounded-full shrink-0" style={{ background: color }} />
                  <span className="text-xs text-gray-600 truncate">{c.name}</span>
                </div>
                <span className="text-xs font-medium text-gray-800 shrink-0 ml-2">
                  {formatPrice(c.amount, currency)}
                </span>
              </div>
            ))}
          </div>
        </>
      )}
      <WidgetFooterLink href="/admin/costs" label="Ver costos" color={color} />
    </div>
  )
}

// ── 3. Stock bajo ─────────────────────────────────────────────
export function LowStockWidget() {
  const { businessId, color } = useVertical()
  const supabase = createClient()
  const [items,   setItems]   = useState<{ name: string; stock_current: number; stock_min: number; unit: string }[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase
      .from('inventory_items')
      .select('name, stock_current, stock_min, unit')
      .eq('business_id', businessId)
      .eq('active', true)
      .order('stock_current')
      .limit(6)
      .then(({ data }) => {
        setItems((data ?? []).filter(i => i.stock_current <= i.stock_min))
        setLoading(false)
      })
  }, [businessId])

  if (loading) return <WidgetSkeleton />

  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm">
      <p className="text-sm font-semibold text-gray-900 mb-3">Stock bajo</p>
      {items.length === 0 ? (
        <div className="flex items-center gap-2 py-2">
          <div className="h-7 w-7 rounded-lg bg-green-100 flex items-center justify-center">
            <Package size={13} className="text-green-600" />
          </div>
          <p className="text-xs text-gray-500">Todo el stock está en niveles normales</p>
        </div>
      ) : (
        <div className="space-y-2">
          {items.map((item, i) => {
            const critical = item.stock_current <= 0
            return (
              <div key={i} className="flex items-center gap-3">
                <div className={`h-6 w-6 rounded-lg flex items-center justify-center shrink-0 ${
                  critical ? 'bg-red-100' : 'bg-yellow-100'
                }`}>
                  <AlertTriangle size={11} className={critical ? 'text-red-500' : 'text-yellow-600'} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-gray-800 truncate">{item.name}</p>
                  <p className="text-[10px] text-gray-400">
                    {item.stock_current} {item.unit} · mín {item.stock_min}
                  </p>
                </div>
                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
                  critical ? 'bg-red-100 text-red-600' : 'bg-yellow-100 text-yellow-700'
                }`}>
                  {critical ? 'Sin stock' : 'Bajo'}
                </span>
              </div>
            )
          })}
        </div>
      )}
      <WidgetFooterLink href="/admin/inventory" label="Ver inventario" color={color} />
    </div>
  )
}

// ── 4. Últimos pedidos ────────────────────────────────────────
export function RecentOrdersWidget() {
  const { businessId, currency, color } = useVertical()
  const supabase = createClient()
  const [orders,  setOrders]  = useState<{ id: string; order_number: number; customer_name: string; total: number; status: string }[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase
      .from('orders')
      .select('id, order_number, customer_name, total, status')
      .eq('business_id', businessId)
      .order('created_at', { ascending: false })
      .limit(5)
      .then(({ data }) => { setOrders(data ?? []); setLoading(false) })

    // Sufijo random: evita colisión de nombre de canal cuando el widget
    // se monta dos veces a la vez (grilla + DragOverlay durante el drag).
    const ch = supabase.channel(`widget-orders-${businessId}-${Math.random().toString(36).slice(2)}`)
      .on('postgres_changes', {
        event: '*', schema: 'public', table: 'orders',
        filter: `business_id=eq.${businessId}`,
      }, () => {
        supabase.from('orders')
          .select('id, order_number, customer_name, total, status')
          .eq('business_id', businessId)
          .order('created_at', { ascending: false })
          .limit(5)
          .then(({ data }) => setOrders(data ?? []))
      })
      .subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [businessId])

  if (loading) return <WidgetSkeleton />

  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm">
      <p className="text-sm font-semibold text-gray-900 mb-3">Últimos pedidos</p>
      {orders.length === 0 ? (
        <div className="py-4 text-center">
          <ShoppingBag size={18} className="mx-auto text-gray-200 mb-1" />
          <WidgetEmpty message="Sin pedidos todavía" />
        </div>
      ) : (
        <div className="divide-y divide-gray-50">
          {orders.map(o => (
            <Link key={o.id} href={`/admin/orders/${o.id}`}
              className="flex items-center gap-3 py-2.5 hover:bg-gray-50/60 rounded-xl
                         px-1 -mx-1 transition-colors">
              <div className="h-7 w-7 rounded-xl shrink-0 flex items-center justify-center
                              text-xs font-bold text-white" style={{ background: color }}>
                {o.customer_name.slice(0, 1).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-gray-800 truncate">{o.customer_name}</p>
                <p className="text-[10px] text-gray-400">#{String(o.order_number).padStart(4, '0')}</p>
              </div>
              <div className="text-right shrink-0">
                <p className="text-xs font-bold text-gray-900">{formatPrice(o.total, currency)}</p>
                <span className={`text-[9px] font-semibold px-1.5 py-0.5 rounded-full ${orderStatusColor(o.status)}`}>
                  {orderStatusLabel(o.status)}
                </span>
              </div>
            </Link>
          ))}
        </div>
      )}
      <WidgetFooterLink href="/admin/orders" label="Ver todos los pedidos" color={color} />
    </div>
  )
}

// ── 5. Clientes nuevos ────────────────────────────────────────
export function NewCustomersWidget() {
  const { businessId, color } = useVertical()
  const supabase = createClient()
  const [count,   setCount]   = useState<number | null>(null)
  const [recents, setRecents] = useState<{ name: string }[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const monthStart = new Date(); monthStart.setDate(1); monthStart.setHours(0, 0, 0, 0)
    Promise.all([
      supabase.from('customers')
        .select('id', { count: 'exact', head: true })
        .eq('business_id', businessId)
        .gte('created_at', monthStart.toISOString()),
      supabase.from('customers')
        .select('name')
        .eq('business_id', businessId)
        .gte('created_at', monthStart.toISOString())
        .order('created_at', { ascending: false })
        .limit(4),
    ]).then(([countRes, recentsRes]) => {
      setCount(countRes.count ?? 0)
      setRecents(recentsRes.data ?? [])
      setLoading(false)
    })
  }, [businessId])

  if (loading) return <WidgetSkeleton />

  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm">
      <p className="text-sm font-semibold text-gray-900 mb-3">Clientes nuevos</p>
      <div className="flex items-baseline gap-2 mb-3">
        <p className="text-3xl font-bold text-gray-900">{count}</p>
        <p className="text-xs text-gray-400">este mes</p>
      </div>
      {recents.length > 0 && (
        <div className="space-y-2">
          {recents.map((c, i) => (
            <div key={i} className="flex items-center gap-2">
              <div className="h-6 w-6 rounded-full shrink-0 flex items-center justify-center
                              text-[10px] font-bold text-white" style={{ background: color }}>
                {c.name.slice(0, 1).toUpperCase()}
              </div>
              <p className="text-xs font-medium text-gray-700 truncate">{c.name}</p>
            </div>
          ))}
        </div>
      )}
      {count === 0 && <WidgetEmpty message="Sin clientes nuevos este mes" />}
      <WidgetFooterLink href="/admin/customers" label="Ver clientes" color={color} />
    </div>
  )
}

// ── 6. Notas rápidas (carrusel) ───────────────────────────────
export function QuickNoteWidget() {
  return <QuickNotesWidget />
}

// ── 7. Saldo de caja ─────────────────────────────────────────
export function CashBalanceWidget() {
  const { businessId, currency, color } = useVertical()
  const supabase = createClient()
  const [balance, setBalance] = useState<number | null>(null)
  const [status,  setStatus]  = useState<'open' | 'closed' | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase
      .from('cash_registers')
      .select('status, opening_amount')
      .eq('business_id', businessId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()
      .then(async ({ data: reg }) => {
        if (!reg || reg.status !== 'open') {
          setStatus('closed'); setLoading(false); return
        }
        setStatus('open')
        const today = new Date().toISOString().split('T')[0]
        const { data: movements } = await supabase
          .from('cash_movements')
          .select('type, amount')
          .eq('business_id', businessId)
          .gte('created_at', today + 'T00:00:00')
        const delta = (movements ?? []).reduce((s, m) =>
          s + (m.type === 'ingreso' ? m.amount : -m.amount), 0)
        setBalance((reg.opening_amount ?? 0) + delta)
        setLoading(false)
      })
  }, [businessId])

  if (loading) return <WidgetSkeleton />

  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm">
      <p className="text-sm font-semibold text-gray-900 mb-3">Saldo de caja</p>
      {status === 'closed' ? (
        <div className="flex items-center gap-3 py-1">
          <div className="h-9 w-9 rounded-xl bg-gray-100 flex items-center justify-center">
            <Wallet size={16} className="text-gray-400" />
          </div>
          <div>
            <p className="text-sm font-semibold text-gray-500">Caja cerrada</p>
            <p className="text-xs text-gray-400">Abrí la caja para ver el saldo</p>
          </div>
        </div>
      ) : (
        <div>
          <p className="text-3xl font-bold text-gray-900 mb-1">
            {balance !== null ? formatPrice(balance, currency) : '—'}
          </p>
          <div className="flex items-center gap-1.5">
            <div className="h-2 w-2 rounded-full bg-green-500" />
            <p className="text-xs text-green-600 font-medium">Caja abierta</p>
          </div>
        </div>
      )}
      <WidgetFooterLink href="/admin/caja" label="Ver caja" color={color} />
    </div>
  )
}

// ── 8. Accesos directos ───────────────────────────────────────
export function ShortcutsWidget() {
  const { group, color } = useVertical()

  const links: { label: string; href: string; icon: React.ElementType }[] = useMemo(() => {
    switch (group) {
      case 'gastro': return [
        { label: 'Pedidos',  href: '/admin/orders',    icon: ShoppingBag  },
        { label: 'Cocina',   href: '/admin/gastro',    icon: ChefHat      },
        { label: 'Clientes', href: '/admin/customers', icon: Users        },
        { label: 'Reportes', href: '/admin/analytics', icon: BarChart2    },
      ]
      case 'servicios': return [
        { label: 'Agenda',    href: '/admin/servicios', icon: CalendarDays },
        { label: 'Servicios', href: '/admin/products',  icon: Package      },
        { label: 'Clientes',  href: '/admin/customers', icon: Users        },
        { label: 'Reportes',  href: '/admin/analytics', icon: BarChart2    },
      ]
      case 'mercados': return [
        { label: 'POS',        href: '/admin/mercados',  icon: Scan     },
        { label: 'Inventario', href: '/admin/inventory', icon: Package  },
        { label: 'Clientes',   href: '/admin/customers', icon: Users    },
        { label: 'Caja',       href: '/admin/caja',      icon: Wallet   },
      ]
      default: return [ // comercio
        { label: 'Pedidos',   href: '/admin/orders',    icon: ShoppingBag },
        { label: 'Productos', href: '/admin/products',  icon: Package     },
        { label: 'Clientes',  href: '/admin/customers', icon: Users       },
        { label: 'Reportes',  href: '/admin/analytics', icon: BarChart2   },
      ]
    }
  }, [group])

  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm">
      <p className="text-sm font-semibold text-gray-900 mb-3">Accesos directos</p>
      <div className="grid grid-cols-4 gap-2">
        {links.map(l => {
          const Icon = l.icon
          return (
            <Link key={l.href} href={l.href}
              className="flex flex-col items-center gap-1.5 p-3 rounded-xl
                         hover:bg-gray-50 transition-all text-center group">
              <div className="h-9 w-9 rounded-xl flex items-center justify-center transition-all
                              bg-gray-100 group-hover:bg-blue-50">
                <Icon size={16} className="text-gray-500 group-hover:text-blue-600 transition-colors" />
              </div>
              <p className="text-[10px] font-medium text-gray-600 leading-tight">{l.label}</p>
            </Link>
          )
        })}
      </div>
    </div>
  )
}

// ── Helpers internos de bookings ──────────────────────────────
function todayStr() { return new Date().toISOString().split('T')[0] }
function in7daysStr() { return new Date(Date.now() + 7 * 864e5).toISOString().split('T')[0] }

function bookingPeriodRange(period: 'today' | '7d' | '30d'): { from: string; to: string } {
  const today = todayStr()
  if (period === 'today') return { from: today, to: today }
  const days = period === '7d' ? 6 : 29
  const from = new Date(Date.now() - days * 864e5).toISOString().split('T')[0]
  return { from, to: today }
}

function dateDisplayLabel(dateStr: string): string {
  const today    = todayStr()
  const tomorrow = new Date(Date.now() + 864e5).toISOString().split('T')[0]
  const d = new Date(dateStr + 'T12:00:00')
  const short = d.toLocaleDateString('es-AR', { weekday: 'short', day: 'numeric', month: 'short' })
  if (dateStr === today)    return `Hoy · ${short}`
  if (dateStr === tomorrow) return `Mañana · ${short}`
  return short.charAt(0).toUpperCase() + short.slice(1)
}

// ── 9. Agenda de hoy (servicios) ──────────────────────────────
interface TodayBooking { id: string; status: string; price: number | null; start_time: string; customer_name: string }

export function BookingsTodayKPIWidget() {
  const { businessId, verticalSub, currency, color } = useVertical()
  const supabase = createClient()
  const [bookings, setBookings] = useState<TodayBooking[]>([])
  const [loading,  setLoading]  = useState(true)

  useEffect(() => {
    supabase.from('bookings')
      .select('id, status, price, start_time, customer_name')
      .eq('business_id', businessId)
      .eq('date', todayStr())
      .order('start_time')
      .then(({ data }) => { setBookings(data ?? []); setLoading(false) })
  }, [businessId])

  if (loading) return <WidgetSkeleton />

  const active    = bookings.filter(b => b.status !== 'cancelled' && b.status !== 'noshow')
  const confirmed = bookings.filter(b => b.status === 'confirmed')
  const pending   = bookings.filter(b => b.status === 'pending')
  const revenue   = bookings.filter(b => b.status === 'done').reduce((s, b) => s + (b.price ?? 0), 0)
  const { plural } = getBookingLabel(verticalSub)
  const cap = plural.charAt(0).toUpperCase() + plural.slice(1)

  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm">
      <p className="text-sm font-semibold text-gray-900 mb-3">{cap} de hoy</p>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: cap + ' activos',  value: active.length,                     iconColor: color },
          { label: 'Confirmados',      value: confirmed.length,                  iconColor: '#10B981' },
          { label: 'Pendientes',       value: pending.length,                    iconColor: '#F59E0B' },
          { label: 'Ingresos del día', value: formatPrice(revenue, currency),    iconColor: '#8B5CF6' },
        ].map(({ label, value, iconColor }) => (
          <div key={label} className="bg-gray-50 rounded-xl p-3">
            <p className="text-lg font-bold text-gray-900" style={{ color: iconColor }}>{value}</p>
            <p className="text-[11px] text-gray-500 mt-0.5 leading-tight">{label}</p>
          </div>
        ))}
      </div>
      <WidgetFooterLink href="/admin/servicios" label={`Ver agenda de ${plural}`} color={color} />
    </div>
  )
}

// ── 10. Ingresos del período (servicios) ─────────────────────
type BookingPeriod = 'today' | '7d' | '30d'
const BOOKING_PERIODS: { key: BookingPeriod; label: string }[] = [
  { key: 'today', label: 'Hoy'       },
  { key: '7d',   label: '7 días'    },
  { key: '30d',  label: '30 días'   },
]
interface DoneBooking { id: string; price: number | null; date: string }

export function BookingsRevenueKPIWidget() {
  const { businessId, verticalSub, currency, color } = useVertical()
  const supabase = createClient()
  const [allDone, setAllDone]   = useState<DoneBooking[]>([])
  const [period,  setPeriod]    = useState<BookingPeriod>('7d')
  const [loading, setLoading]   = useState(true)

  useEffect(() => {
    const thirtyAgo = new Date(Date.now() - 29 * 864e5).toISOString().split('T')[0]
    supabase.from('bookings')
      .select('id, price, date')
      .eq('business_id', businessId)
      .eq('status', 'done')
      .gte('date', thirtyAgo)
      .then(({ data }) => { setAllDone(data ?? []); setLoading(false) })
  }, [businessId])

  if (loading) return <WidgetSkeleton />

  const { from, to } = bookingPeriodRange(period)
  const inPeriod  = allDone.filter(b => b.date >= from && b.date <= to)
  const revenue   = inPeriod.reduce((s, b) => s + (b.price ?? 0), 0)
  const avg       = inPeriod.length > 0 ? revenue / inPeriod.length : 0
  const { plural } = getBookingLabel(verticalSub)
  const periodLabel = BOOKING_PERIODS.find(p => p.key === period)?.label ?? ''

  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm">
      <div className="flex items-center justify-between mb-3">
        <p className="text-sm font-semibold text-gray-900">Ingresos</p>
        <div className="flex gap-1">
          {BOOKING_PERIODS.map(p => (
            <button key={p.key} onClick={() => setPeriod(p.key)}
              className="px-2 py-0.5 rounded-lg text-[11px] font-medium transition-all"
              style={period === p.key
                ? { background: color + '18', color }
                : { color: '#9CA3AF' }}>
              {p.label}
            </button>
          ))}
        </div>
      </div>
      <p className="text-3xl font-bold text-gray-900">{formatPrice(revenue, currency)}</p>
      <p className="text-xs text-gray-400 mt-0.5">{inPeriod.length} {plural} · {periodLabel}</p>
      {inPeriod.length > 0 && (
        <p className="text-xs text-gray-500 mt-1">
          Ticket promedio: <span className="font-semibold">{formatPrice(avg, currency)}</span>
        </p>
      )}
      <WidgetFooterLink href="/admin/analytics" label="Ver reportes" color={color} />
    </div>
  )
}

// ── 11. Gráfico de ingresos por bookings ─────────────────────
interface BookingPoint { date: string; price: number | null }

export function BookingsChartWidget() {
  const { businessId, currency, color } = useVertical()
  const supabase = createClient()
  const [data,    setData]    = useState<{ label: string; ingresos: number }[]>([])
  const [total,   setTotal]   = useState(0)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const thirtyAgo = new Date(Date.now() - 29 * 864e5).toISOString().split('T')[0]
    supabase.from('bookings')
      .select('date, price')
      .eq('business_id', businessId)
      .eq('status', 'done')
      .gte('date', thirtyAgo)
      .then(({ data: rows }) => {
        const bookings = (rows ?? []) as BookingPoint[]
        setTotal(bookings.reduce((s, b) => s + (b.price ?? 0), 0))
        const base = new Date(); base.setHours(0, 0, 0, 0)
        setData(Array.from({ length: 30 }, (_, i) => {
          const d   = new Date(base); d.setDate(d.getDate() - (29 - i))
          const ds  = d.toISOString().split('T')[0]
          return {
            label:    d.toLocaleDateString('es-AR', { day: 'numeric', month: 'short' }),
            ingresos: bookings.filter(b => b.date === ds).reduce((s, b) => s + (b.price ?? 0), 0),
          }
        }))
        setLoading(false)
      })
  }, [businessId])

  if (loading) return <WidgetSkeleton />

  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm">
      <div className="flex items-center justify-between mb-3">
        <p className="text-sm font-semibold text-gray-900">Ingresos · 30 días</p>
        <p className="text-sm font-bold text-gray-900">{formatPrice(total, currency)}</p>
      </div>
      {data.every(p => p.ingresos === 0) ? (
        <WidgetEmpty message="Sin ingresos registrados este mes" />
      ) : (
        <ResponsiveContainer width="100%" height={110}>
          <AreaChart data={data} margin={{ top: 0, right: 0, left: -38, bottom: 0 }}>
            <defs>
              <linearGradient id="bkGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%"   stopColor={color} stopOpacity={0.2} />
                <stop offset="100%" stopColor={color} stopOpacity={0}   />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" vertical={false} />
            <XAxis dataKey="label" tick={{ fontSize: 9, fill: '#9CA3AF' }}
              axisLine={false} tickLine={false} interval={5} />
            <YAxis tick={{ fontSize: 9, fill: '#9CA3AF' }} axisLine={false} tickLine={false}
              tickFormatter={v => v === 0 ? '' : '$' + Math.round(v / 1000) + 'k'} />
            <Tooltip content={({ active, payload, label }) =>
              active && payload?.length ? (
                <div className="rounded-xl bg-white border border-gray-100 shadow-lg px-3 py-2 text-xs">
                  <p className="text-gray-500 mb-0.5">{label}</p>
                  <p style={{ color }}>{formatPrice(payload[0].value as number, currency)}</p>
                </div>
              ) : null
            } />
            <Area type="monotone" dataKey="ingresos" stroke={color} strokeWidth={2}
              fill="url(#bkGrad)" dot={false} activeDot={{ r: 3, fill: color }} />
          </AreaChart>
        </ResponsiveContainer>
      )}
    </div>
  )
}

// ── 12. Próxima agenda (servicios) ────────────────────────────
interface AgendaBooking {
  id: string; customer_name: string; customer_phone?: string | null
  date: string; start_time: string; end_time: string
  price: number | null; staff_id?: string | null
  product: { name: string } | null
  staff: { name: string; color: string } | null
}

export function UpcomingAgendaWidget() {
  const { businessId, verticalSub, currency, color } = useVertical()
  const supabase = createClient()
  const [bookings, setBookings] = useState<AgendaBooking[]>([])
  const [loading,  setLoading]  = useState(true)

  useEffect(() => {
    supabase.from('bookings')
      .select('id, customer_name, customer_phone, date, start_time, end_time, price, staff_id, product:products(name), staff:staff(name, color)')
      .eq('business_id', businessId)
      .gte('date', todayStr())
      .lte('date', in7daysStr())
      .neq('status', 'cancelled')
      .neq('status', 'noshow')
      .order('date')
      .order('start_time')
      .limit(30)
      .then(({ data }) => {
        setBookings((data ?? []) as unknown as AgendaBooking[])
        setLoading(false)
      })
  }, [businessId])

  // Todos los hooks antes de cualquier return condicional
  const { plural } = getBookingLabel(verticalSub)

  const byDate = useMemo(() => {
    const groups: Record<string, AgendaBooking[]> = {}
    bookings.forEach(b => { if (!groups[b.date]) groups[b.date] = []; groups[b.date].push(b) })
    return Object.entries(groups).sort(([a], [b]) => a.localeCompare(b))
  }, [bookings])

  if (loading) return <WidgetSkeleton />

  return (
    <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden shadow-sm">
      <div className="px-4 py-3.5 border-b border-gray-100 flex items-center justify-between">
        <div>
          <p className="text-sm font-semibold text-gray-900">Próxima agenda</p>
          <p className="text-xs text-gray-400 mt-0.5">
            {bookings.length === 0
              ? `Sin ${plural} agendados`
              : `${bookings.length} ${plural} · próximos 7 días`}
          </p>
        </div>
        <Link href="/admin/servicios" className="text-xs font-semibold" style={{ color }}>
          Ver agenda →
        </Link>
      </div>

      {bookings.length === 0 ? (
        <div className="px-4 py-8 text-center">
          <CalendarDays size={28} className="mx-auto text-gray-200 mb-2" />
          <p className="text-sm text-gray-400">Sin {plural} próximos</p>
        </div>
      ) : (
        <div className="max-h-[320px] overflow-y-auto divide-y divide-gray-50">
          {byDate.map(([date, items]) => (
            <div key={date}>
              <div className="px-4 py-1.5 bg-gray-50/70">
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wide">
                  {dateDisplayLabel(date)}
                </p>
              </div>
              {items.map(b => (
                <div key={b.id}
                  className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50/60 transition-colors">
                  <div className="w-10 shrink-0 text-center">
                    <p className="text-xs font-bold text-gray-800">{b.start_time.slice(0, 5)}</p>
                    <p className="text-[10px] text-gray-400">{b.end_time.slice(0, 5)}</p>
                  </div>
                  <div className="h-7 w-7 rounded-lg flex items-center justify-center shrink-0 text-white text-[11px] font-bold"
                    style={{ background: b.staff?.color ?? color }}>
                    {b.customer_name.slice(0, 1).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-gray-900 truncate">{b.customer_name}</p>
                    <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                      {b.product?.name && (
                        <span className="text-[10px] text-gray-400 truncate">{b.product.name}</span>
                      )}
                      {b.staff?.name && (
                        <span className="text-[10px] text-gray-300">· {b.staff.name}</span>
                      )}
                    </div>
                  </div>
                  {b.price != null && b.price > 0 && (
                    <p className="text-xs font-semibold text-gray-700 shrink-0 hidden sm:block">
                      {formatPrice(b.price, currency)}
                    </p>
                  )}
                </div>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ── 13. Staff activo (servicios) ──────────────────────────────
interface StaffMember { id: string; name: string; color: string; role: string }

export function ActiveStaffWidget() {
  const { businessId, color } = useVertical()
  const supabase = createClient()
  const [staff,   setStaff]   = useState<StaffMember[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.from('staff')
      .select('id, name, color, role')
      .eq('business_id', businessId)
      .eq('active', true)
      .order('name')
      .then(({ data }) => { setStaff(data ?? []); setLoading(false) })
  }, [businessId])

  if (loading) return <WidgetSkeleton />

  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm">
      <p className="text-sm font-semibold text-gray-900 mb-3">
        Equipo activo
        {staff.length > 0 && (
          <span className="ml-2 text-xs font-normal text-gray-400">{staff.length} integrantes</span>
        )}
      </p>
      {staff.length === 0 ? (
        <WidgetEmpty message="Sin integrantes activos" />
      ) : (
        <div className="flex flex-wrap gap-2.5">
          {staff.map(s => (
            <div key={s.id} className="flex items-center gap-2 bg-gray-50 rounded-xl px-3 py-2">
              <div className="h-7 w-7 rounded-lg flex items-center justify-center text-white text-xs font-bold shrink-0"
                style={{ background: s.color }}>
                {s.name.slice(0, 1).toUpperCase()}
              </div>
              <div>
                <p className="text-xs font-semibold text-gray-900 leading-none">{s.name}</p>
                <p className="text-[10px] text-gray-400 mt-0.5 capitalize">{s.role}</p>
              </div>
            </div>
          ))}
        </div>
      )}
      <WidgetFooterLink href="/admin/settings" label="Gestionar equipo" color={color} />
    </div>
  )
}

// ── 14. KPI de leads (real_estate) ────────────────────────────
export function LeadsKPIWidget() {
  const { businessId, color } = useVertical()
  const supabase = createClient()
  const [totalLeads,  setTotalLeads]  = useState<number>(0)
  const [weekLeads,   setWeekLeads]   = useState<number>(0)
  const [properties,  setProperties]  = useState<number>(0)
  const [loading,     setLoading]     = useState(true)

  useEffect(() => {
    const weekAgo = new Date(Date.now() - 7 * 864e5).toISOString()
    Promise.all([
      supabase.from('leads').select('id', { count: 'exact', head: true }).eq('business_id', businessId),
      supabase.from('leads').select('id', { count: 'exact', head: true })
        .eq('business_id', businessId).gte('created_at', weekAgo),
      supabase.from('products').select('id', { count: 'exact', head: true })
        .eq('business_id', businessId).eq('active', true),
    ]).then(([totalRes, weekRes, propRes]) => {
      setTotalLeads(totalRes.count ?? 0)
      setWeekLeads(weekRes.count ?? 0)
      setProperties(propRes.count ?? 0)
      setLoading(false)
    })
  }, [businessId])

  if (loading) return <WidgetSkeleton />

  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm">
      <p className="text-sm font-semibold text-gray-900 mb-3">Resumen</p>
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'Consultas totales', value: totalLeads,  iconColor: color },
          { label: 'Esta semana',       value: `+${weekLeads}`, iconColor: '#10B981' },
          { label: 'Propiedades',       value: properties,  iconColor: '#8B5CF6' },
        ].map(({ label, value, iconColor }) => (
          <div key={label} className="bg-gray-50 rounded-xl p-3 text-center">
            <p className="text-xl font-bold" style={{ color: iconColor }}>{value}</p>
            <p className="text-[10px] text-gray-500 mt-0.5 leading-tight">{label}</p>
          </div>
        ))}
      </div>
      <WidgetFooterLink href="/admin/leads" label="Ver consultas" color={color} />
    </div>
  )
}

// ── 15. Consultas recientes (real_estate) ─────────────────────
const LEAD_STATUS_MAP: Record<string, { label: string; color: string; bg: string }> = {
  new:       { label: 'Nueva',      color: '#1D4ED8', bg: '#EFF6FF' },
  contacted: { label: 'Contactada', color: '#92400E', bg: '#FEF3C7' },
  qualified: { label: 'Calificada', color: '#065F46', bg: '#ECFDF5' },
  closed:    { label: 'Cerrada',    color: '#166534', bg: '#F0FDF4' },
  lost:      { label: 'Perdida',    color: '#991B1B', bg: '#FEF2F2' },
}
interface RecentLead {
  id: string; name: string; phone?: string | null
  status: string; created_at: string
  product: { name: string } | null
}

export function RecentLeadsWidget() {
  const { businessId, color } = useVertical()
  const supabase = createClient()
  const [leads,   setLeads]   = useState<RecentLead[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.from('leads')
      .select('id, name, phone, status, created_at, product:products(name)')
      .eq('business_id', businessId)
      .order('created_at', { ascending: false })
      .limit(8)
      .then(({ data }) => { setLeads((data ?? []) as unknown as RecentLead[]); setLoading(false) })
  }, [businessId])

  if (loading) return <WidgetSkeleton />

  return (
    <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden shadow-sm">
      <div className="px-4 py-3.5 border-b border-gray-100">
        <p className="text-sm font-semibold text-gray-900">Consultas recientes</p>
        <p className="text-xs text-gray-400 mt-0.5">
          {leads.length === 0 ? 'Sin consultas todavía' : `Últimas ${leads.length}`}
        </p>
      </div>
      {leads.length === 0 ? (
        <div className="px-4 py-8 text-center">
          <Target size={28} className="mx-auto text-gray-200 mb-2" />
          <p className="text-sm text-gray-400">Sin consultas todavía</p>
        </div>
      ) : (
        <div className="divide-y divide-gray-50 max-h-[320px] overflow-y-auto">
          {leads.map(lead => {
            const sc = LEAD_STATUS_MAP[lead.status] ?? LEAD_STATUS_MAP.new
            const waLink = lead.phone
              ? `https://wa.me/${lead.phone.replace(/\D/g,'')}?text=${encodeURIComponent(`Hola ${lead.name}! Te contactamos de ${lead.product?.name ? `la propiedad *${lead.product.name}*` : 'nuestra inmobiliaria'}.`)}`
              : null
            return (
              <div key={lead.id} className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50/60 transition-colors">
                <div className="h-7 w-7 rounded-lg flex items-center justify-center shrink-0 text-white text-xs font-bold"
                  style={{ background: color }}>
                  {lead.name.slice(0, 1).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-gray-900 truncate">{lead.name}</p>
                  <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                    <span className="text-[10px] font-semibold rounded-full px-2 py-0.5"
                      style={{ background: sc.bg, color: sc.color }}>
                      {sc.label}
                    </span>
                    {lead.product?.name && (
                      <span className="text-[10px] text-gray-400 truncate max-w-[110px]">{lead.product.name}</span>
                    )}
                  </div>
                </div>
                {waLink && (
                  <a href={waLink} target="_blank" rel="noopener noreferrer"
                    className="flex h-7 w-7 items-center justify-center rounded-lg text-white shrink-0"
                    style={{ background: '#25D366' }}>
                    <MessageCircle size={13} />
                  </a>
                )}
              </div>
            )
          })}
        </div>
      )}
      <div className="px-4 py-3 border-t border-gray-100 bg-gray-50/50">
        <Link href="/admin/leads" className="text-xs font-semibold" style={{ color }}>
          Ver todas las consultas →
        </Link>
      </div>
    </div>
  )
}

// ── 16. Visitas próximas (real_estate) ────────────────────────
interface VisitBooking {
  id: string; customer_name: string; customer_phone?: string | null
  date: string; start_time: string; status: string
  product: { name: string } | null
}

export function UpcomingVisitsListWidget() {
  const { businessId, color } = useVertical()
  const supabase = createClient()
  const [visits,  setVisits]  = useState<VisitBooking[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.from('bookings')
      .select('id, customer_name, customer_phone, date, start_time, status, product:products(name)')
      .eq('business_id', businessId)
      .gte('date', todayStr())
      .lte('date', in7daysStr())
      .neq('status', 'cancelled')
      .order('date')
      .order('start_time')
      .limit(15)
      .then(({ data }) => { setVisits((data ?? []) as unknown as VisitBooking[]); setLoading(false) })
  }, [businessId])

  if (loading) return <WidgetSkeleton />

  return (
    <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden shadow-sm">
      <div className="px-4 py-3.5 border-b border-gray-100 flex items-center justify-between">
        <div>
          <p className="text-sm font-semibold text-gray-900">Próximas visitas</p>
          <p className="text-xs text-gray-400 mt-0.5">
            {visits.length === 0 ? 'Sin visitas agendadas' : `${visits.length} en los próximos 7 días`}
          </p>
        </div>
        <Link href="/admin/visits" className="text-xs font-semibold" style={{ color }}>Ver agenda →</Link>
      </div>
      {visits.length === 0 ? (
        <div className="px-4 py-8 text-center">
          <CalendarCheck size={28} className="mx-auto text-gray-200 mb-2" />
          <p className="text-sm text-gray-400">Sin visitas agendadas</p>
        </div>
      ) : (
        <div className="divide-y divide-gray-50 max-h-[280px] overflow-y-auto">
          {visits.map(v => {
            const waLink = v.customer_phone
              ? `https://wa.me/${v.customer_phone.replace(/\D/g,'')}?text=${encodeURIComponent(`Hola ${v.customer_name}! Te confirmamos la visita para el ${v.date} a las ${v.start_time.slice(0,5)}.`)}`
              : null
            return (
              <div key={v.id} className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50/60 transition-colors">
                <div className="h-7 w-7 rounded-lg flex items-center justify-center shrink-0 text-white text-xs font-bold"
                  style={{ background: '#8B5CF6' }}>
                  {v.customer_name.slice(0, 1).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-gray-900 truncate">{v.customer_name}</p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="flex items-center gap-1 text-[11px] text-gray-500">
                      <Clock size={10} /> {dateDisplayLabel(v.date)} · {v.start_time.slice(0,5)}
                    </span>
                  </div>
                  {v.product?.name && (
                    <p className="text-[10px] text-gray-400 flex items-center gap-1 mt-0.5">
                      <Home size={10} /> {v.product.name}
                    </p>
                  )}
                </div>
                {waLink && (
                  <a href={waLink} target="_blank" rel="noopener noreferrer"
                    className="flex h-7 w-7 items-center justify-center rounded-lg text-white shrink-0"
                    style={{ background: '#25D366' }}>
                    <MessageCircle size={13} />
                  </a>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ── 17. Negocios cerrados (real_estate) ───────────────────────
interface ClosedLead { id: string; product: { price: number } | null }

export function ClosedDealsKPIWidget() {
  const { businessId, currency, color } = useVertical()
  const supabase = createClient()
  const [count,   setCount]   = useState(0)
  const [revenue, setRevenue] = useState(0)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.from('leads')
      .select('id, product:products(price)')
      .eq('business_id', businessId)
      .eq('status', 'closed')
      .then(({ data }) => {
        const leads = (data ?? []) as unknown as ClosedLead[]
        setCount(leads.length)
        setRevenue(leads.reduce((s, l) => s + (l.product?.price ?? 0), 0))
        setLoading(false)
      })
  }, [businessId])

  if (loading) return <WidgetSkeleton />

  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm">
      <p className="text-sm font-semibold text-gray-900 mb-3">Negocios cerrados</p>
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-gray-50 rounded-xl p-3">
          <p className="text-2xl font-bold text-gray-900" style={{ color }}>{count}</p>
          <p className="text-[11px] text-gray-500 mt-0.5">ventas cerradas</p>
        </div>
        <div className="bg-gray-50 rounded-xl p-3">
          <p className="text-lg font-bold text-gray-900">{formatPrice(revenue, currency)}</p>
          <p className="text-[11px] text-gray-500 mt-0.5">en propiedades</p>
        </div>
      </div>
      <WidgetFooterLink href="/admin/leads" label="Ver todas las consultas" color={color} />
    </div>
  )
}

// ── Renderer principal ────────────────────────────────────────
export function renderWidget(id: string): React.ReactNode {
  switch (id) {
    case 'sales_chart':          return <SalesChartWidget          key={id} />
    case 'costs_summary':        return <CostsSummaryWidget        key={id} />
    case 'low_stock':            return <LowStockWidget            key={id} />
    case 'recent_orders':        return <RecentOrdersWidget        key={id} />
    case 'new_customers':        return <NewCustomersWidget        key={id} />
    case 'quick_note':           return <QuickNoteWidget           key={id} />
    case 'cash_balance':         return <CashBalanceWidget         key={id} />
    case 'shortcuts':            return <ShortcutsWidget           key={id} />
    // Servicios
    case 'bookings_today_kpi':   return <BookingsTodayKPIWidget    key={id} />
    case 'bookings_revenue_kpi': return <BookingsRevenueKPIWidget  key={id} />
    case 'bookings_chart':       return <BookingsChartWidget       key={id} />
    case 'upcoming_agenda':      return <UpcomingAgendaWidget      key={id} />
    case 'active_staff':         return <ActiveStaffWidget         key={id} />
    // Real estate
    case 'leads_kpi':            return <LeadsKPIWidget            key={id} />
    case 'recent_leads':         return <RecentLeadsWidget         key={id} />
    case 'upcoming_visits_list': return <UpcomingVisitsListWidget  key={id} />
    case 'closed_deals_kpi':     return <ClosedDealsKPIWidget      key={id} />
    case 'ai_insights':          return <AiInsightsWidget           key={id} />
    default:                     return null
  }
}
