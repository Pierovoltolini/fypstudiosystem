// components/admin/NotificationBell.tsx
'use client'
import { useState, useEffect, useRef, useId, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Bell, ShoppingBag, AlertTriangle, UtensilsCrossed, Receipt, X } from 'lucide-react'
import Link from 'next/link'
import { cn, formatPrice } from '@/lib/utils'
import type { Business } from '@/types'

type NotifType = 'order' | 'stock' | 'table_waiter' | 'table_bill'

interface Notification {
  id: string
  type: NotifType
  title: string
  body: string
  href: string
  at: number
  read: boolean
}

function timeAgo(ms: number): string {
  const d = Date.now() - ms
  if (d < 60_000) return 'ahora'
  if (d < 3_600_000) return `${Math.floor(d / 60_000)}m`
  if (d < 86_400_000) return `${Math.floor(d / 3_600_000)}h`
  return `${Math.floor(d / 86_400_000)}d`
}

function playBeep() {
  try {
    const ctx = new AudioContext()
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.connect(gain); gain.connect(ctx.destination)
    osc.frequency.value = 880
    gain.gain.setValueAtTime(0.3, ctx.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3)
    osc.start(ctx.currentTime); osc.stop(ctx.currentTime + 0.3)
  } catch { /* AudioContext not available */ }
}

const TYPE_CONF: Record<NotifType, { icon: React.ElementType; bg: string; text: string }> = {
  order:        { icon: ShoppingBag,    bg: 'bg-blue-50',   text: 'text-blue-500'   },
  stock:        { icon: AlertTriangle,  bg: 'bg-amber-50',  text: 'text-amber-500'  },
  table_waiter: { icon: UtensilsCrossed,bg: 'bg-violet-50', text: 'text-violet-500' },
  table_bill:   { icon: Receipt,        bg: 'bg-orange-50', text: 'text-orange-500' },
}

