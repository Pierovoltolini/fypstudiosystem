// app/admin/orders/OrdersClient.tsx
'use client'
import { useState, useMemo, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import {
  ShoppingBag, Search, ChevronDown, ChevronRight,
  MessageCircle, MapPin, Clock, Loader2, PackageCheck, Download, Bell, Printer,
} from 'lucide-react'
import { cn, formatPrice } from '@/lib/utils'
import Link from 'next/link'
import type { Order } from '@/types'
import { useVertical } from '@/lib/vertical-context'
import SectionTour from '@/components/admin/SectionTour'

// ── Constantes ────────────────────────────────────────────────
type DateRange = 'today' | '7d' | '30d' | '60d'
type StatusFilter = 'all' | string

const DATE_RANGES: { key: DateRange; label: string; days: number | null }[] = [
  { key: 'today', label: 'Hoy',      days: 0  },
  { key: '7d',    label: '7 días',   days: 7  },
  { key: '30d',   label: '30 días',  days: 30 },
  { key: '60d',   label: '60 días',  days: 60 },
]

const STATUS_CONF: Record<string, { label: string; bg: string; text: string; border: string }> = {
  pending:   { label: 'Pendiente',   bg: '#FEF3C7', text: '#92400E', border: '#FDE68A' },
  confirmed: { label: 'Confirmado',  bg: '#DBEAFE', text: '#1E40AF', border: '#BFDBFE' },
  preparing: { label: 'En proceso',  bg: '#EDE9FE', text: '#5B21B6', border: '#DDD6FE' },
  ready:     { label: 'Listo',       bg: '#D1FAE5', text: '#065F46', border: '#A7F3D0' },
  shipped:   { label: 'Enviado',     bg: '#CFFAFE', text: '#164E63', border: '#A5F3FC' },
  delivered: { label: 'Entregado',   bg: '#F3F4F6', text: '#374151', border: '#E5E7EB' },
  done:      { label: 'Realizado',   bg: '#F3F4F6', text: '#374151', border: '#E5E7EB' },
  cancelled: { label: 'Cancelado',   bg: '#FEE2E2', text: '#991B1B', border: '#FECACA' },
}

const NEXT_STATUS: Record<string, string> = {
  pending: 'confirmed', confirmed: 'preparing', preparing: 'ready',
  ready: 'shipped', shipped: 'delivered',
}

function playChime() {
  try {
    type AudioCtxCtor = typeof AudioContext
    const Ctx = (window.AudioContext ?? (window as unknown as { webkitAudioContext: AudioCtxCtor }).webkitAudioContext)
    if (!Ctx) return
    const ctx = new Ctx()

    const tone = (freq: number, start: number, duration: number, vol = 0.25) => {
      const osc  = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.connect(gain); gain.connect(ctx.destination)
      osc.type = 'sine'
      osc.frequency.setValueAtTime(freq, ctx.currentTime + start)
      gain.gain.setValueAtTime(vol, ctx.currentTime + start)
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + start + duration)
      osc.start(ctx.currentTime + start)
      osc.stop(ctx.currentTime + start + duration)
    }

    tone(880, 0,    0.18)
    tone(1108, 0.2, 0.22)
  } catch { /* audio blocked — silent */ }
}

