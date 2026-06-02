// app/admin/food/FoodHub.tsx
'use client'
import { useState, useMemo, useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import {
  ChefHat, ShoppingBag, BarChart2, Clock, Settings2,
  Check, X, ChevronRight, RefreshCw, MessageCircle,
  Loader2, Phone, MapPin, Package, Plus, Minus,
  Bell, Zap, TrendingUp, AlertTriangle, Truck, Monitor, UserCheck, UserPlus, Trash2, ChevronDown,
  BookOpen, ToggleLeft, ToggleRight, Printer, UtensilsCrossed,
} from 'lucide-react'
import { cn, formatPrice, orderStatusLabel, orderStatusColor } from '@/lib/utils'
import { useVertical } from '@/lib/vertical-context'
import type { Order, Product, Category, BusinessHours, OrderItem, Combo, DeliveryRider } from '@/types'
import CombosTab from './CombosTab'

type Tab = 'kitchen' | 'orders' | 'delivery' | 'mesas' | 'menu' | 'hours' | 'stats' | 'combos'

function playNewOrderBeep() {
  try {
    const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
    const ctx  = new AC()
    const beep = (freq: number, start: number, dur: number) => {
      const osc  = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.connect(gain)
      gain.connect(ctx.destination)
      osc.type = 'sine'
      osc.frequency.value = freq
      gain.gain.setValueAtTime(0.4, ctx.currentTime + start)
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + start + dur)
      osc.start(ctx.currentTime + start)
      osc.stop(ctx.currentTime + start + dur)
    }
    beep(880, 0, 0.18)
    beep(1100, 0.22, 0.18)
    beep(1320, 0.44, 0.25)
  } catch { /* browser bloqueó AudioContext */ }
}

const KITCHEN_COLS = [
  { status: 'pending',   label: '🔔 Nuevos',      bg: '#FFF7ED', border: '#FED7AA' },
  { status: 'confirmed', label: '✅ Confirmados',  bg: '#EFF6FF', border: '#BFDBFE' },
  { status: 'preparing', label: '👨‍🍳 En cocina',   bg: '#FDF4FF', border: '#E9D5FF' },
  { status: 'ready',     label: '🛵 Listo',        bg: '#F0FDF4', border: '#BBF7D0' },
]

const DAYS_ES = ['Dom','Lun','Mar','Mié','Jue','Vie','Sáb']

interface Props {
  orders: Order[]
  products: Product[]
  categories: Category[]
  hours: BusinessHours[]
  combos: Combo[]
  riders: DeliveryRider[]
}