export default function NotificationBell({ business }: { business: Business | null }) {
  const [open, setOpen]     = useState(false)
  const [notifs, setNotifs] = useState<Notification[]>([])
  const ref        = useRef<HTMLDivElement>(null)
  const instanceId = useId().replace(/:/g, '')
  const supabase   = createClient()

  const unread = notifs.filter(n => !n.read).length

  const addNotif = useCallback((n: Notification) => {
    setNotifs(prev => {
      if (prev.find(x => x.id === n.id)) return prev
      playBeep()
      return [n, ...prev].slice(0, 30)
    })
  }, [])

  // ── Carga inicial ────────────────────────────────────────────
  useEffect(() => {
    if (!business?.id) return
    const since = new Date(Date.now() - 86_400_000).toISOString()

    async function load() {
      const [ordersRes, stockRes, tablesRes] = await Promise.all([
        supabase
          .from('orders')
          .select('id,order_number,customer_name,total,created_at')
          .eq('business_id', business!.id)
          .eq('status', 'pending')
          .gte('created_at', since)
          .order('created_at', { ascending: false })
          .limit(10),

        supabase
          .from('inventory_items')
          .select('id,name,stock_current,stock_min')
          .eq('business_id', business!.id)
          .eq('active', true)
          .limit(10),

        supabase
          .from('restaurant_tables')
          .select('id,name,status,updated_at')
          .eq('business_id', business!.id)
          .eq('active', true)
          .in('status', ['waiting_attention', 'bill_requested']),
      ])

      const now = Date.now()

      const orderNotifs: Notification[] = (ordersRes.data ?? []).map(o => ({
        id:    `order-${o.id}`,
        type:  'order' as NotifType,
        title: `Pedido #${o.order_number}`,
        body:  `${o.customer_name} — ${formatPrice(o.total, business!.currency)}`,
        href:  `/admin/orders/${o.id}`,
        at:    new Date(o.created_at).getTime(),
        read:  false,
      }))

      const stockNotifs: Notification[] = (stockRes.data ?? [])
        .filter(i => i.stock_current != null && i.stock_min != null && i.stock_current <= i.stock_min)
        .map(i => ({
          id:    `stock-${i.id}`,
          type:  'stock' as NotifType,
          title: 'Stock bajo',
          body:  `${i.name} — ${i.stock_current} en existencia`,
          href:  '/admin/inventory',
          at:    now,
          read:  false,
        }))

      const tableNotifs: Notification[] = (tablesRes.data ?? []).map(t => ({
        id:    `table-${t.id}`,
        type:  (t.status === 'bill_requested' ? 'table_bill' : 'table_waiter') as NotifType,
        title: t.status === 'bill_requested' ? `Mesa ${t.name} — La cuenta` : `Mesa ${t.name} — Llama al mozo`,
        body:  `Hace ${timeAgo(new Date(t.updated_at).getTime())}`,
        href:  '/admin/tables',
        at:    new Date(t.updated_at).getTime(),
        read:  false,
      }))

      setNotifs([...tableNotifs, ...orderNotifs, ...stockNotifs])
    }

    load()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [business?.id])

  // ── Realtime: nuevos pedidos ─────────────────────────────────
  useEffect(() => {
    if (!business?.id) return
    const ch = supabase
      .channel(`bell-orders-${business.id}-${instanceId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'orders', filter: `business_id=eq.${business.id}` },
        (payload) => {
          const o = payload.new as {
            id: string; order_number: number; customer_name: string; total: number; status: string
          }
          if (o.status !== 'pending') return
          addNotif({
            id:    `order-${o.id}`,
            type:  'order',
            title: `Nuevo pedido #${o.order_number}`,
            body:  `${o.customer_name} — ${formatPrice(o.total, business!.currency)}`,
            href:  `/admin/orders/${o.id}`,
            at:    Date.now(),
            read:  false,
          })
        }
      )
      .subscribe()
    return () => { supabase.removeChannel(ch) }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [business?.id])

  // ── Realtime: alertas de mesa ────────────────────────────────
  useEffect(() => {
    if (!business?.id) return
    const ch = supabase
      .channel(`bell-tables-${business.id}-${instanceId}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'restaurant_tables', filter: `business_id=eq.${business.id}` },
        (payload) => {
          const t = payload.new as { id: string; name: string; status: string }
          if (t.status === 'waiting_attention') {
            addNotif({
              id:    `table-${t.id}`,
              type:  'table_waiter',
              title: `Mesa ${t.name} — Llama al mozo`,
              body:  'ahora',
              href:  '/admin/tables',
              at:    Date.now(),
              read:  false,
            })
          } else if (t.status === 'bill_requested') {
            addNotif({
              id:    `table-${t.id}`,
              type:  'table_bill',
              title: `Mesa ${t.name} — Pide la cuenta`,
              body:  'ahora',
              href:  '/admin/tables',
              at:    Date.now(),
              read:  false,
            })
          } else {
            // Mesa atendida → quitar notif
            setNotifs(prev => prev.filter(n => n.id !== `table-${t.id}`))
          }
        }
      )
      .subscribe()
    return () => { supabase.removeChannel(ch) }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [business?.id])

  // ── Cerrar al click afuera ───────────────────────────────────
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    if (open) document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  function handleToggle() {
    const willOpen = !open
    setOpen(willOpen)
    if (willOpen) setNotifs(prev => prev.map(n => ({ ...n, read: true })))
  }

  function dismiss(id: string, e: React.MouseEvent) {
    e.preventDefault(); e.stopPropagation()
    setNotifs(prev => prev.filter(n => n.id !== id))
  }

  // Sort: unread first, then by time desc
  const sorted = [...notifs].sort((a, b) => {
    if (a.read !== b.read) return a.read ? 1 : -1
    return b.at - a.at
  })

  if (!business) return null

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={handleToggle}
        className="relative flex h-8 w-8 items-center justify-center rounded-xl
                   text-gray-500 hover:bg-gray-100 hover:text-gray-700 transition-all"
        aria-label="Notificaciones"
      >
        <Bell size={16} className={unread > 0 ? 'animate-[wiggle_0.5s_ease-in-out]' : ''} />
        {unread > 0 && (
          <span className="absolute -top-0.5 -right-0.5 flex h-4 w-4 items-center justify-center
                           rounded-full bg-red-500 text-[9px] font-bold text-white animate-pulse">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-10 z-50 w-80 rounded-2xl bg-white
                        shadow-xl border border-gray-100 overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
            <div className="flex items-center gap-2">
              <p className="text-sm font-semibold text-gray-900">Notificaciones</p>
              {unread > 0 && (
                <span className="rounded-full bg-red-500 text-white text-[10px] font-bold px-1.5 py-0.5">
                  {unread}
                </span>
              )}
            </div>
            {notifs.length > 0 && (
              <button onClick={() => setNotifs([])}
                className="text-xs text-gray-400 hover:text-gray-600 transition-colors">
                Limpiar todo
              </button>
            )}
          </div>

          {/* Lista */}
          {sorted.length === 0 ? (
            <div className="py-10 text-center">
              <Bell size={28} className="mx-auto text-gray-200 mb-2" />
              <p className="text-xs text-gray-400">Sin notificaciones</p>
            </div>
          ) : (
            <ul className="max-h-[420px] overflow-y-auto divide-y divide-gray-50">
              {sorted.map(n => {
                const conf = TYPE_CONF[n.type]
                const Icon = conf.icon
                return (
                  <li key={n.id} className={cn('group', !n.read && 'bg-blue-50/30')}>
                    <Link
                      href={n.href}
                      onClick={() => setOpen(false)}
                      className="flex items-start gap-3 px-4 py-3 hover:bg-gray-50 transition-colors"
                    >
                      <div className={cn(
                        'mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-xl',
                        conf.bg, conf.text
                      )}>
                        <Icon size={13} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          <p className="text-xs font-semibold text-gray-900 truncate">{n.title}</p>
                          {!n.read && (
                            <span className="shrink-0 h-1.5 w-1.5 rounded-full bg-blue-500" />
                          )}
                        </div>
                        <p className="text-xs text-gray-500 truncate mt-0.5">{n.body}</p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="text-[10px] text-gray-400">{timeAgo(n.at)}</span>
                        <button
                          onClick={(e) => dismiss(n.id, e)}
                          className="opacity-0 group-hover:opacity-100 text-gray-300
                                     hover:text-gray-500 transition-all"
                        >
                          <X size={12} />
                        </button>
                      </div>
                    </Link>
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}
