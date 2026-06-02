// app/kds/KDSClient.tsx — Kitchen Display System
// Pantalla fullscreen para cocina: touch-optimized, sin sidebar
'use client'
import { useState, useEffect, useRef, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import { ChefHat, Clock, Bell, Check, ChevronRight, ExternalLink, Users } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { Order } from '@/types'

// ── Columnas KDS ───────────────────────────────────────────────
const KDS_COLS: {
  status: string; label: string; emoji: string
  bg: string; border: string; headerBg: string; text: string
  nextStatus: string | null; nextLabel: string | null
  alertMinutes: number
}[] = [
  {
    status:       'pending',
    label:        'Nuevos',
    emoji:        '🔔',
    bg:           '#FFFBEB',
    border:       '#FDE68A',
    headerBg:     '#F59E0B',
    text:         '#92400E',
    nextStatus:   'confirmed',
    nextLabel:    'Confirmar',
    alertMinutes: 5,
  },
  {
    status:       'confirmed',
    label:        'En cola',
    emoji:        '✅',
    bg:           '#EFF6FF',
    border:       '#BFDBFE',
    headerBg:     '#3B82F6',
    text:         '#1E40AF',
    nextStatus:   'preparing',
    nextLabel:    'Iniciar',
    alertMinutes: 10,
  },
  {
    status:       'preparing',
    label:        'Preparando',
    emoji:        '👨‍🍳',
    bg:           '#FDF4FF',
    border:       '#E9D5FF',
    headerBg:     '#8B5CF6',
    text:         '#5B21B6',
    nextStatus:   'ready',
    nextLabel:    'Listo',
    alertMinutes: 20,
  },
  {
    status:       'ready',
    label:        'Listos',
    emoji:        '🛵',
    bg:           '#F0FDF4',
    border:       '#BBF7D0',
    headerBg:     '#22C55E',
    text:         '#166534',
    nextStatus:   'delivered',
    nextLabel:    'Entregado',
    alertMinutes: 8,
  },
]

function elapsedMin(createdAt: string, now: number): number {
  return (now - new Date(createdAt).getTime()) / 60_000
}

function elapsedLabel(minutes: number): string {
  if (minutes < 1)  return '<1m'
  if (minutes < 60) return `${Math.floor(minutes)}m`
  return `${Math.floor(minutes / 60)}h${Math.floor(minutes % 60)}m`
}

// ── Main ───────────────────────────────────────────────────────
export default function KDSClient({
  initialOrders, businessId, businessName, color,
}: {
  initialOrders: Order[]
  businessId:    string
  businessName:  string
  color:         string
}) {
  const supabase = createClient()
  const [orders,   setOrders]   = useState<Order[]>(initialOrders)
  const [now,      setNow]      = useState(Date.now())
  const [newAlert, setNewAlert] = useState(false)
  const audioRef = useRef<HTMLAudioElement | null>(null)

  // Tick every 30s
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 30_000)
    return () => clearInterval(id)
  }, [])

  // Realtime
  useEffect(() => {
    const ch = supabase.channel(`kds-${businessId}`)
      .on('postgres_changes', {
        event: '*', schema: 'public', table: 'orders',
        filter: `business_id=eq.${businessId}`,
      }, async ({ eventType, new: n, old }) => {
        if (eventType === 'INSERT') {
          const { data: items } = await supabase
            .from('order_items').select('*').eq('order_id', (n as Order).id)
          const newOrder = { ...n, items: items ?? [] } as Order
          if (['pending','confirmed','preparing','ready'].includes(newOrder.status)) {
            setOrders(prev => [...prev, newOrder].sort(
              (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
            ))
            setNewAlert(true)
            setTimeout(() => setNewAlert(false), 6000)
            if ('vibrate' in navigator) navigator.vibrate([300, 100, 300])
          }
        } else if (eventType === 'UPDATE') {
          const updated = n as Order
          setOrders(prev => {
            const filtered = prev.filter(o => o.id !== updated.id)
            if (['pending','confirmed','preparing','ready'].includes(updated.status)) {
              return [...filtered, updated].sort(
                (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
              )
            }
            return filtered
          })
        } else if (eventType === 'DELETE') {
          setOrders(prev => prev.filter(o => o.id !== (old as Order).id))
        }
      })
      .subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [businessId])

  async function advance(orderId: string, nextStatus: string) {
    const confirmedSale =
      nextStatus === 'delivered' || nextStatus === 'done' ? true :
      nextStatus === 'cancelled' ? false : undefined
    const patch = confirmedSale !== undefined
      ? { status: nextStatus, confirmed_sale: confirmedSale }
      : { status: nextStatus }
    await supabase.from('orders').update(patch).eq('id', orderId)
    setOrders(prev => {
      const updated = prev.map(o =>
        o.id === orderId
          ? { ...o, status: nextStatus as Order['status'], ...(confirmedSale !== undefined && { confirmed_sale: confirmedSale }) }
          : o
      )
      if (!['pending','confirmed','preparing','ready'].includes(nextStatus)) {
        return updated.filter(o => o.id !== orderId)
      }
      return updated
    })
  }

  const byStatus = useMemo(() => {
    const map: Record<string, Order[]> = {}
    KDS_COLS.forEach(c => { map[c.status] = [] })
    orders.forEach(o => { if (map[o.status]) map[o.status].push(o) })
    return map
  }, [orders])

  const totalActive = orders.length
  const alerts      = orders.filter(o => {
    const col = KDS_COLS.find(c => c.status === o.status)
    if (!col) return false
    return elapsedMin(o.created_at, now) > col.alertMinutes
  }).length

  return (
    <div className="min-h-screen bg-gray-950 text-white flex flex-col select-none">

      {/* ── Top bar ─────────────────────────────────────── */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-800 shrink-0">
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-xl flex items-center justify-center"
            style={{ background: color }}>
            <ChefHat size={18} className="text-white" />
          </div>
          <div>
            <p className="text-sm font-bold text-white leading-tight">{businessName}</p>
            <p className="text-[11px] text-gray-400">
              {new Date().toLocaleTimeString('es-UY', { hour: '2-digit', minute: '2-digit' })}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {alerts > 0 && (
            <div className="flex items-center gap-1.5 rounded-xl px-3 py-1.5 bg-red-500/20 border border-red-500/40 animate-pulse">
              <Bell size={13} className="text-red-400" />
              <span className="text-xs font-bold text-red-400">{alerts} demorado{alerts > 1 ? 's' : ''}</span>
            </div>
          )}
          {newAlert && (
            <div className="flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-white font-bold text-xs animate-bounce"
              style={{ background: color }}>
              <Bell size={13} /> ¡Nuevo pedido!
            </div>
          )}
          <div className="text-right">
            <p className="text-sm font-bold">{totalActive}</p>
            <p className="text-[10px] text-gray-500">activos</p>
          </div>
          <a href="/admin/gastro" target="_blank"
            className="flex h-8 w-8 items-center justify-center rounded-xl bg-gray-800 text-gray-400 hover:text-white transition-colors">
            <ExternalLink size={14} />
          </a>
        </div>
      </div>

      {/* ── Columns ─────────────────────────────────────── */}
      <div className="flex-1 grid grid-cols-2 lg:grid-cols-4 gap-0 overflow-hidden">
        {KDS_COLS.map(col => {
          const colOrders = byStatus[col.status] ?? []
          return (
            <div key={col.status} className="flex flex-col border-r border-gray-800 last:border-r-0 overflow-hidden">

              {/* Column header */}
              <div className="flex items-center justify-between px-3 py-2.5 shrink-0"
                style={{ background: col.headerBg + '22', borderBottom: `2px solid ${col.headerBg}` }}>
                <div className="flex items-center gap-2">
                  <span className="text-base">{col.emoji}</span>
                  <span className="text-sm font-bold text-white">{col.label}</span>
                </div>
                <span className="h-6 w-6 flex items-center justify-center rounded-full text-xs font-black text-white"
                  style={{ background: col.headerBg }}>
                  {colOrders.length}
                </span>
              </div>

              {/* Cards */}
              <div className="flex-1 overflow-y-auto p-2 space-y-2">
                {colOrders.length === 0 ? (
                  <div className="flex items-center justify-center h-24 rounded-xl border border-dashed border-gray-700">
                    <p className="text-xs text-gray-600">Sin pedidos</p>
                  </div>
                ) : (
                  colOrders.map(order => (
                    <KDSCard
                      key={order.id}
                      order={order}
                      col={col}
                      now={now}
                      onAdvance={advance}
                    />
                  ))
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ── Order Card ─────────────────────────────────────────────────
function KDSCard({ order, col, now, onAdvance }: {
  order:     Order
  col:       typeof KDS_COLS[number]
  now:       number
  onAdvance: (id: string, next: string) => void
}) {
  const minutes   = elapsedMin(order.created_at, now)
  const isDelayed = minutes > col.alertMinutes
  const orderNum  = String(order.order_number).padStart(4, '0')

  return (
    <div className={cn(
      'rounded-xl border p-3 flex flex-col gap-2.5 transition-all',
      isDelayed ? 'border-red-500/60 bg-red-950/40' : 'border-gray-700 bg-gray-900',
    )}>
      {/* Order number + time */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-lg font-black text-white">#{orderNum}</span>
          {order.table && (
            <span className="flex items-center gap-1 rounded-lg px-2 py-0.5 text-[10px] font-bold bg-gray-700 text-gray-300">
              <Users size={9} /> {(order.table as { name: string }).name}
            </span>
          )}
        </div>
        <div className={cn(
          'flex items-center gap-1 rounded-lg px-2 py-0.5 text-xs font-bold',
          isDelayed ? 'bg-red-500/30 text-red-300' : 'bg-gray-800 text-gray-400',
        )}>
          <Clock size={11} className={isDelayed ? 'animate-pulse' : ''} />
          {elapsedLabel(minutes)}
        </div>
      </div>

      {/* Customer */}
      <p className="text-[11px] text-gray-400 truncate">
        {order.customer_name}
        {order.delivery_type === 'delivery' && (
          <span className="ml-1.5 text-orange-400 font-semibold">• Delivery</span>
        )}
      </p>

      {/* Items */}
      <div className="space-y-1.5">
        {(order.items ?? []).map((item, i) => (
          <div key={i} className="flex items-start gap-2">
            <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded bg-gray-700 text-[11px] font-black text-white">
              {item.quantity}
            </span>
            <span className="text-sm font-semibold text-white leading-tight">{item.product_name}</span>
          </div>
        ))}
      </div>

      {/* Comment */}
      {order.comment && (
        <p className="text-[11px] text-amber-400 italic border-t border-gray-700 pt-2">
          💬 {order.comment}
        </p>
      )}

      {/* Advance button */}
      {col.nextStatus && (
        <button
          onClick={() => onAdvance(order.id, col.nextStatus!)}
          className={cn(
            'w-full rounded-xl py-2.5 text-sm font-black flex items-center justify-center gap-2 transition-all active:scale-95',
            isDelayed
              ? 'bg-red-500 text-white hover:bg-red-400'
              : 'text-white hover:opacity-90',
          )}
          style={!isDelayed ? { background: col.headerBg } : {}}>
          {col.nextStatus === 'delivered'
            ? <><Check size={15} /> {col.nextLabel}</>
            : <><ChevronRight size={15} /> {col.nextLabel}</>}
        </button>
      )}
    </div>
  )
}