export default function FoodHub({ orders: initialOrders, products, categories, hours: initialHours, combos, riders: initialRiders }: Props) {
  const { businessId, business, currency, color } = useVertical()
  const whatsapp = (business.whatsapp as string | undefined) ?? ''
  const supabase = createClient()
  const [tab, setTab] = useState<Tab>('kitchen')
  const [orders, setOrders] = useState<Order[]>(initialOrders)
  const [hours, setHours]   = useState<BusinessHours[]>(initialHours)
  const [riders, setRiders] = useState<DeliveryRider[]>(initialRiders)
  const [updating, setUpdating] = useState<string | null>(null)
  const [newOrderAlert, setNewOrderAlert] = useState(false)
  const [tableAlerts, setTableAlerts] = useState<Record<string, 'waiting_attention' | 'bill_requested'>>({})
  const alertCount = Object.keys(tableAlerts).length
  const [showPOS, setShowPOS] = useState(false)
  const [now, setNow] = useState(Date.now())
  const [tableInfoMap, setTableInfoMap] = useState<Record<string, { name: string; alertAfterMinutes: number | null; openedAt: string | null }>>({})
  const [dismissedDelayAlerts, setDismissedDelayAlerts] = useState<Set<string>>(new Set())

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 60_000)
    return () => clearInterval(t)
  }, [])

  // Carga mesas + sesiones abiertas para calcular alertas de demora
  const loadTableInfo = async () => {
    const [{ data: tables }, { data: sessions }] = await Promise.all([
      supabase.from('restaurant_tables').select('id, name, alert_after_minutes').eq('business_id', businessId).eq('active', true),
      supabase.from('table_sessions').select('table_id, opened_at').eq('business_id', businessId).eq('status', 'open'),
    ])
    if (!tables) return
    const sessMap: Record<string, string> = {}
    sessions?.forEach((s: { table_id: string; opened_at: string }) => { sessMap[s.table_id] = s.opened_at })
    const map: Record<string, { name: string; alertAfterMinutes: number | null; openedAt: string | null }> = {}
    tables.forEach((t: { id: string; name: string; alert_after_minutes?: number | null }) => {
      map[t.id] = { name: t.name, alertAfterMinutes: t.alert_after_minutes ?? null, openedAt: sessMap[t.id] ?? null }
    })
    setTableInfoMap(map)
  }

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { loadTableInfo() }, [businessId])
  const [autoConfirm, setAutoConfirm] = useState(() => {
    try { return localStorage.getItem(`auto_confirm_${businessId}`) === '1' } catch { return false }
  })
  const autoConfirmRef = useRef(autoConfirm)
  autoConfirmRef.current = autoConfirm

  function toggleAutoConfirm() {
    const next = !autoConfirm
    setAutoConfirm(next)
    try { localStorage.setItem(`auto_confirm_${businessId}`, next ? '1' : '0') } catch { /* */ }
  }

  // Realtime — pedidos (INSERT + UPDATE)
  useEffect(() => {
    const channel = supabase
      .channel('food-orders')
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'orders',
        filter: `business_id=eq.${businessId}`,
      }, async (payload) => {
        const { data: items } = await supabase
          .from('order_items')
          .select('*')
          .eq('order_id', payload.new.id)

        let newOrder = { ...payload.new, items: items ?? [] } as Order

        if (autoConfirmRef.current && newOrder.status === 'pending') {
          await supabase.from('orders').update({ status: 'confirmed' }).eq('id', newOrder.id)
          newOrder = { ...newOrder, status: 'confirmed' }
        }

        setOrders(prev => [newOrder, ...prev])
        setNewOrderAlert(true)
        setTimeout(() => setNewOrderAlert(false), 5000)
        playNewOrderBeep()
        if ('vibrate' in navigator) navigator.vibrate([200, 100, 200])
      })
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'orders',
        filter: `business_id=eq.${businessId}`,
      }, (payload) => {
        const u = payload.new as Order
        setOrders(prev => prev.map(o =>
          o.id === u.id ? { ...o, status: u.status, confirmed_sale: u.confirmed_sale } : o
        ))
      })
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [businessId])

  // Realtime — alertas de mesas (cliente llama mozo / pide cuenta / cambia estado)
  useEffect(() => {
    const channel = supabase
      .channel('table-alerts')
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'restaurant_tables',
        filter: `business_id=eq.${businessId}`,
      }, (payload) => {
        const t = payload.new as { id: string; status: string }
        if (t.status === 'waiting_attention' || t.status === 'bill_requested') {
          setTableAlerts(prev => ({ ...prev, [t.id]: t.status as 'waiting_attention' | 'bill_requested' }))
          if ('vibrate' in navigator) navigator.vibrate([100, 50, 100, 50, 100])
        } else {
          setTableAlerts(prev => { const n = { ...prev }; delete n[t.id]; return n })
        }
        // Refresh session info so delay alerts update when a table opens/closes
        loadTableInfo()
      })
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'table_sessions',
        filter: `business_id=eq.${businessId}`,
      }, () => { loadTableInfo() })
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'table_sessions',
        filter: `business_id=eq.${businessId}`,
      }, () => { loadTableInfo() })
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [businessId])

  async function updateOrderStatus(orderId: string, status: string) {
    setUpdating(orderId)
    const confirmedSale =
      status === 'delivered' || status === 'done' ? true :
      status === 'cancelled' ? false : undefined
    const patch = confirmedSale !== undefined
      ? { status, confirmed_sale: confirmedSale }
      : { status }
    await supabase.from('orders').update(patch).eq('id', orderId)
    setOrders(prev => prev.map(o =>
      o.id === orderId
        ? { ...o, status: status as Order['status'], ...(confirmedSale !== undefined && { confirmed_sale: confirmedSale }) }
        : o
    ))
    setUpdating(null)
  }

  async function assignRider(orderId: string, riderId: string | null) {
    await supabase.from('orders').update({ rider_id: riderId }).eq('id', orderId)
    setOrders(prev => prev.map(o => {
      if (o.id !== orderId) return o
      const rider = riderId ? riders.find(r => r.id === riderId) ?? null : null
      return { ...o, rider_id: riderId, rider }
    }))
  }

  async function clearTableAlert(tableId: string) {
    await supabase.from('restaurant_tables').update({ status: 'occupied' }).eq('id', tableId)
    setTableAlerts(prev => { const n = { ...prev }; delete n[tableId]; return n })
  }

  // Pedidos por estado (solo hoy)
  const byStatus = useMemo(() => {
    const map: Record<string, Order[]> = {}
    KITCHEN_COLS.forEach(c => { map[c.status] = [] })
    orders.forEach(o => { if (map[o.status]) map[o.status].push(o) })
    return map
  }, [orders])

  const todayRevenue    = orders.filter(o => o.confirmed_sale).reduce((a, o) => a + o.total, 0)
  const pendingCount    = orders.filter(o => o.status === 'pending').length
  const deliveryOrders  = useMemo(() =>
    orders
      .filter(o => o.delivery_type === 'delivery' && !['delivered', 'cancelled'].includes(o.status))
      .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()),
    [orders]
  )

  const mesaOrders = useMemo(() =>
    orders
      .filter(o => o.delivery_type === 'dine_in' && !['delivered', 'cancelled'].includes(o.status))
      .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()),
    [orders]
  )

  const mesasByTable = useMemo(() => {
    const map = new Map<string, { tableId: string; tableName: string; orders: Order[] }>()
    mesaOrders.forEach(o => {
      const key  = o.table_id ?? 'sin-mesa'
      const name = (o.table as unknown as { name?: string } | null)?.name ?? tableInfoMap[key]?.name ?? 'Mesa'
      if (!map.has(key)) map.set(key, { tableId: key, tableName: name, orders: [] })
      map.get(key)!.orders.push(o)
    })
    return Array.from(map.values())
  }, [mesaOrders, tableInfoMap])

  // Mesas que superaron su umbral — usa sesión si existe, si no el primer pedido del día
  const tableDelayAlerts = useMemo(() => {
    const result: Array<{ tableId: string; name: string; alertAfterMinutes: number; openedAt: string }> = []
    // Gather all table IDs that have a configured threshold
    const allTableIds = new Set([
      ...Object.keys(tableInfoMap),
      ...mesasByTable.map(m => m.tableId),
    ])
    for (const tableId of Array.from(allTableIds)) {
      const info = tableInfoMap[tableId]
      const threshold = info?.alertAfterMinutes ?? null
      if (!threshold) continue
      if (dismissedDelayAlerts.has(tableId)) continue
      // Prefer session openedAt, fall back to earliest active order
      const openedAt = info?.openedAt
        ?? mesasByTable.find(m => m.tableId === tableId)?.orders[0]?.created_at
        ?? null
      if (!openedAt) continue
      const elapsed = (now - new Date(openedAt).getTime()) / 60_000
      if (elapsed >= threshold) {
        result.push({
          tableId,
          name: info?.name ?? mesasByTable.find(m => m.tableId === tableId)?.tableName ?? 'Mesa',
          alertAfterMinutes: threshold,
          openedAt,
        })
      }
    }
    return result
  }, [tableInfoMap, mesasByTable, dismissedDelayAlerts, now])

  // Abrir WhatsApp cliente
  function waClient(order: Order) {
    if (!order.customer_phone) return
    const msg = encodeURIComponent(`Hola ${order.customer_name}! Tu pedido #${String(order.order_number).padStart(4,'0')} está listo.`)
    window.open(`https://wa.me/${order.customer_phone.replace(/\D/g,'')}?text=${msg}`)
  }

  return (
    <div className="space-y-4 animate-fade-in pb-4">

      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-xl lg:text-2xl font-bold text-gray-900 tracking-tight flex items-center gap-2">
            <ChefHat size={22} style={{ color }} />
            Cocina & Pedidos
          </h1>
          <p className="text-xs text-gray-400 mt-0.5">
            {new Date().toLocaleDateString('es-UY', { weekday: 'long', day: 'numeric', month: 'long' })}
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {/* Auto-confirm toggle */}
          <button onClick={toggleAutoConfirm}
            title={autoConfirm ? 'Auto-confirmar: activado' : 'Auto-confirmar: desactivado'}
            className={cn(
              'flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-semibold transition-all',
              autoConfirm ? 'text-white' : 'bg-gray-100 text-gray-500'
            )}
            style={autoConfirm ? { background: color } : {}}>
            <Zap size={12} />
            <span className="hidden sm:inline">Auto</span>
          </button>

          {/* Nueva comanda */}
          <button
            onClick={() => setShowPOS(true)}
            className="flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-bold text-white transition-all hover:opacity-90"
            style={{ background: color }}>
            <Plus size={13} />
            <span className="hidden sm:inline">Nueva comanda</span>
          </button>

          {/* KDS link */}
          <a href="/kds" target="_blank" rel="noopener"
            title="Abrir pantalla de cocina (KDS)"
            className="flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-semibold bg-gray-100 text-gray-600 hover:bg-gray-200 transition-colors">
            <Monitor size={13} />
            <span className="hidden sm:inline">KDS</span>
          </a>

          {/* Alerta nuevo pedido */}
          {newOrderAlert && (
            <div className="flex items-center gap-2 rounded-2xl px-4 py-2 text-white text-sm font-semibold animate-bounce"
              style={{ background: color }}>
              <Bell size={14} /> ¡Nuevo pedido!
            </div>
          )}
        </div>
      </div>

      {/* Stats rápidas */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'Hoy', value: orders.length, icon: ShoppingBag, color: '#1565FF' },
          { label: 'Pendientes', value: pendingCount, icon: Clock, color: pendingCount > 0 ? '#F59E0B' : '#9CA3AF' },
          { label: 'Ingresos', value: formatPrice(todayRevenue, currency), icon: TrendingUp, color: '#10B981' },
        ].map(({ label, value, icon: Icon, color: c }) => (
          <div key={label} className="bg-white rounded-2xl border border-gray-100 p-3 shadow-sm text-center">
            <Icon size={16} className="mx-auto mb-1.5" style={{ color: c }} />
            <p className="text-base font-bold text-gray-900">{value}</p>
            <p className="text-[10px] text-gray-400">{label}</p>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 overflow-x-auto scrollbar-hide bg-gray-100 rounded-xl p-1">
        {([
          { key: 'kitchen',  label: 'Cocina',   icon: ChefHat,    badge: pendingCount          },
          { key: 'orders',   label: 'Pedidos',  icon: ShoppingBag, badge: 0                   },
          { key: 'delivery', label: 'Reparto',  icon: Truck,            badge: deliveryOrders.length },
          { key: 'mesas',    label: 'Mesas',    icon: UtensilsCrossed,  badge: mesaOrders.length + alertCount + tableDelayAlerts.length },
          { key: 'menu',     label: 'Menú',     icon: BookOpen,         badge: 0                     },
          { key: 'combos',   label: 'Combos',   icon: Package,     badge: 0                   },
          { key: 'hours',    label: 'Horarios', icon: Clock,       badge: 0                   },
          { key: 'stats',    label: 'Stats',    icon: BarChart2,   badge: 0                   },
        ] as { key: Tab; label: string; icon: React.ElementType; badge: number }[]).map(({ key, label, icon: Icon, badge }) => (
          <button key={key} onClick={() => setTab(key)}
            className={cn('flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-medium shrink-0 transition-all',
              tab === key ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700')}>
            <Icon size={13} />{label}
            {badge > 0 && (
              <span className="flex h-4 w-4 items-center justify-center rounded-full text-[9px] font-bold text-white"
                style={{ background: color }}>
                {badge}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* ── KITCHEN VIEW — Columnas kanban ── */}
      {tab === 'kitchen' && (
        <div className="space-y-4">
          {/* Mobile: lista por estados */}
          <div className="lg:hidden space-y-4">
            {KITCHEN_COLS.map(col => (
              <div key={col.status}>
                <div className="flex items-center justify-between mb-2">
                  <p className="text-sm font-semibold text-gray-700">{col.label}</p>
                  <span className="text-xs text-gray-400">{byStatus[col.status]?.length ?? 0}</span>
                </div>
                {(byStatus[col.status] ?? []).length === 0 ? (
                  <div className="rounded-xl border border-dashed border-gray-200 py-4 text-center">
                    <p className="text-xs text-gray-300">Sin pedidos</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {(byStatus[col.status] ?? []).map(order => (
                      <KitchenCard
                        key={order.id}
                        order={order}
                        currency={currency}
                        updating={updating === order.id}
                        onStatus={updateOrderStatus}
                        onWA={() => waClient(order)}
                        color={color}
                      />
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Desktop: kanban horizontal */}
          <div className="hidden lg:grid grid-cols-4 gap-4">
            {KITCHEN_COLS.map(col => (
              <div key={col.status} className="rounded-2xl p-3 min-h-[200px]"
                style={{ background: col.bg, border: `1px solid ${col.border}` }}>
                <div className="flex items-center justify-between mb-3">
                  <p className="text-xs font-bold text-gray-700">{col.label}</p>
                  <span className="text-xs font-bold rounded-full h-5 w-5 flex items-center justify-center bg-white text-gray-600">
                    {byStatus[col.status]?.length ?? 0}
                  </span>
                </div>
                <div className="space-y-2">
                  {(byStatus[col.status] ?? []).map(order => (
                    <KitchenCard
                      key={order.id}
                      order={order}
                      currency={currency}
                      updating={updating === order.id}
                      onStatus={updateOrderStatus}
                      onWA={() => waClient(order)}
                      color={color}
                      compact
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── ORDERS — Lista completa ── */}
      {tab === 'orders' && (
        <div className="space-y-2">
          {orders.length === 0 ? (
            <div className="rounded-2xl border-2 border-dashed border-gray-200 py-14 text-center">
              <ShoppingBag size={28} className="mx-auto text-gray-200 mb-3" />
              <p className="text-sm text-gray-400">Sin pedidos hoy</p>
            </div>
          ) : (
            orders.map(order => (
              <OrderRow
                key={order.id}
                order={order}
                currency={currency}
                updating={updating === order.id}
                onStatus={updateOrderStatus}
                onWA={() => waClient(order)}
                color={color}
              />
            ))
          )}
        </div>
      )}

      {/* ── DELIVERY / REPARTO ── */}
      {tab === 'delivery' && (
        <div className="space-y-4">
          <RidersManager
            businessId={businessId}
            riders={riders}
            color={color}
            onUpdate={setRiders}
          />
          {deliveryOrders.length === 0 ? (
            <div className="rounded-2xl border-2 border-dashed border-gray-200 py-14 text-center">
              <Truck size={28} className="mx-auto text-gray-200 mb-3" />
              <p className="text-sm text-gray-400">Sin pedidos de delivery activos</p>
            </div>
          ) : (
            deliveryOrders.map(order => (
              <DeliveryCard
                key={order.id}
                order={order}
                currency={currency}
                updating={updating === order.id}
                onStatus={updateOrderStatus}
                onAssignRider={assignRider}
                riders={riders}
                color={color}
                onWA={() => waClient(order)}
              />
            ))
          )}
        </div>
      )}

      {/* ── MESAS — Pedidos dine_in agrupados por mesa ── */}
      {tab === 'mesas' && (
        <div className="space-y-3">

          {/* ── Alertas de demora (configurable por mesa) ── */}
          {tableDelayAlerts.map(t => {
            const elapsed = Math.round((now - new Date(t.openedAt!).getTime()) / 60_000)
            return (
              <div key={t.tableId}
                className="relative flex items-center gap-4 rounded-2xl border-2 border-red-400 bg-red-600 px-5 py-4 shadow-lg shadow-red-200">
                {/* Pulso de fondo */}
                <span className="absolute inset-0 rounded-2xl animate-ping opacity-10 bg-red-500 pointer-events-none" />

                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-white/20">
                  <AlertTriangle size={26} className="text-white" />
                </div>

                <div className="flex-1 min-w-0">
                  <p className="text-base font-extrabold text-white leading-tight">
                    ⏱ {t.name} — Sin atender
                  </p>
                  <p className="text-sm text-red-100 mt-0.5 font-medium">
                    Abierta hace <span className="font-extrabold text-white">{elapsed} min</span>
                    <span className="text-red-200"> · umbral: {t.alertAfterMinutes} min</span>
                  </p>
                </div>

                <button
                  onClick={() => setDismissedDelayAlerts(prev => { const s = new Set(Array.from(prev)); s.add(t.tableId); return s })}
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white/20 text-white hover:bg-white/30 transition-colors"
                  title="Cerrar alerta"
                >
                  <X size={16} />
                </button>
              </div>
            )
          })}

          {/* ── Alertas de mozo / cuenta ── */}
          {alertCount > 0 && (
            <div className="space-y-2">
              {Object.entries(tableAlerts).map(([tableId, alertType]) => {
                const tableName = tableInfoMap[tableId]?.name ?? mesasByTable.find(t => t.tableId === tableId)?.tableName ?? 'Mesa'
                return (
                  <div key={tableId}
                    className={cn(
                      'flex items-center gap-3 rounded-2xl px-4 py-3 animate-pulse',
                      alertType === 'bill_requested' ? 'bg-purple-50 border border-purple-200' : 'bg-orange-50 border border-orange-200'
                    )}>
                    <Bell size={16} className={alertType === 'bill_requested' ? 'text-purple-500 shrink-0' : 'text-orange-500 shrink-0'} />
                    <p className={cn('text-sm font-bold flex-1',
                      alertType === 'bill_requested' ? 'text-purple-800' : 'text-orange-800')}>
                      {tableName} —{' '}
                      {alertType === 'bill_requested' ? '🧾 Pide la cuenta' : '🔔 Llama al mozo'}
                    </p>
                    <button
                      onClick={() => clearTableAlert(tableId)}
                      className={cn(
                        'text-xs font-bold px-3 py-1.5 rounded-xl transition-colors',
                        alertType === 'bill_requested'
                          ? 'bg-purple-100 text-purple-700 hover:bg-purple-200'
                          : 'bg-orange-100 text-orange-700 hover:bg-orange-200'
                      )}>
                      Atendido ✓
                    </button>
                  </div>
                )
              })}
            </div>
          )}

          {/* ── Pedidos activos por mesa ── */}
          {mesasByTable.length === 0 && tableDelayAlerts.length === 0 ? (
            <div className="rounded-2xl border-2 border-dashed border-gray-200 py-14 text-center">
              <UtensilsCrossed size={28} className="mx-auto text-gray-200 mb-3" />
              <p className="text-sm text-gray-400">Sin mesas activas</p>
            </div>
          ) : (
            mesasByTable.map(({ tableId, tableName, orders: tableOrderList }) => (
              <MesaGroupCard
                key={tableId}
                tableId={tableId}
                tableName={tableName}
                orders={tableOrderList}
                currency={currency}
                color={color}
                updating={updating}
                onStatus={updateOrderStatus}
                alert={tableAlerts[tableId] ?? null}
                onClearAlert={clearTableAlert}
              />
            ))
          )}
        </div>
      )}

      {/* ── MENÚ — Toggle disponibilidad ── */}
      {tab === 'menu' && (
        <MenuAvailabilityTab
          businessId={businessId}
          initialProducts={products}
          categories={categories}
          color={color}
        />
      )}

      {/* ── COMBOS ── */}
      {tab === 'combos' && (
        <CombosTab
          businessId={businessId}
          currency={currency}
          color={color}
          initialCombos={combos}
          products={products}
        />
      )}

      {/* ── HORARIOS ── */}
      {tab === 'hours' && (
        <HoursManager
          businessId={businessId}
          hours={hours}
          onUpdate={setHours}
          color={color}
        />
      )}

      {/* ── STATS ── */}
      {tab === 'stats' && (
        <FoodStats orders={orders} currency={currency} color={color} />
      )}

      {/* ── POS MODAL ── */}
      {showPOS && (
        <POSModal
          businessId={businessId}
          products={products}
          categories={categories}
          currency={currency}
          color={color}
          onClose={() => setShowPOS(false)}
          onCreated={newOrder => {
            setOrders(prev => [newOrder, ...prev])
            setShowPOS(false)
          }}
        />
      )}
    </div>
  )
}

// ── Delay thresholds per status (minutes) ────────────────────
const DELAY_WARN: Record<string, number> = { pending: 5,  confirmed: 8,  preparing: 15, ready: 10 }
const DELAY_CRIT: Record<string, number> = { pending: 10, confirmed: 15, preparing: 25, ready: 20 }

// ── Kitchen Card ──────────────────────────────────────────────
function KitchenCard({ order, currency, updating, onStatus, onWA, color, compact = false }: {
  order: Order; currency: string; updating: boolean
  onStatus: (id: string, s: string) => void
  onWA: () => void; color: string; compact?: boolean
}) {
  const isDineIn = order.delivery_type === 'dine_in'
  const NEXT: Record<string, { label: string; status: string; bg: string }> = {
    pending:   { label: 'Confirmar',               status: 'confirmed', bg: color    },
    confirmed: { label: 'A cocina →',              status: 'preparing', bg: '#7C3AED'},
    preparing: { label: '¡Listo! →',               status: 'ready',     bg: '#059669'},
    ready:     isDineIn
      ? { label: 'Servido ✓',  status: 'delivered', bg: '#10B981' }
      : { label: 'Enviado →',  status: 'shipped',   bg: '#1565FF' },
    shipped:   { label: 'Entregado ✓',             status: 'delivered', bg: '#10B981'},
  }
  const next = NEXT[order.status]

  // Live timer — re-renders every 30s
  const [, setTick] = useState(0)
  const tickRef = useRef<ReturnType<typeof setInterval>>(undefined)
  useEffect(() => {
    tickRef.current = setInterval(() => setTick(t => t + 1), 30_000)
    return () => clearInterval(tickRef.current)
  }, [])

  const elapsedMs = Date.now() - new Date(order.created_at).getTime()
  const elapsed   = Math.floor(elapsedMs / 60_000)
  const warnMin   = DELAY_WARN[order.status]
  const critMin   = DELAY_CRIT[order.status]
  const isCrit    = critMin != null && elapsed >= critMin
  const isWarn    = !isCrit && warnMin != null && elapsed >= warnMin
  const timerColor = isCrit ? '#EF4444' : isWarn ? '#F59E0B' : '#9CA3AF'

  return (
    <div className={cn(
      'bg-white rounded-xl p-3 shadow-sm',
      isCrit ? 'border-2 border-red-300' :
      isWarn ? 'border-2 border-amber-200' : 'border border-gray-100'
    )}>
      {/* Delay banner */}
      {(isCrit || isWarn) && (
        <div className={cn(
          'flex items-center gap-1.5 rounded-lg px-2.5 py-1 mb-2 text-[10px] font-bold',
          isCrit ? 'bg-red-50 text-red-600' : 'bg-amber-50 text-amber-600'
        )}>
          <AlertTriangle size={10} />
          {isCrit ? `¡Demorado ${elapsed} min!` : `En espera ${elapsed} min`}
        </div>
      )}

      <div className="flex items-start justify-between gap-2 mb-2">
        <div>
          <p className="text-xs font-bold text-gray-900">#{String(order.order_number).padStart(4,'0')}</p>
          <p className="text-sm font-semibold text-gray-900">{order.customer_name}</p>
        </div>
        <div className="text-right shrink-0">
          <p className="text-sm font-bold" style={{ color }}>{formatPrice(order.total, currency)}</p>
          <p className="text-[10px] flex items-center gap-0.5 justify-end font-semibold"
            style={{ color: timerColor }}>
            <Clock size={9} /> {elapsed}min
          </p>
        </div>
      </div>

      {/* Items */}
      {!compact && order.items && order.items.length > 0 && (
        <div className="mb-2 space-y-1">
          {order.items.map((item, i) => (
            <div key={i}>
              <p className="text-xs text-gray-600">
                <span className="font-bold">{item.quantity}×</span> {item.product_name}
              </p>
              {(item as unknown as { note?: string | null }).note && (
                <p className="text-[10px] text-amber-700 italic ml-3 mt-0.5">
                  ↳ {(item as unknown as { note: string }).note}
                </p>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Tipo + mesa */}
      <div className="flex items-center gap-1.5 mb-2 flex-wrap">
        {order.table ? (
          <span className="badge bg-orange-50 text-orange-700 text-[10px] font-bold">
            🍽️ {(order.table as unknown as { name: string }).name}
          </span>
        ) : (
          <span className={cn('badge text-[10px]',
            order.delivery_type === 'delivery' ? 'bg-blue-50 text-blue-700' : 'bg-purple-50 text-purple-700')}>
            {order.delivery_type === 'delivery' ? '🛵 Delivery' : '🏃 Retiro'}
          </span>
        )}
        {order.comment && (
          <span className="badge bg-amber-50 text-amber-700 text-[10px]">💬 Nota</span>
        )}
      </div>

      {/* Acciones */}
      <div className="flex items-center gap-1.5">
        {next && order.status !== 'delivered' && order.status !== 'cancelled' && (
          <button onClick={() => onStatus(order.id, next.status)}
            disabled={updating}
            className="flex-1 flex items-center justify-center gap-1 rounded-lg py-2 text-xs font-bold text-white
                       transition-all active:scale-[0.97] disabled:opacity-50"
            style={{ background: next.bg }}>
            {updating ? <Loader2 size={11} className="animate-spin" /> : null}
            {next.label}
          </button>
        )}
        <a href={`/comanda/${order.id}`} target="_blank" rel="noopener"
          className="flex h-8 w-8 items-center justify-center rounded-lg bg-gray-100 text-gray-500 shrink-0 hover:bg-gray-200">
          <Printer size={13} />
        </a>
        {order.customer_phone && (
          <button onClick={onWA}
            className="flex h-8 w-8 items-center justify-center rounded-lg bg-green-500 text-white shrink-0">
            <MessageCircle size={13} />
          </button>
        )}
        {order.status !== 'cancelled' && order.status !== 'delivered' && (
          <button onClick={() => onStatus(order.id, 'cancelled')}
            className="flex h-8 w-8 items-center justify-center rounded-lg bg-red-50 text-red-400 shrink-0 hover:bg-red-100">
            <X size={13} />
          </button>
        )}
      </div>

      {/* Comentario */}
      {!compact && order.comment && (
        <p className="mt-2 text-xs text-amber-700 bg-amber-50 rounded-lg px-2 py-1.5">
          💬 {order.comment}
        </p>
      )}
    </div>
  )
}

// ── Delivery Card ────────────────────────────────────────────
const DELIVERY_NEXT: Record<string, { label: string; status: string; bg: string }> = {
  pending:   { label: 'Confirmar',    status: 'confirmed', bg: '#2563EB' },
  confirmed: { label: 'En camino →',  status: 'shipped',   bg: '#7C3AED' },
  preparing: { label: 'En camino →',  status: 'shipped',   bg: '#7C3AED' },
  ready:     { label: 'En camino →',  status: 'shipped',   bg: '#7C3AED' },
  shipped:   { label: 'Entregado ✓',  status: 'delivered', bg: '#059669' },
}

function DeliveryCard({ order, currency, updating, onStatus, onAssignRider, riders, onWA, color }: {
  order: Order; currency: string; updating: boolean
  onStatus: (id: string, s: string) => void
  onAssignRider: (orderId: string, riderId: string | null) => Promise<void>
  riders: DeliveryRider[]
  onWA: () => void; color: string
}) {
  const [, setTick] = useState(0)
  const tickRef = useRef<ReturnType<typeof setInterval>>(undefined)
  useEffect(() => {
    tickRef.current = setInterval(() => setTick(t => t + 1), 30_000)
    return () => clearInterval(tickRef.current)
  }, [])

  const elapsed   = Math.floor((Date.now() - new Date(order.created_at).getTime()) / 60_000)
  const isUrgent  = order.status === 'shipped' && elapsed > 45
  const next      = DELIVERY_NEXT[order.status]
  const mapsUrl   = order.customer_address
    ? `https://maps.google.com/?q=${encodeURIComponent(order.customer_address)}`
    : null

  return (
    <div className={cn(
      'bg-white rounded-2xl shadow-sm p-4 space-y-3',
      isUrgent ? 'border-2 border-red-300' : 'border border-gray-100'
    )}>
      {/* Top row */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <p className="text-sm font-bold text-gray-900">{order.customer_name}</p>
            <span className="text-[10px] font-mono text-gray-400">
              #{String(order.order_number).padStart(4, '0')}
            </span>
          </div>
          {order.customer_phone && (
            <p className="text-xs text-gray-500 mt-0.5">{order.customer_phone}</p>
          )}
        </div>
        <div className="text-right shrink-0">
          <p className="text-sm font-bold text-gray-900">{formatPrice(order.total, currency)}</p>
          <p className={cn(
            'text-[10px] flex items-center gap-0.5 justify-end font-semibold mt-0.5',
            isUrgent ? 'text-red-500' : 'text-gray-400'
          )}>
            <Clock size={9} /> {elapsed}min
          </p>
        </div>
      </div>

      {/* Address */}
      {order.customer_address && (
        <div className="flex items-start gap-2 rounded-xl bg-blue-50 px-3 py-2.5">
          <MapPin size={13} className="text-blue-500 mt-0.5 shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-xs text-blue-800 font-medium leading-relaxed">
              {order.customer_address}
            </p>
          </div>
          {mapsUrl && (
            <a href={mapsUrl} target="_blank"
              className="shrink-0 text-[10px] font-bold text-blue-600 bg-blue-100 hover:bg-blue-200
                         px-2 py-1 rounded-lg transition-colors whitespace-nowrap">
              Maps →
            </a>
          )}
        </div>
      )}

      {/* Items */}
      {order.items && order.items.length > 0 && (
        <div className="text-xs text-gray-600">
          {order.items.slice(0, 3).map((item, i) => (
            <span key={i}>
              {i > 0 && <span className="text-gray-300"> · </span>}
              <span className="font-semibold">{item.quantity}×</span> {item.product_name}
            </span>
          ))}
          {order.items.length > 3 && (
            <span className="text-gray-400"> +{order.items.length - 3} más</span>
          )}
        </div>
      )}

      {order.comment && (
        <p className="text-xs text-amber-700 bg-amber-50 rounded-lg px-2.5 py-1.5">
          💬 {order.comment}
        </p>
      )}

      {/* Rider assignment */}
      {riders.length > 0 && (
        <div className="flex items-center gap-2">
          <UserCheck size={13} className="text-gray-400 shrink-0" />
          <select
            value={order.rider_id ?? ''}
            onChange={e => onAssignRider(order.id, e.target.value || null)}
            className="flex-1 rounded-xl border border-gray-200 bg-white px-3 py-1.5 text-xs
                       text-gray-700 outline-none focus:ring-2 focus:border-transparent"
            style={{ '--tw-ring-color': color } as React.CSSProperties}
          >
            <option value="">Sin asignar</option>
            {riders.filter(r => r.active).map(r => (
              <option key={r.id} value={r.id}>{r.name}</option>
            ))}
          </select>
          {order.rider_id && (
            <span className="shrink-0 text-[10px] font-bold px-2 py-0.5 rounded-full bg-violet-50 text-violet-700">
              {riders.find(r => r.id === order.rider_id)?.name ?? ''}
            </span>
          )}
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center gap-2">
        {next && (
          <button onClick={() => onStatus(order.id, next.status)}
            disabled={updating}
            className="flex-1 flex items-center justify-center gap-1.5 rounded-xl py-2.5 text-xs font-bold
                       text-white transition-all active:scale-[0.97] disabled:opacity-50"
            style={{ background: next.bg }}>
            {updating ? <Loader2 size={11} className="animate-spin" /> : <Truck size={11} />}
            {next.label}
          </button>
        )}
        {order.customer_phone && (
          <button onClick={onWA}
            className="flex h-9 w-9 items-center justify-center rounded-xl bg-green-500 text-white shrink-0">
            <MessageCircle size={14} />
          </button>
        )}
        {!['cancelled', 'delivered'].includes(order.status) && (
          <button onClick={() => onStatus(order.id, 'cancelled')}
            className="flex h-9 w-9 items-center justify-center rounded-xl bg-red-50 text-red-400
                       hover:bg-red-100 shrink-0 transition-colors">
            <X size={13} />
          </button>
        )}
      </div>
    </div>
  )
}

// ── Order Row ─────────────────────────────────────────────────
function OrderRow({ order, currency, updating, onStatus, onWA, color }: {
  order: Order; currency: string; updating: boolean
  onStatus: (id: string, s: string) => void; onWA: () => void; color: string
}) {
  const [open, setOpen] = useState(false)
  const isDineIn = order.delivery_type === 'dine_in'
  const NEXT_STATUS: Record<string, string> = isDineIn
    ? { pending:'confirmed', confirmed:'preparing', preparing:'ready', ready:'delivered' }
    : { pending:'confirmed', confirmed:'preparing', preparing:'ready', ready:'shipped', shipped:'delivered' }
  const PREV_STATUS: Record<string, string> = isDineIn
    ? { confirmed:'pending', preparing:'confirmed', ready:'preparing', delivered:'ready' }
    : { confirmed:'pending', preparing:'confirmed', ready:'preparing', shipped:'ready', delivered:'shipped' }

  return (
    <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden shadow-sm">
      <button onClick={() => setOpen(o => !o)}
        className="w-full flex items-center gap-3 px-4 py-3.5 hover:bg-gray-50/50 transition-colors">
        <div className="shrink-0">
          <p className="text-xs font-mono text-gray-400">#{String(order.order_number).padStart(4,'0')}</p>
          <span className={`badge text-[10px] mt-0.5 ${orderStatusColor(order.status)}`}>
            {orderStatusLabel(order.status)}
          </span>
        </div>
        <div className="flex-1 min-w-0 text-left">
          <p className="text-sm font-bold text-gray-900">{order.customer_name}</p>
          <p className="text-xs text-gray-400 truncate">
            {order.delivery_type === 'delivery' ? '🛵 Delivery'
              : order.delivery_type === 'dine_in' ? `🍽 ${(order.table as unknown as { name?: string } | null)?.name ?? 'Mesa'}`
              : '🏃 Retiro'}
            {order.delivery_type === 'delivery' && order.customer_address ? ` · ${order.customer_address}` : ''}
          </p>
        </div>
        <div className="text-right shrink-0">
          <p className="text-sm font-bold" style={{ color }}>{formatPrice(order.total, currency)}</p>
          <p className="text-[10px] text-gray-400">
            {new Date(order.created_at).toLocaleTimeString('es-UY', { hour: '2-digit', minute: '2-digit' })}
          </p>
        </div>
        <ChevronRight size={14} className={cn('text-gray-300 transition-transform shrink-0', open && 'rotate-90')} />
      </button>

      {open && (
        <div className="border-t border-gray-100 px-4 pb-4 pt-3 animate-fade-in space-y-3">
          {/* Items */}
          {order.items && order.items.length > 0 && (
            <div className="space-y-1.5">
              {order.items.map((item, i) => (
                <div key={i}>
                  <div className="flex items-center justify-between">
                    <p className="text-sm text-gray-700">
                      <span className="font-bold text-gray-900">{item.quantity}×</span> {item.product_name}
                    </p>
                    <p className="text-sm font-semibold text-gray-900">{formatPrice(item.subtotal, currency)}</p>
                  </div>
                  {(item as unknown as { note?: string | null }).note && (
                    <p className="text-xs text-amber-700 italic ml-4 mt-0.5">
                      ↳ {(item as unknown as { note: string }).note}
                    </p>
                  )}
                </div>
              ))}
              <div className="flex justify-between pt-2 border-t border-gray-100">
                <p className="text-sm font-bold text-gray-900">Total</p>
                <p className="text-sm font-bold" style={{ color }}>{formatPrice(order.total, currency)}</p>
              </div>
            </div>
          )}

          {/* Info cliente */}
          <div className="rounded-xl bg-gray-50 px-3 py-2.5 space-y-1">
            {order.customer_phone && (
              <p className="text-xs text-gray-600 flex items-center gap-1.5">
                <Phone size={11} /> {order.customer_phone}
              </p>
            )}
            {order.customer_address && (
              <p className="text-xs text-gray-600 flex items-center gap-1.5">
                <MapPin size={11} /> {order.customer_address}
              </p>
            )}
            {order.comment && (
              <p className="text-xs text-amber-700 flex items-start gap-1.5">
                💬 {order.comment}
              </p>
            )}
          </div>

          {/* Acciones de estado */}
          <div className="flex items-center gap-2 flex-wrap">
            {NEXT_STATUS[order.status] && (
              <button onClick={() => onStatus(order.id, NEXT_STATUS[order.status])}
                disabled={updating}
                className="flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-bold text-white
                           disabled:opacity-50"
                style={{ background: color }}>
                {updating ? <Loader2 size={11} className="animate-spin" /> : <ChevronRight size={11} />}
                → {orderStatusLabel(NEXT_STATUS[order.status])}
              </button>
            )}
            {order.customer_phone && (
              <button onClick={onWA}
                className="flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-bold text-white bg-green-500">
                <MessageCircle size={11} /> WhatsApp
              </button>
            )}
            {!['cancelled','delivered'].includes(order.status) && (
              <button onClick={() => onStatus(order.id, 'cancelled')}
                className="flex items-center gap-1 rounded-xl px-3 py-2 text-xs font-medium text-red-600 bg-red-50">
                <X size={11} /> Cancelar
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

// ── Mesa components ──────────────────────────────────────────
const MESA_NEXT: Record<string, { label: string; status: string; bg: string }> = {
  pending:   { label: 'Confirmar',   status: 'confirmed', bg: '#059669' },
  confirmed: { label: 'A cocina →',  status: 'preparing', bg: '#7C3AED' },
  preparing: { label: '¡Listo! →',   status: 'ready',     bg: '#059669' },
  ready:     { label: 'Entregado ✓', status: 'delivered', bg: '#10B981' },
}

function MesaGroupCard({ tableId, tableName, orders, currency, color, updating, onStatus, alert, onClearAlert }: {
  tableId: string; tableName: string; orders: Order[]; currency: string; color: string
  updating: string | null; onStatus: (id: string, s: string) => void
  alert: 'waiting_attention' | 'bill_requested' | null
  onClearAlert: (tableId: string) => void
}) {
  const tableTotal = orders.reduce((a, o) => a + o.total, 0)

  return (
    <div className={cn(
      'bg-white rounded-2xl shadow-sm overflow-hidden',
      alert === 'bill_requested' ? 'border-2 border-purple-300' :
      alert === 'waiting_attention' ? 'border-2 border-orange-300' : 'border border-gray-100'
    )}>
      {/* Waiter / bill alert strip */}
      {alert && (
        <div className={cn(
          'flex items-center gap-2 px-4 py-2 text-xs font-bold',
          alert === 'bill_requested' ? 'bg-purple-100 text-purple-800' : 'bg-orange-100 text-orange-800'
        )}>
          <Bell size={12} className="animate-pulse" />
          <span className="flex-1">
            {alert === 'bill_requested' ? '🧾 Pide la cuenta' : '🔔 Llama al mozo'}
          </span>
          <button
            onClick={() => onClearAlert(tableId)}
            className={cn(
              'text-[10px] font-bold px-2 py-0.5 rounded-lg transition-colors',
              alert === 'bill_requested'
                ? 'bg-purple-200 hover:bg-purple-300 text-purple-900'
                : 'bg-orange-200 hover:bg-orange-300 text-orange-900'
            )}>
            Atendido ✓
          </button>
        </div>
      )}

      {/* Table header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 bg-orange-50/60">
        <div className="flex items-center gap-2">
          <UtensilsCrossed size={15} className="text-orange-500 shrink-0" />
          <p className="text-sm font-bold text-orange-800">{tableName}</p>
          <span className="text-[10px] font-bold rounded-full h-5 px-1.5 flex items-center bg-orange-100 text-orange-700">
            {orders.length} pedido{orders.length !== 1 ? 's' : ''}
          </span>
        </div>
        <p className="text-sm font-bold text-orange-800">{formatPrice(tableTotal, currency)}</p>
      </div>

      {/* Orders for this table */}
      <div className="divide-y divide-gray-50">
        {orders.map(order => (
          <MesaOrderRow
            key={order.id}
            order={order}
            currency={currency}
            color={color}
            updating={updating === order.id}
            onStatus={onStatus}
          />
        ))}
      </div>
    </div>
  )
}

function MesaOrderRow({ order, currency, color, updating, onStatus }: {
  order: Order; currency: string; color: string
  updating: boolean; onStatus: (id: string, s: string) => void
}) {
  const [open, setOpen] = useState(false)
  const next = MESA_NEXT[order.status]
  const elapsed = Math.floor((Date.now() - new Date(order.created_at).getTime()) / 60_000)

  return (
    <div>
      <button onClick={() => setOpen(o => !o)}
        className="w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-50/50 transition-colors text-left">
        <div className="shrink-0">
          <p className="text-xs font-mono text-gray-400">#{String(order.order_number).padStart(4,'0')}</p>
          <span className={`badge text-[10px] mt-0.5 ${orderStatusColor(order.status)}`}>
            {orderStatusLabel(order.status)}
          </span>
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-gray-900 truncate">{order.customer_name}</p>
          {order.items && order.items.length > 0 && (
            <p className="text-xs text-gray-400 truncate">
              {order.items.slice(0, 2).map((it, i) =>
                `${i > 0 ? ' · ' : ''}${it.quantity}× ${it.product_name}`
              ).join('')}
              {order.items.length > 2 ? ` +${order.items.length - 2}` : ''}
            </p>
          )}
        </div>
        <div className="text-right shrink-0">
          <p className="text-sm font-bold" style={{ color }}>{formatPrice(order.total, currency)}</p>
          <p className="text-[10px] text-gray-400 flex items-center gap-0.5 justify-end">
            <Clock size={9} /> {elapsed}min
          </p>
        </div>
        <ChevronRight size={14} className={cn('text-gray-300 transition-transform shrink-0', open && 'rotate-90')} />
      </button>

      {open && (
        <div className="border-t border-gray-50 px-4 pb-4 pt-3 animate-fade-in space-y-3 bg-gray-50/30">
          {/* Items */}
          {order.items && order.items.length > 0 && (
            <div className="space-y-1.5">
              {order.items.map((item, i) => (
                <div key={i} className="flex items-center justify-between">
                  <p className="text-sm text-gray-700">
                    <span className="font-bold text-gray-900">{item.quantity}×</span> {item.product_name}
                  </p>
                  <p className="text-sm font-semibold text-gray-900">{formatPrice(item.subtotal, currency)}</p>
                </div>
              ))}
              <div className="flex justify-between pt-2 border-t border-gray-100">
                <p className="text-sm font-bold text-gray-900">Total</p>
                <p className="text-sm font-bold" style={{ color }}>{formatPrice(order.total, currency)}</p>
              </div>
            </div>
          )}

          {order.comment && (
            <p className="text-xs text-amber-700 bg-amber-50 rounded-lg px-2.5 py-1.5">💬 {order.comment}</p>
          )}

          {/* Actions */}
          <div className="flex items-center gap-2">
            {next && (
              <button onClick={() => onStatus(order.id, next.status)}
                disabled={updating}
                className="flex-1 flex items-center justify-center gap-1.5 rounded-xl py-2 text-xs font-bold text-white disabled:opacity-50"
                style={{ background: next.bg }}>
                {updating ? <Loader2 size={11} className="animate-spin" /> : <ChevronRight size={11} />}
                {next.label}
              </button>
            )}
            {!['cancelled', 'delivered'].includes(order.status) && (
              <button onClick={() => onStatus(order.id, 'cancelled')}
                className="flex h-8 w-8 items-center justify-center rounded-xl bg-red-50 text-red-400 hover:bg-red-100 shrink-0">
                <X size={13} />
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

// ── Hours Manager ─────────────────────────────────────────────
function HoursManager({ businessId, hours, onUpdate, color }: {
  businessId: string; hours: BusinessHours[]
  onUpdate: (h: BusinessHours[]) => void; color: string
}) {
  const supabase = createClient()
  const [saving, setSaving] = useState<number | null>(null)
  const [local, setLocal] = useState<BusinessHours[]>(
    DAYS_ES.map((_, i) => {
      const found = hours.find(h => h.day_of_week === i)
      return found ?? { id: '', business_id: businessId, branch_id: null, day_of_week: i, is_open: true, open_time: '09:00', close_time: '22:00' }
    })
  )

  async function saveDay(h: BusinessHours) {
    setSaving(h.day_of_week)
    if (h.id) {
      await supabase.from('business_hours').update({
        is_open: h.is_open, open_time: h.open_time, close_time: h.close_time
      }).eq('id', h.id)
    } else {
      const { data } = await supabase.from('business_hours').insert({
        business_id: businessId, day_of_week: h.day_of_week,
        is_open: h.is_open, open_time: h.open_time, close_time: h.close_time
      }).select('*').single()
      if (data) {
        setLocal(prev => prev.map(x => x.day_of_week === h.day_of_week ? data as BusinessHours : x))
      }
    }
    setSaving(null)
  }

  function update(day: number, field: keyof BusinessHours, value: unknown) {
    setLocal(prev => prev.map(h => h.day_of_week === day ? { ...h, [field]: value } : h))
  }

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-sm font-bold text-gray-900 mb-1">Horarios de atención</h2>
        <p className="text-xs text-gray-400">Configurá los días y horarios en que recibís pedidos</p>
      </div>
      <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden shadow-sm divide-y divide-gray-50">
        {local.map(h => (
          <div key={h.day_of_week} className="flex items-center gap-3 px-4 py-3">
            {/* Toggle abierto/cerrado */}
            <button onClick={() => update(h.day_of_week, 'is_open', !h.is_open)}
              className={cn('relative h-5 w-9 rounded-full transition-colors shrink-0',
                h.is_open ? 'bg-green-500' : 'bg-gray-200')}>
              <span className={cn('absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform',
                h.is_open ? 'left-4' : 'left-0.5')} />
            </button>

            {/* Día */}
            <p className={cn('text-sm font-semibold w-8 shrink-0',
              h.is_open ? 'text-gray-900' : 'text-gray-400')}>
              {DAYS_ES[h.day_of_week]}
            </p>

            {/* Horarios */}
            {h.is_open ? (
              <div className="flex items-center gap-2 flex-1">
                <input type="time" value={h.open_time}
                  onChange={e => update(h.day_of_week, 'open_time', e.target.value)}
                  className="rounded-xl border border-gray-200 px-2.5 py-1.5 text-xs font-medium text-gray-700 flex-1" />
                <span className="text-xs text-gray-400">a</span>
                <input type="time" value={h.close_time}
                  onChange={e => update(h.day_of_week, 'close_time', e.target.value)}
                  className="rounded-xl border border-gray-200 px-2.5 py-1.5 text-xs font-medium text-gray-700 flex-1" />
              </div>
            ) : (
              <p className="text-xs text-gray-400 flex-1">Cerrado</p>
            )}

            {/* Guardar */}
            <button onClick={() => saveDay(h)}
              disabled={saving === h.day_of_week}
              className="flex h-7 w-7 items-center justify-center rounded-lg text-white shrink-0
                         disabled:opacity-50"
              style={{ background: color }}>
              {saving === h.day_of_week
                ? <Loader2 size={11} className="animate-spin" />
                : <Check size={11} />}
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Riders Manager ───────────────────────────────────────────
function RidersManager({ businessId, riders, color, onUpdate }: {
  businessId: string; riders: DeliveryRider[]; color: string
  onUpdate: (r: DeliveryRider[]) => void
}) {
  const supabase = createClient()
  const [open,    setOpen]    = useState(false)
  const [newName, setNewName] = useState('')
  const [newPhone,setNewPhone]= useState('')
  const [saving,  setSaving]  = useState(false)
  const [deleting,setDeleting]= useState<string|null>(null)

  async function addRider() {
    if (!newName.trim()) return
    setSaving(true)
    const { data } = await supabase
      .from('delivery_riders')
      .insert({ business_id: businessId, name: newName.trim(), phone: newPhone.trim() || null, active: true })
      .select('*').single()
    if (data) onUpdate([...riders, data as DeliveryRider])
    setNewName(''); setNewPhone(''); setSaving(false)
  }

  async function toggleActive(r: DeliveryRider) {
    await supabase.from('delivery_riders').update({ active: !r.active }).eq('id', r.id)
    onUpdate(riders.map(x => x.id === r.id ? { ...x, active: !x.active } : x))
  }

  async function deleteRider(id: string) {
    setDeleting(id)
    await supabase.from('delivery_riders').delete().eq('id', id)
    onUpdate(riders.filter(r => r.id !== id))
    setDeleting(null)
  }

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
      <button onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-gray-50 transition-colors">
        <div className="flex items-center gap-2">
          <UserCheck size={15} className="text-gray-400" />
          <p className="text-sm font-semibold text-gray-700">Repartidores</p>
          <span className="text-xs font-bold rounded-full h-5 px-1.5 flex items-center bg-gray-100 text-gray-500">
            {riders.filter(r => r.active).length} activos
          </span>
        </div>
        <ChevronDown size={14} className={cn('text-gray-400 transition-transform', open && 'rotate-180')} />
      </button>

      {open && (
        <div className="border-t border-gray-100 px-4 pb-4 pt-3 space-y-3">
          {/* Lista */}
          {riders.length === 0 ? (
            <p className="text-xs text-gray-400 text-center py-2">Sin repartidores registrados</p>
          ) : (
            <div className="divide-y divide-gray-50">
              {riders.map(r => (
                <div key={r.id} className="flex items-center gap-3 py-2">
                  <div className={cn(
                    'h-7 w-7 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0',
                    r.active ? 'bg-violet-500' : 'bg-gray-300'
                  )}>
                    {r.name.slice(0,1).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className={cn('text-sm font-semibold', r.active ? 'text-gray-900' : 'text-gray-400')}>
                      {r.name}
                    </p>
                    {r.phone && (
                      <p className="text-[11px] text-gray-400">{r.phone}</p>
                    )}
                  </div>
                  <button onClick={() => toggleActive(r)}
                    className={cn(
                      'text-[10px] font-bold px-2 py-0.5 rounded-full transition-colors',
                      r.active ? 'bg-green-100 text-green-700 hover:bg-green-200' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                    )}>
                    {r.active ? 'Activo' : 'Inactivo'}
                  </button>
                  <button onClick={() => deleteRider(r.id)} disabled={deleting === r.id}
                    className="flex h-7 w-7 items-center justify-center rounded-lg text-red-400 hover:bg-red-50 transition-colors">
                    {deleting === r.id
                      ? <Loader2 size={12} className="animate-spin" />
                      : <Trash2 size={12} />}
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Agregar */}
          <div className="flex items-center gap-2 pt-2 border-t border-gray-100">
            <input
              value={newName}
              onChange={e => setNewName(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') addRider() }}
              placeholder="Nombre"
              className="flex-1 rounded-xl border border-gray-200 px-3 py-2 text-xs outline-none
                         focus:ring-2 focus:border-transparent"
              style={{ '--tw-ring-color': color } as React.CSSProperties}
            />
            <input
              value={newPhone}
              onChange={e => setNewPhone(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') addRider() }}
              placeholder="Teléfono (opcional)"
              className="w-36 rounded-xl border border-gray-200 px-3 py-2 text-xs outline-none
                         focus:ring-2 focus:border-transparent"
              style={{ '--tw-ring-color': color } as React.CSSProperties}
            />
            <button onClick={addRider} disabled={saving || !newName.trim()}
              className="flex h-8 w-8 items-center justify-center rounded-xl text-white shrink-0 disabled:opacity-50"
              style={{ background: color }}>
              {saving ? <Loader2 size={12} className="animate-spin" /> : <Plus size={13} />}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Food Stats ────────────────────────────────────────────────
function FoodStats({ orders, currency, color }: { orders: Order[]; currency: string; color: string }) {
  const confirmed = orders.filter(o => o.confirmed_sale)
  const revenue = confirmed.reduce((a, o) => a + o.total, 0)
  const avgTicket = confirmed.length > 0 ? revenue / confirmed.length : 0
  const deliveries = orders.filter(o => o.delivery_type === 'delivery').length
  const pickups    = orders.filter(o => o.delivery_type === 'pickup').length
  const mesas      = orders.filter(o => o.delivery_type === 'dine_in').length

  // Top productos del día
  const productMap: Record<string, { qty: number; revenue: number }> = {}
  orders.forEach(o => {
    o.items?.forEach(item => {
      if (!productMap[item.product_name]) productMap[item.product_name] = { qty: 0, revenue: 0 }
      productMap[item.product_name].qty += item.quantity
      productMap[item.product_name].revenue += item.subtotal
    })
  })
  const topProducts = Object.entries(productMap)
    .map(([name, v]) => ({ name, ...v }))
    .sort((a, b) => b.qty - a.qty)
    .slice(0, 5)

  const maxQty = topProducts[0]?.qty ?? 1

  return (
    <div className="space-y-4">
      {/* KPIs */}
      <div className="grid grid-cols-2 gap-3">
        {[
          { label: 'Pedidos hoy', value: orders.length },
          { label: 'Ingresos hoy', value: formatPrice(revenue, currency) },
          { label: 'Ticket promedio', value: formatPrice(avgTicket, currency) },
          { label: 'Cancelados', value: orders.filter(o => o.status === 'cancelled').length },
        ].map(({ label, value }) => (
          <div key={label} className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm">
            <p className="text-xs text-gray-400 mb-1">{label}</p>
            <p className="text-lg font-bold text-gray-900">{value}</p>
          </div>
        ))}
      </div>

      {/* Tipos de entrega */}
      <div className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm">
        <p className="text-sm font-semibold text-gray-700 mb-3">Tipos de entrega</p>
        {[
          { label: 'Delivery', count: deliveries, bg: color },
          { label: 'Retiro',   count: pickups,    bg: '#7C3AED' },
          { label: 'Mesa',     count: mesas,      bg: '#F59E0B' },
        ].map(({ label, count, bg }) => (
          <div key={label} className="flex items-center gap-3 mb-2">
            <div className="flex-1 bg-gray-100 rounded-full h-3 overflow-hidden">
              <div className="h-full rounded-full transition-all"
                style={{ width: `${orders.length > 0 ? (count / orders.length) * 100 : 0}%`, background: bg }} />
            </div>
            <p className="text-xs text-gray-600 shrink-0 w-20 text-right">{count} {label.toLowerCase()}</p>
          </div>
        ))}
      </div>

      {/* Top productos del día */}
      <div className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm">
        <p className="text-sm font-semibold text-gray-700 mb-3">Más pedidos hoy</p>
        {topProducts.length === 0 ? (
          <p className="text-xs text-gray-400 text-center py-4">Sin datos todavía</p>
        ) : (
          <div className="space-y-3">
            {topProducts.map((p, i) => (
              <div key={p.name} className="flex items-center gap-2">
                <span className="text-xs font-bold w-4 text-center text-gray-400">{i + 1}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex justify-between items-baseline mb-1">
                    <p className="text-xs font-medium text-gray-800 truncate">{p.name}</p>
                    <p className="text-xs text-gray-500 shrink-0 ml-1">{p.qty} uds</p>
                  </div>
                  <div className="h-1.5 rounded-full bg-gray-100 overflow-hidden">
                    <div className="h-full rounded-full"
                      style={{ width: `${(p.qty / maxQty) * 100}%`, background: color }} />
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

// ── Menu Availability Tab ─────────────────────────────────────
function MenuAvailabilityTab({
  businessId, initialProducts, categories, color,
}: {
  businessId: string
  initialProducts: Product[]
  categories: Category[]
  color: string
}) {
  const supabase = createClient()
  const [products,     setProducts]     = useState<Product[]>(initialProducts)
  const [toggling,     setToggling]     = useState<string | null>(null)
  const [search,       setSearch]       = useState('')
  const [deleteTarget, setDeleteTarget] = useState<Product | null>(null)
  const [deleting,     setDeleting]     = useState(false)

  const unavailable = products.filter(p => !p.active).length

  async function toggleAvailable(product: Product) {
    setToggling(product.id)
    const newActive = !product.active
    await supabase.from('products').update({ active: newActive }).eq('id', product.id)
    setProducts(prev => prev.map(p => p.id === product.id ? { ...p, active: newActive } : p))
    setToggling(null)
  }

  async function deleteProduct() {
    if (!deleteTarget) return
    setDeleting(true)
    await supabase.from('products').delete().eq('id', deleteTarget.id)
    setProducts(prev => prev.filter(p => p.id !== deleteTarget.id))
    setDeleteTarget(null)
    setDeleting(false)
  }

  const filtered = search.trim()
    ? products.filter(p => p.name.toLowerCase().includes(search.toLowerCase()))
    : products

  // Group by category
  const grouped: { cat: Category | null; items: Product[] }[] = []
  categories.forEach(cat => {
    const items = filtered.filter(p => p.category_id === cat.id)
    if (items.length > 0) grouped.push({ cat, items })
  })
  const uncategorized = filtered.filter(p => !p.category_id)
  if (uncategorized.length > 0) grouped.push({ cat: null, items: uncategorized })

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-gray-700">Disponibilidad del menú</p>
          <p className="text-xs text-gray-400 mt-0.5">
            Activá o desactivá platos durante el servicio
            {unavailable > 0 && (
              <span className="ml-1.5 inline-flex items-center rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-bold text-red-700">
                {unavailable} no disponible{unavailable > 1 ? 's' : ''}
              </span>
            )}
          </p>
        </div>
      </div>

      {/* Search */}
      <div className="relative">
        <input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Buscar plato..."
          className="w-full rounded-xl border border-gray-200 bg-white pl-4 pr-9 py-2.5 text-sm
                     outline-none focus:border-gray-400 placeholder:text-gray-300"
        />
        {search && (
          <button onClick={() => setSearch('')}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
            <X size={13} />
          </button>
        )}
      </div>

      {/* Product list grouped by category */}
      {grouped.length === 0 ? (
        <div className="rounded-2xl border-2 border-dashed border-gray-200 py-12 text-center">
          <BookOpen size={24} className="mx-auto text-gray-200 mb-2" />
          <p className="text-sm text-gray-400">Sin productos</p>
        </div>
      ) : (
        <div className="space-y-4">
          {grouped.map(({ cat, items }) => (
            <div key={cat?.id ?? 'uncategorized'} className="bg-white rounded-2xl border border-gray-100 overflow-hidden shadow-sm">
              <div className="px-4 py-3 border-b border-gray-50 bg-gray-50/60">
                <p className="text-xs font-bold text-gray-500 uppercase tracking-wide">
                  {cat?.name ?? 'Sin categoría'}
                </p>
              </div>
              <div className="divide-y divide-gray-50">
                {items.map(product => (
                  <div key={product.id}
                    className={cn('flex items-center gap-3 px-4 py-3 transition-colors',
                      !product.active && 'bg-gray-50/80'
                    )}>
                    <div className="flex-1 min-w-0">
                      <p className={cn(
                        'text-sm font-medium leading-tight',
                        product.active ? 'text-gray-900' : 'text-gray-400 line-through'
                      )}>
                        {product.name}
                      </p>
                      {!product.active && (
                        <span className="inline-flex items-center mt-0.5 rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-bold text-red-600">
                          No disponible
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        onClick={() => toggleAvailable(product)}
                        disabled={toggling === product.id}
                        title={product.active ? 'Marcar como no disponible' : 'Marcar como disponible'}
                        className="transition-all disabled:opacity-40"
                      >
                        {toggling === product.id
                          ? <Loader2 size={20} className="animate-spin text-gray-400" />
                          : product.active
                            ? <ToggleRight size={24} style={{ color }} />
                            : <ToggleLeft size={24} className="text-gray-300" />
                        }
                      </button>
                      <button
                        onClick={() => setDeleteTarget(product)}
                        title="Eliminar plato"
                        className="flex h-7 w-7 items-center justify-center rounded-lg text-red-300 hover:bg-red-50 hover:text-red-600 transition-all"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      <p className="text-xs text-gray-400 text-center pb-2">
        Los cambios se reflejan en la tienda en tiempo real.
      </p>

      {/* Delete confirmation */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl p-6 max-w-sm w-full space-y-4">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-red-50">
                <AlertTriangle size={18} className="text-red-500" />
              </div>
              <div>
                <p className="font-semibold text-gray-900">¿Eliminar plato?</p>
                <p className="text-sm text-gray-500 mt-1">
                  <span className="font-medium text-gray-700">{deleteTarget.name}</span> se eliminará
                  permanentemente. Esta acción no se puede deshacer.
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 pt-1">
              <button
                onClick={() => setDeleteTarget(null)}
                className="flex-1 rounded-xl border border-gray-200 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-50 transition-all"
              >
                Cancelar
              </button>
              <button
                onClick={deleteProduct}
                disabled={deleting}
                className="flex-1 rounded-xl py-2.5 text-sm font-semibold text-white bg-red-500 hover:bg-red-600 disabled:opacity-60 transition-all"
              >
                {deleting ? 'Eliminando…' : 'Eliminar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ── POS Modal ────────────────────────────────────────────────────
type PosItem = { product: Product; quantity: number; note: string }

function POSModal({ businessId, products, categories, currency, color, onClose, onCreated }: {
  businessId: string
  products: Product[]
  categories: Category[]
  currency: string
  color: string
  onClose: () => void
  onCreated: (order: Order) => void
}) {
  const supabase = createClient()
  const [items,        setItems]        = useState<PosItem[]>([])
  const [customerName, setCustomerName] = useState('')
  const [tableId,      setTableId]      = useState<string | null>(null)
  const [tables,       setTables]       = useState<{ id: string; name: string }[]>([])
  const [isPOS,        setIsPOS]        = useState(false)
  const [comment,      setComment]      = useState('')
  const [search,       setSearch]       = useState('')
  const [loading,      setLoading]      = useState(false)
  const [activeTab,    setActiveTab]    = useState<'products' | 'cart'>('products')
  const [success,      setSuccess]      = useState<{ orderId: string; orderNumber: number; total: number; name: string } | null>(null)

  useEffect(() => {
    supabase.from('restaurant_tables')
      .select('id, name')
      .eq('business_id', businessId)
      .order('name')
      .then(({ data }) => setTables(data ?? []))
  }, [businessId])

  const activeProducts = products.filter(p => p.active)
  const filtered = search
    ? activeProducts.filter(p => p.name.toLowerCase().includes(search.toLowerCase()))
    : activeProducts

  const grouped = useMemo(() => {
    const map: Record<string, Product[]> = {}
    filtered.forEach(p => {
      const k = p.category_id ?? '__none'
      if (!map[k]) map[k] = []
      map[k].push(p)
    })
    return [
      ...categories.filter(c => map[c.id]?.length).map(c => ({ cat: c, prods: map[c.id] })),
      ...(map['__none']?.length ? [{ cat: null, prods: map['__none'] }] : []),
    ]
  }, [filtered, categories])

  const subtotal = items.reduce((a, i) => a + i.product.price * i.quantity, 0)
  const cartCount = items.reduce((a, i) => a + i.quantity, 0)

  function addItem(product: Product) {
    setItems(prev => {
      const ex = prev.find(i => i.product.id === product.id)
      if (ex) return prev.map(i => i.product.id === product.id ? { ...i, quantity: i.quantity + 1 } : i)
      return [...prev, { product, quantity: 1, note: '' }]
    })
  }

  function setQty(productId: string, qty: number) {
    if (qty <= 0) setItems(prev => prev.filter(i => i.product.id !== productId))
    else setItems(prev => prev.map(i => i.product.id === productId ? { ...i, quantity: qty } : i))
  }

  async function submit() {
    if (!items.length || loading) return
    setLoading(true)
    const resolvedName = customerName.trim() ||
      (tableId ? (tables.find(t => t.id === tableId)?.name ?? 'Local') : 'Local')
    try {
      const res = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          businessId,
          items: items.map(({ product, quantity, note }) => ({
            product, quantity, note: note.trim() || undefined,
          })),
          customerName: resolvedName,
          deliveryType: tableId ? 'dine_in' : 'pickup',
          tableId: tableId || null,
          pos: isPOS,
          comment: comment.trim() || undefined,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      const newOrder: Order = {
        id: data.orderId,
        order_number: data.orderNumber,
        status: isPOS ? 'delivered' : 'pending',
        confirmed_sale: isPOS,
        payment_status: isPOS ? 'paid' : 'unpaid',
        customer_name: resolvedName,
        delivery_type: tableId ? 'dine_in' : 'pickup',
        subtotal,
        total: subtotal,
        table_id: tableId,
        business_id: businessId,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        items: items.map(({ product, quantity, note }) => ({
          id: crypto.randomUUID(),
          order_id: data.orderId,
          product_id: product.id,
          product_name: product.name,
          unit_price: product.price,
          quantity,
          subtotal: product.price * quantity,
          note: note.trim() || null,
        })),
      }
      onCreated(newOrder)
      setSuccess({ orderId: data.orderId, orderNumber: data.orderNumber, total: subtotal, name: resolvedName })
    } catch {
      alert('Error al crear el pedido. Verifica la conexión.')
    }
    setLoading(false)
  }

  function resetForm() {
    setItems([])
    setCustomerName('')
    setTableId(null)
    setComment('')
    setSearch('')
    setIsPOS(false)
    setActiveTab('products')
    setSuccess(null)
  }

  // ── Success screen ──────────────────────────────────────────
  if (success) {
    return (
      <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
        <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
        <div className="relative w-full sm:max-w-sm bg-white sm:rounded-2xl shadow-2xl flex flex-col items-center px-8 py-10 text-center">
          <div className="h-16 w-16 rounded-2xl flex items-center justify-center mb-4"
            style={{ background: color + '18' }}>
            <Check size={32} style={{ color }} />
          </div>
          <p className="text-xl font-black text-gray-900">¡Comanda creada!</p>
          <p className="text-gray-500 text-sm mt-1 mb-1">{success.name}</p>
          <p className="text-4xl font-black tracking-tight mt-2" style={{ color }}>
            #{String(success.orderNumber).padStart(4, '0')}
          </p>
          <p className="text-sm text-gray-400 mt-1 mb-6">{formatPrice(success.total, currency)}</p>

          <div className="flex flex-col gap-2.5 w-full">
            <a
              href={`/comanda/${success.orderId}`}
              target="_blank"
              rel="noopener"
              className="flex items-center justify-center gap-2 w-full rounded-xl py-3 text-sm font-bold text-white transition-all hover:opacity-90"
              style={{ background: color }}>
              <Printer size={15} /> Imprimir comanda
            </a>
            <button
              onClick={resetForm}
              className="flex items-center justify-center gap-2 w-full rounded-xl py-3 text-sm font-bold bg-gray-100 text-gray-700 hover:bg-gray-200 transition-all">
              <Plus size={15} /> Nuevo pedido
            </button>
            <button onClick={onClose} className="text-xs text-gray-400 hover:text-gray-600 mt-1">
              Cerrar
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full sm:max-w-2xl bg-white sm:rounded-2xl shadow-2xl flex flex-col"
        style={{ maxHeight: '95dvh' }}>

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 shrink-0">
          <div>
            <p className="font-bold text-gray-900">Nueva comanda</p>
            <p className="text-xs text-gray-400">Crea un pedido manual desde el local</p>
          </div>
          <button onClick={onClose}
            className="h-8 w-8 flex items-center justify-center rounded-xl bg-gray-100 text-gray-500 hover:bg-gray-200">
            <X size={15} />
          </button>
        </div>

        {/* Mobile tabs */}
        <div className="sm:hidden flex border-b border-gray-100 shrink-0">
          {(['products', 'cart'] as const).map(t => (
            <button key={t} onClick={() => setActiveTab(t)}
              className={cn('flex-1 py-3 text-xs font-semibold flex items-center justify-center gap-1.5',
                activeTab === t ? 'text-gray-900 border-b-2 border-gray-900' : 'text-gray-400')}>
              {t === 'products' ? <><Package size={12} /> Productos</> : <><ShoppingBag size={12} /> Carrito {cartCount > 0 && `(${cartCount})`}</>}
            </button>
          ))}
        </div>

        {/* Body */}
        <div className="flex-1 overflow-hidden">
          <div className="h-full sm:grid sm:grid-cols-[1fr_300px]">

            {/* Left: product picker */}
            <div className={cn('flex flex-col overflow-hidden border-r border-gray-100',
              activeTab !== 'products' && 'hidden sm:flex')}>
              <div className="p-3 border-b border-gray-50 shrink-0">
                <input type="text" placeholder="Buscar producto..."
                  value={search} onChange={e => setSearch(e.target.value)}
                  className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-sm outline-none focus:border-gray-400" />
              </div>
              <div className="flex-1 overflow-y-auto p-3 space-y-4">
                {grouped.map(({ cat, prods }) => (
                  <div key={cat?.id ?? 'none'}>
                    {cat && (
                      <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wide mb-2">{cat.name}</p>
                    )}
                    <div className="grid grid-cols-2 gap-2">
                      {prods.map(product => {
                        const inCart = items.find(i => i.product.id === product.id)
                        return (
                          <button key={product.id} onClick={() => { addItem(product); setActiveTab('cart') }}
                            className={cn(
                              'relative text-left rounded-xl border p-3 transition-all',
                              inCart ? 'bg-gray-50' : 'border-gray-200 hover:border-gray-300 bg-white'
                            )}
                            style={inCart ? { borderColor: color, borderWidth: 2 } : {}}>
                            {inCart && (
                              <span className="absolute top-1.5 right-1.5 h-5 w-5 flex items-center justify-center rounded-full text-[10px] font-black text-white"
                                style={{ background: color }}>
                                {inCart.quantity}
                              </span>
                            )}
                            <p className="text-xs font-semibold text-gray-900 leading-tight pr-6 truncate">{product.name}</p>
                            <p className="text-[11px] text-gray-500 mt-0.5">{formatPrice(product.price, currency)}</p>
                          </button>
                        )
                      })}
                    </div>
                  </div>
                ))}
                {filtered.length === 0 && (
                  <p className="text-sm text-gray-400 text-center py-6">Sin productos activos</p>
                )}
              </div>
            </div>

            {/* Right: cart + options */}
            <div className={cn('flex flex-col overflow-hidden',
              activeTab !== 'cart' && 'hidden sm:flex')}>
              <div className="flex-1 overflow-y-auto p-3 space-y-2">
                {items.length === 0 ? (
                  <div className="flex items-center justify-center h-32">
                    <p className="text-sm text-gray-300 text-center">Sin productos aún</p>
                  </div>
                ) : (
                  items.map(({ product, quantity, note }) => (
                    <div key={product.id} className="rounded-xl border border-gray-100 p-2.5 space-y-1.5">
                      <div className="flex items-center gap-2">
                        <p className="text-xs font-semibold text-gray-900 flex-1 truncate">{product.name}</p>
                        <div className="flex items-center gap-1 shrink-0">
                          <button onClick={() => setQty(product.id, quantity - 1)}
                            className="h-5 w-5 rounded-lg bg-gray-100 flex items-center justify-center text-gray-600 hover:bg-red-50 hover:text-red-500">
                            <Minus size={9} />
                          </button>
                          <span className="text-xs font-bold w-4 text-center">{quantity}</span>
                          <button onClick={() => setQty(product.id, quantity + 1)}
                            className="h-5 w-5 rounded-lg bg-gray-100 flex items-center justify-center text-gray-600 hover:bg-gray-200">
                            <Plus size={9} />
                          </button>
                        </div>
                        <p className="text-xs font-bold text-gray-900 w-14 text-right shrink-0">
                          {formatPrice(product.price * quantity, currency)}
                        </p>
                      </div>
                      <input type="text" placeholder="Nota del ítem..."
                        value={note}
                        onChange={e => setItems(prev => prev.map(i =>
                          i.product.id === product.id ? { ...i, note: e.target.value } : i
                        ))}
                        maxLength={80}
                        className="w-full text-[11px] rounded-lg border border-gray-100 bg-gray-50 px-2 py-1 outline-none focus:border-gray-300" />
                    </div>
                  ))
                )}
              </div>

              {/* Options */}
              <div className="p-3 space-y-2 border-t border-gray-100 shrink-0">
                <input type="text" placeholder="Nombre del cliente / mesa..."
                  value={customerName} onChange={e => setCustomerName(e.target.value)}
                  className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-sm outline-none focus:border-gray-400" />

                {tables.length > 0 && (
                  <select value={tableId ?? ''} onChange={e => setTableId(e.target.value || null)}
                    className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-sm outline-none focus:border-gray-400">
                    <option value="">Sin mesa asignada</option>
                    {tables.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                  </select>
                )}

                <input type="text" placeholder="Comentario general..."
                  value={comment} onChange={e => setComment(e.target.value)} maxLength={200}
                  className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-sm outline-none focus:border-gray-400" />

                {/* POS toggle */}
                <div className="flex items-center gap-3 rounded-xl bg-gray-50 border border-gray-100 px-3 py-2.5">
                  <div className="flex-1">
                    <p className="text-xs font-semibold text-gray-700">{isPOS ? 'Venta directa (POS)' : 'Enviar a cocina'}</p>
                    <p className="text-[10px] text-gray-400">
                      {isPOS ? 'Se registra como entregada y pagada' : 'Aparece en cocina como pedido pendiente'}
                    </p>
                  </div>
                  <button onClick={() => setIsPOS(p => !p)} className="shrink-0 transition-all">
                    {isPOS
                      ? <ToggleRight size={24} style={{ color }} />
                      : <ToggleLeft size={24} className="text-gray-300" />}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-4 border-t border-gray-100 flex items-center justify-between gap-3 shrink-0">
          <div>
            <p className="text-[10px] text-gray-400">Total</p>
            <p className="text-xl font-black text-gray-900">{formatPrice(subtotal, currency)}</p>
          </div>
          <button
            onClick={submit}
            disabled={items.length === 0 || loading}
            className="flex items-center gap-2 rounded-xl px-6 py-3 text-sm font-bold text-white disabled:opacity-40 transition-all hover:opacity-90"
            style={{ background: color }}>
            {loading ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
            {isPOS ? 'Registrar venta' : 'Enviar a cocina'}
          </button>
        </div>
      </div>
    </div>
  )
}