export default function OrdersClient({ orders: initialOrders }: { orders: Order[] }) {
  const { businessId, currency, color: primaryColor, vertical } = useVertical()
  const orderLabel = vertical.orderLabel
  const supabase   = createClient()

  const [orders,    setOrders]    = useState<Order[]>(initialOrders)
  const [search,    setSearch]    = useState('')
  const [dateRange, setDateRange] = useState<DateRange>('30d')
  const [status,    setStatus]    = useState<StatusFilter>('all')
  const [updating,  setUpdating]  = useState<string | null>(null)
  const [expanded,  setExpanded]  = useState<string | null>(null)
  const [stockToast,    setStockToast]    = useState(false)
  const [newOrderToast, setNewOrderToast] = useState<Order | null>(null)
  const [freshOrderIds, setFreshOrderIds] = useState<Set<string>>(new Set())
  const [soundEnabled,  setSoundEnabled]  = useState(() => {
    if (typeof window === 'undefined') return true
    return localStorage.getItem('fyp_order_sound') !== 'off'
  })

  const orderLabelPlural = orderLabel + 's'

  // ── Real-time subscription ────────────────────────────────
  const handleNewOrder = useCallback(async (rawOrder: Record<string, unknown>) => {
    // Fetch full order with items
    const { data } = await supabase
      .from('orders')
      .select('id, business_id, order_number, status, payment_status, confirmed_sale, delivery_type, total, subtotal, comment, customer_name, customer_phone, customer_address, table_id, table:restaurant_tables(id,name), created_at, updated_at, items:order_items(product_name, quantity, unit_price, subtotal)')
      .eq('id', rawOrder.id as string)
      .single()

    if (!data) return
    const order = data as unknown as Order
    setOrders(prev => {
      if (prev.some(o => o.id === order.id)) return prev
      return [order, ...prev]
    })
    setFreshOrderIds(prev => new Set(Array.from(prev).concat(order.id)))
    setTimeout(() => setFreshOrderIds(prev => { const n = new Set(Array.from(prev)); n.delete(order.id); return n }), 8000)
    if (soundEnabled) playChime()
    setNewOrderToast(order)
    setTimeout(() => setNewOrderToast(null), 5000)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [soundEnabled])

  useEffect(() => {
    if (!businessId) return
    const ch = supabase
      .channel(`orders-live-${businessId}`)
      .on('postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'orders', filter: `business_id=eq.${businessId}` },
        payload => { void handleNewOrder(payload.new as Record<string, unknown>) }
      )
      .on('postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'orders', filter: `business_id=eq.${businessId}` },
        payload => {
          setOrders(prev => prev.map(o =>
            o.id === (payload.new as Order).id ? { ...o, ...(payload.new as Partial<Order>) } : o
          ))
        }
      )
      .subscribe()
    return () => { void supabase.removeChannel(ch) }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [businessId, handleNewOrder])

  // ── Filtrado ──────────────────────────────────────────────
  const filtered = useMemo(() => {
    const now   = new Date()
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    const conf  = DATE_RANGES.find(r => r.key === dateRange)!

    const from = conf.days === 0
      ? today
      : new Date(today.getTime() - (conf.days ?? 60) * 86_400_000)

    const q = search.toLowerCase()

    return orders.filter(o => {
      const d = new Date(o.created_at)
      if (d < from) return false
      if (status !== 'all' && o.status !== status) return false
      if (q) {
        const num = String(o.order_number).padStart(4, '0')
        if (!o.customer_name.toLowerCase().includes(q) &&
            !(o.customer_phone ?? '').includes(q) &&
            !num.includes(q)) return false
      }
      return true
    })
  }, [orders, search, dateRange, status])

  // ── Conteos por estado ────────────────────────────────────
  const statusCounts = useMemo(() => {
    const counts: Record<string, number> = { all: filtered.length }
    // count from full date-filtered set (not status-filtered)
    orders.forEach(o => { counts[o.status] = (counts[o.status] ?? 0) + 1 })
    return counts
  }, [orders, filtered])

  // Estados únicos presentes
  const presentStatuses = useMemo(() => {
    const seen = new Set<string>()
    orders.forEach(o => seen.add(o.status))
    return Array.from(seen).filter(s => s in STATUS_CONF)
  }, [orders])

  // ── KPIs rápidos ──────────────────────────────────────────
  const revenue = filtered.filter(o => o.confirmed_sale).reduce((a, o) => a + o.total, 0)
  const pending = filtered.filter(o => o.status === 'pending').length

  // ── Document title badge ──────────────────────────────────
  useEffect(() => {
    const base = `${orderLabelPlural} — FYP Studio`
    document.title = pending > 0 ? `(${pending}) ${base}` : base
    return () => { document.title = 'FYP Studio' }
  }, [pending, orderLabelPlural])

  // ── Avanzar estado ────────────────────────────────────────
  async function advanceStatus(orderId: string, newStatus: string) {
    setUpdating(orderId)
    const confirmedSale =
      newStatus === 'delivered' || newStatus === 'done' ? true :
      newStatus === 'cancelled' ? false : undefined
    const patch = confirmedSale !== undefined
      ? { status: newStatus, confirmed_sale: confirmedSale }
      : { status: newStatus }
    await supabase.from('orders').update(patch).eq('id', orderId)
    setOrders(prev => prev.map(o =>
      o.id === orderId
        ? { ...o, status: newStatus as Order['status'], ...(confirmedSale !== undefined && { confirmed_sale: confirmedSale }) }
        : o
    ))
    setUpdating(null)
    // Trigger automático descontó stock en DB — avisar al operador
    if (newStatus === 'confirmed') {
      setStockToast(true)
      setTimeout(() => setStockToast(false), 3500)
    }
  }

  // ── Export CSV ────────────────────────────────────────────
  function exportCSV() {
    const rows = [
      ['#', 'Cliente', 'Teléfono', 'Estado', 'Tipo', 'Total', 'Fecha'],
      ...filtered.map(o => [
        String(o.order_number).padStart(4, '0'),
        o.customer_name,
        o.customer_phone ?? '',
        STATUS_CONF[o.status]?.label ?? o.status,
        o.delivery_type === 'delivery' ? 'Delivery' : o.delivery_type === 'dine_in' ? `Mesa ${o.table?.name ?? ''}`.trim() : 'Retiro',
        o.total,
        new Date(o.created_at).toLocaleDateString('es-UY'),
      ]),
    ]
    const csv = rows.map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n')
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' })
    const url  = URL.createObjectURL(blob)
    const a    = document.createElement('a'); a.href = url
    a.download = `pedidos_${new Date().toISOString().slice(0, 10)}.csv`
    a.click(); URL.revokeObjectURL(url)
  }

  // ── WhatsApp ──────────────────────────────────────────────
  function waLink(order: Order) {
    if (!order.customer_phone) return undefined
    const phone = order.customer_phone.replace(/\D/g, '')
    const num   = String(order.order_number).padStart(4, '0')
    const msg   = encodeURIComponent(
      `Hola ${order.customer_name}! Tu ${orderLabel.toLowerCase()} #${num} ya está listo. 🎉`
    )
    return `https://wa.me/${phone}?text=${msg}`
  }

  return (
    <div className="space-y-4 animate-fade-in">
      <SectionTour section="orders" />

      {/* New order toast — por encima del bottom nav en mobile (bottom-24) */}
      {newOrderToast && (
        <div className="fixed bottom-24 right-4 lg:bottom-6 lg:right-6 z-50 flex items-center gap-3
                        bg-gray-900 text-white rounded-2xl px-5 py-3.5 shadow-2xl
                        border border-white/10 animate-slide-up max-w-xs">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-amber-500">
            <Bell size={16} className="text-white" />
          </div>
          <div className="min-w-0">
            <p className="text-xs font-black text-amber-400 tracking-wider uppercase">Nuevo pedido</p>
            <p className="text-sm font-semibold truncate">
              #{String(newOrderToast.order_number).padStart(4, '0')} · {newOrderToast.customer_name}
            </p>
            <p className="text-xs text-gray-400">{formatPrice(newOrderToast.total, currency)}</p>
          </div>
          <button onClick={() => setNewOrderToast(null)}
            className="text-gray-500 hover:text-white ml-1 shrink-0 text-lg leading-none font-bold">
            ×
          </button>
        </div>
      )}

      {/* Stock toast — por encima del bottom nav en mobile */}
      {stockToast && (
        <div className="fixed bottom-24 left-1/2 -translate-x-1/2 lg:bottom-6 z-50 flex items-center gap-2.5
                        bg-gray-900 text-white text-sm font-medium rounded-2xl px-5 py-3 shadow-2xl
                        animate-slide-up">
          <PackageCheck size={15} className="text-green-400 shrink-0" />
          Stock descontado automáticamente
        </div>
      )}

      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-xl lg:text-2xl font-bold text-gray-900 tracking-tight">
            {orderLabelPlural}
          </h1>
          <p className="text-sm text-gray-400 mt-0.5">{filtered.length} resultado{filtered.length !== 1 ? 's' : ''}</p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={() => {
              const next = !soundEnabled
              setSoundEnabled(next)
              localStorage.setItem('fyp_order_sound', next ? 'on' : 'off')
            }}
            title={soundEnabled ? 'Silenciar notificaciones' : 'Activar notificaciones de sonido'}
            className={cn(
              'flex h-9 w-9 items-center justify-center rounded-xl border transition-all',
              soundEnabled
                ? 'border-blue-200 bg-blue-50 text-blue-500 hover:bg-blue-100'
                : 'border-gray-200 bg-white text-gray-300 hover:bg-gray-50'
            )}>
            <Bell size={14} />
          </button>
          {filtered.length > 0 && (
            <button onClick={exportCSV}
              className="flex items-center gap-1.5 rounded-xl border border-gray-200 bg-white
                         px-3 py-2 text-xs font-semibold text-gray-600 hover:bg-gray-50 transition-all">
              <Download size={13} />
              <span className="hidden sm:inline">CSV</span>
            </button>
          )}
        </div>
      </div>

      {/* KPI micro-row */}
      <div className="grid grid-cols-3 gap-2">
        {[
          { label: 'En período',  value: filtered.length,              color: primaryColor },
          { label: 'Pendientes',  value: pending,                      color: pending > 0 ? '#F59E0B' : '#9CA3AF' },
          { label: 'Facturado',   value: formatPrice(revenue, currency), color: '#10B981' },
        ].map(({ label, value, color }) => (
          <div key={label} className="bg-white rounded-2xl border border-gray-100 p-3 text-center shadow-sm">
            <p className="text-sm font-bold text-gray-900 truncate">{value}</p>
            <p className="text-xs text-gray-400 mt-0.5">{label}</p>
          </div>
        ))}
      </div>

      {/* Search */}
      <div className="relative">
        <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder={`Buscar por cliente, teléfono o #número…`}
          className="w-full rounded-2xl border border-gray-200 bg-white pl-10 pr-10 py-3
                     text-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:border-transparent"
          style={{ '--tw-ring-color': primaryColor } as React.CSSProperties}
        />
        {search && (
          <button onClick={() => setSearch('')}
            className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-300 hover:text-gray-500
                       text-base leading-none font-bold">
            ×
          </button>
        )}
      </div>

      {/* Filters row */}
      <div className="flex items-center gap-2 overflow-x-auto scrollbar-hide">
        {/* Date range */}
        <div className="flex items-center gap-1 bg-gray-100 rounded-xl p-1 shrink-0">
          {DATE_RANGES.map(r => (
            <button key={r.key} onClick={() => setDateRange(r.key)}
              className={cn(
                'rounded-lg px-2.5 py-1.5 text-xs font-semibold transition-all',
                dateRange === r.key ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500'
              )}>
              {r.label}
            </button>
          ))}
        </div>

        {/* Separator */}
        <div className="h-6 w-px bg-gray-200 shrink-0" />

        {/* Status pills — min-h-[44px] para target táctil */}
        <button onClick={() => setStatus('all')}
          className={cn(
            'rounded-xl px-3 py-2.5 text-xs font-semibold shrink-0 border transition-all min-h-[44px]',
            status === 'all'
              ? 'text-white border-transparent'
              : 'bg-white text-gray-500 border-gray-200'
          )}
          style={status === 'all' ? { background: primaryColor } : {}}>
          Todos {filtered.length > 0 ? `(${filtered.length})` : ''}
        </button>

        {presentStatuses.map(s => {
          const conf  = STATUS_CONF[s]
          const count = statusCounts[s] ?? 0
          return (
            <button key={s} onClick={() => setStatus(status === s ? 'all' : s)}
              className={cn(
                'rounded-xl px-3 py-2.5 text-xs font-semibold shrink-0 border transition-all min-h-[44px]',
                status === s ? 'ring-2' : 'bg-white border-gray-200'
              )}
              style={status === s
                ? { background: conf.bg, color: conf.text, borderColor: conf.border }
                : {}}>
              {conf.label} {count > 0 ? `(${count})` : ''}
            </button>
          )
        })}
      </div>

      {/* List */}
      {filtered.length === 0 ? (
        <div className="rounded-2xl border-2 border-dashed border-gray-200 py-14 text-center">
          <ShoppingBag size={28} className="mx-auto text-gray-200 mb-3" />
          <p className="text-sm text-gray-400">
            {search ? 'Sin resultados para esta búsqueda' : `Sin ${orderLabelPlural.toLowerCase()} en este período`}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map(order => (
            <OrderRow
              key={order.id}
              order={order}
              currency={currency}
              primaryColor={primaryColor}
              orderLabel={orderLabel}
              updating={updating === order.id}
              expanded={expanded === order.id}
              isFresh={freshOrderIds.has(order.id)}
              onToggle={() => setExpanded(expanded === order.id ? null : order.id)}
              onAdvance={(id, s) => advanceStatus(id, s)}
              waLink={waLink(order)}
            />
          ))}
        </div>
      )}
    </div>
  )
}

// ── Order Row ─────────────────────────────────────────────────
function OrderRow({ order, currency, primaryColor, orderLabel, updating, expanded, isFresh, onToggle, onAdvance, waLink }: {
  order: Order; currency: string; primaryColor: string; orderLabel: string
  updating: boolean; expanded: boolean; isFresh: boolean
  onToggle: () => void
  onAdvance: (id: string, status: string) => void
  waLink: string | undefined
}) {
  const conf    = STATUS_CONF[order.status] ?? STATUS_CONF.pending
  const next    = NEXT_STATUS[order.status]
  const nextConf = next ? STATUS_CONF[next] : null
  const elapsed = Math.floor((Date.now() - new Date(order.created_at).getTime()) / 60000)
  const elapsedLabel = elapsed < 60
    ? `${elapsed}min`
    : `${Math.floor(elapsed / 60)}h ${elapsed % 60}min`

  return (
    <div className={cn(
      'bg-white rounded-2xl border shadow-sm overflow-hidden transition-all',
      isFresh  ? 'border-amber-300 ring-2 ring-amber-100 animate-pulse-once' : '',
      expanded ? 'border-gray-300' : !isFresh ? 'border-gray-100' : ''
    )}>
      {/* Summary row */}
      <button onClick={onToggle} className="w-full flex items-center gap-3 px-4 py-3.5 text-left hover:bg-gray-50/50">
        {/* Status badge */}
        <div className="shrink-0 space-y-1">
          <p className="text-[10px] font-mono text-gray-400 leading-none">
            #{String(order.order_number).padStart(4, '0')}
          </p>
          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full"
            style={{ background: conf.bg, color: conf.text }}>
            {conf.label}
          </span>
        </div>

        {/* Customer */}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-gray-900 truncate">{order.customer_name}</p>
          <div className="flex items-center gap-2 mt-0.5 flex-wrap">
            {order.customer_phone && (
              <span className="text-xs text-gray-400">{order.customer_phone}</span>
            )}
            <span className="text-xs text-gray-300">·</span>
            <span className="text-xs text-gray-400">
              {order.delivery_type === 'delivery' ? '🛵 Delivery'
                : order.delivery_type === 'dine_in' ? `🍽 ${order.table?.name ?? 'Mesa'}`
                : '🏃 Retiro'}
            </span>
            <span className="text-xs text-gray-300 hidden sm:inline">·</span>
            <span className="text-xs text-gray-400 hidden sm:flex items-center gap-0.5">
              <Clock size={9} /> {elapsedLabel}
            </span>
          </div>
        </div>

        {/* Total + chevron */}
        <div className="text-right shrink-0">
          <p className="text-sm font-bold text-gray-900">{formatPrice(order.total, currency)}</p>
          <p className="text-[10px] text-gray-400 mt-0.5">
            {new Date(order.created_at).toLocaleTimeString('es-UY', { hour: '2-digit', minute: '2-digit' })}
          </p>
        </div>
        <ChevronDown size={14} className={cn('text-gray-300 shrink-0 transition-transform', expanded && 'rotate-180')} />
      </button>

      {/* Expanded detail */}
      {expanded && (
        <div className="border-t border-gray-100 px-4 pb-4 pt-3 space-y-3 animate-fade-in">

          {/* Items */}
          {order.items && order.items.length > 0 && (
            <div className="rounded-xl bg-gray-50 p-3 space-y-1.5">
              {order.items.map((item, i) => (
                <div key={i} className="flex justify-between items-baseline">
                  <p className="text-sm text-gray-700">
                    <span className="font-bold text-gray-900">{item.quantity}×</span> {item.product_name}
                  </p>
                  <p className="text-sm font-medium text-gray-700 shrink-0 ml-2">
                    {formatPrice(item.subtotal ?? item.quantity * item.unit_price, currency)}
                  </p>
                </div>
              ))}
              <div className="flex justify-between pt-2 border-t border-gray-200 mt-1">
                <p className="text-sm font-bold text-gray-900">Total</p>
                <p className="text-sm font-bold" style={{ color: primaryColor }}>{formatPrice(order.total, currency)}</p>
              </div>
            </div>
          )}

          {/* Datos cliente */}
          {(order.customer_address || order.comment) && (
            <div className="rounded-xl bg-gray-50 p-3 space-y-1.5">
              {order.customer_address && (
                <p className="text-xs text-gray-600 flex items-center gap-1.5">
                  <MapPin size={11} className="text-gray-400 shrink-0" /> {order.customer_address}
                </p>
              )}
              {order.comment && (
                <p className="text-xs text-amber-700 flex items-start gap-1.5">
                  💬 {order.comment}
                </p>
              )}
            </div>
          )}

          {/* Acciones */}
          <div className="flex items-center gap-2 flex-wrap">
            {/* Avanzar estado */}
            {next && !['delivered', 'done', 'cancelled'].includes(order.status) && (
              <button
                onClick={() => onAdvance(order.id, next)}
                disabled={updating}
                className="flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-bold text-white
                           disabled:opacity-50 transition-all active:scale-[0.97]"
                style={{ background: primaryColor }}>
                {updating
                  ? <Loader2 size={11} className="animate-spin" />
                  : <ChevronRight size={11} />}
                {nextConf?.label ?? 'Siguiente'}
              </button>
            )}

            {/* Cancelar */}
            {!['cancelled', 'delivered', 'done'].includes(order.status) && (
              <button
                onClick={() => onAdvance(order.id, 'cancelled')}
                disabled={updating}
                className="flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-medium
                           text-red-600 bg-red-50 hover:bg-red-100 disabled:opacity-50 transition-all">
                <X size={11} /> Cancelar
              </button>
            )}

            {/* WhatsApp */}
            {waLink && (
              <a href={waLink} target="_blank"
                className="flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-bold
                           text-white bg-green-500 transition-all active:scale-[0.97]">
                <MessageCircle size={11} /> WhatsApp
              </a>
            )}

            {/* Imprimir */}
            <a href={`/comanda/${order.id}`} target="_blank"
              className="flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-medium
                         text-gray-500 bg-gray-100 hover:bg-gray-200 transition-all">
              <Printer size={11} /> Comanda
            </a>

            {/* Ver detalle */}
            <Link href={`/admin/orders/${order.id}`}
              className="flex items-center gap-1 rounded-xl px-3.5 py-2 text-xs font-medium
                         text-gray-500 bg-gray-100 hover:bg-gray-200 transition-all ml-auto">
              Ver detalle <ChevronRight size={11} />
            </Link>
          </div>
        </div>
      )}
    </div>
  )
}

// ── X icon needed locally since it's used in OrderRow ────────
function X({ size = 14, className = '' }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
      className={className}>
      <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  )
}
