// app/store/[slug]/pedido/[id]/OrderTracking.tsx
'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'
import { cn, formatPrice, orderStatusLabel, orderStatusColor } from '@/lib/utils'
import {
  CheckCircle2, Clock, Package, Truck, UtensilsCrossed, ChevronRight,
  MapPin, Phone, MessageCircle, ShoppingBag, ArrowLeft, Share2, Bell, Receipt,
} from 'lucide-react'
import type { Business, Order, OrderItem, OrderStatus } from '@/types'

const STATUS_STEPS: OrderStatus[] = ['pending', 'confirmed', 'preparing', 'ready', 'shipped', 'delivered']

const STATUS_ICON: Record<string, React.ElementType> = {
  pending:   Clock,
  confirmed: CheckCircle2,
  preparing: UtensilsCrossed,
  ready:     Package,
  shipped:   Truck,
  delivered: CheckCircle2,
  cancelled: ShoppingBag,
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60_000)
  if (mins < 1)  return 'Ahora'
  if (mins < 60) return `Hace ${mins} min`
  return `Hace ${Math.floor(mins / 60)}h`
}

export default function OrderTracking({
  business,
  order: initialOrder,
}: {
  business: Business
  order: Order & { items: OrderItem[] }
}) {
  const supabase = createClient()
  const [order, setOrder] = useState(initialOrder)
  const color = business.primary_color ?? '#1565FF'

  const isDineIn = order.delivery_type === 'dine_in'
  const tableObj = order.table ?? null

  const [alertSent,    setAlertSent]    = useState<'waiter' | 'bill' | null>(null)
  const [alertLoading, setAlertLoading] = useState<'waiter' | 'bill' | null>(null)

  async function sendTableAlert(action: 'waiter' | 'bill') {
    if (!tableObj?.qr_token || alertSent) return
    setAlertLoading(action)
    try {
      await fetch('/api/table-alert', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ qr_token: tableObj.qr_token, action }),
      })
      setAlertSent(action)
    } catch { /* silent */ } finally {
      setAlertLoading(null)
    }
  }

  // Real-time order status updates
  useEffect(() => {
    const ch = supabase
      .channel(`order-tracking-${order.id}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'orders', filter: `id=eq.${order.id}` },
        (payload) => {
          setOrder(prev => ({ ...prev, ...(payload.new as Partial<Order>) }))
        }
      )
      .subscribe()
    return () => { supabase.removeChannel(ch) }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [order.id])

  const isCancelled = order.status === 'cancelled'
  const isDelivered = order.status === 'delivered'
  const currentIdx  = STATUS_STEPS.indexOf(order.status as OrderStatus)
  const currency    = (business as unknown as { currency?: string }).currency ?? 'UYU'

  const businessWA = ((business as unknown as { whatsapp?: string }).whatsapp ?? '').replace(/\D/g, '')
  const waHref = businessWA
    ? `https://wa.me/${businessWA}?text=${encodeURIComponent(`Hola! Consulto sobre mi pedido #${order.order_number}`)}`
    : null

  function handleShare() {
    if (navigator.share) {
      navigator.share({ title: `Pedido #${order.order_number}`, url: window.location.href })
    } else {
      navigator.clipboard?.writeText(window.location.href)
    }
  }

  const subtotal = order.subtotal ?? (order.items ?? []).reduce((s, i) => s + i.subtotal, 0)
  const total    = order.total ?? subtotal

  return (
    <div className="min-h-screen bg-[#f9f9f8]">
      {/* Header */}
      <header className="sticky top-0 z-10 bg-white border-b border-gray-100 shadow-sm">
        <div className="max-w-lg mx-auto px-4 h-14 flex items-center justify-between gap-3">
          <Link
            href={`/store/${business.slug}`}
            className="flex items-center gap-2 text-gray-500 hover:text-gray-800 transition-colors"
          >
            <ArrowLeft size={18} />
            <span className="text-sm font-medium">{business.name}</span>
          </Link>
          <button
            onClick={handleShare}
            className="flex h-8 w-8 items-center justify-center rounded-xl text-gray-400
                       hover:bg-gray-100 hover:text-gray-700 transition-colors"
            aria-label="Compartir"
          >
            <Share2 size={15} />
          </button>
        </div>
      </header>

      <div className="max-w-lg mx-auto px-4 py-6 space-y-4 pb-12">

        {/* Success / status hero */}
        <div
          className={cn(
            'rounded-3xl px-6 py-8 text-center text-white',
            isCancelled ? 'bg-gray-400' : isDelivered ? 'bg-emerald-500' : ''
          )}
          style={!isCancelled && !isDelivered ? { background: `linear-gradient(135deg, ${color}, ${color}bb)` } : undefined}
        >
          {business.logo_url ? (
            <img src={business.logo_url} alt={business.name}
              className="h-12 w-12 rounded-2xl object-cover mx-auto mb-4 ring-2 ring-white/30" />
          ) : (
            <div
              className="h-12 w-12 rounded-2xl flex items-center justify-center text-sm font-bold mx-auto mb-4"
              style={{ background: 'rgba(255,255,255,0.2)' }}
            >
              {business.name.slice(0, 2).toUpperCase()}
            </div>
          )}
          <p className="text-white/80 text-sm font-medium mb-1">
            {isCancelled ? 'Pedido cancelado' : isDelivered ? '¡Pedido entregado!' : '¡Pedido recibido!'}
          </p>
          <p className="text-3xl font-black tracking-tight mb-1">
            #{order.order_number}
          </p>
          <p className="text-white/70 text-sm">{timeAgo(order.created_at)}</p>
        </div>

        {/* Progress stepper — hidden if cancelled */}
        {!isCancelled && (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm px-5 py-5">
            <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-4">Estado del pedido</p>
            <div className="flex items-center gap-0">
              {STATUS_STEPS.filter(s => (order.delivery_type === 'pickup' || order.delivery_type === 'dine_in') ? s !== 'shipped' : true).map((step, i, arr) => {
                const idx   = STATUS_STEPS.indexOf(step)
                const done  = currentIdx >= idx
                const active = currentIdx === idx
                const Icon  = STATUS_ICON[step] ?? Clock
                const isLast = i === arr.length - 1
                return (
                  <div key={step} className="flex items-center flex-1">
                    <div className="flex flex-col items-center gap-1.5 flex-1">
                      <div
                        className={cn(
                          'flex h-8 w-8 items-center justify-center rounded-full transition-all',
                          done
                            ? active ? 'ring-2 ring-offset-2' : 'opacity-70'
                            : 'bg-gray-100'
                        )}
                        style={done ? { background: color } : undefined}
                      >
                        <Icon size={14} className={done ? 'text-white' : 'text-gray-300'} />
                      </div>
                      <p className={cn(
                        'text-[9px] font-semibold text-center leading-tight',
                        done ? 'text-gray-700' : 'text-gray-300',
                        active && 'font-black'
                      )}>
                        {orderStatusLabel(step)}
                      </p>
                    </div>
                    {!isLast && (
                      <div className={cn(
                        'h-0.5 flex-1 -mt-4 mx-1 rounded-full',
                        currentIdx > STATUS_STEPS.indexOf(step) ? '' : 'bg-gray-100'
                      )}
                        style={currentIdx > STATUS_STEPS.indexOf(step) ? { background: color } : undefined}
                      />
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* Current status badge */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm px-5 py-4 flex items-center justify-between">
          <div>
            <p className="text-xs text-gray-400 mb-1">Estado actual</p>
            <span className={cn('inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold', orderStatusColor(order.status))}>
              <span className="h-1.5 w-1.5 rounded-full bg-current opacity-70" />
              {orderStatusLabel(order.status)}
            </span>
          </div>
          <div className="text-right">
            <p className="text-xs text-gray-400 mb-1">Total</p>
            <p className="text-lg font-black text-gray-900">{formatPrice(total, currency)}</p>
          </div>
        </div>

        {/* Order items */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-50">
            <p className="text-sm font-bold text-gray-800">Detalle del pedido</p>
          </div>
          <div className="divide-y divide-gray-50">
            {(order.items ?? []).map(item => (
              <div key={item.id} className="flex items-start gap-3 px-5 py-3">
                <div
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl text-white text-xs font-bold mt-0.5"
                  style={{ background: color }}
                >
                  {item.quantity}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-800">{item.product_name}</p>
                  {item.note && (
                    <p className="text-xs text-amber-700 italic mt-0.5">↳ {item.note}</p>
                  )}
                </div>
                <p className="text-sm font-bold text-gray-900 shrink-0">{formatPrice(item.subtotal, currency)}</p>
              </div>
            ))}
          </div>
          {/* Totals */}
          <div className="border-t border-gray-100 px-5 py-4 space-y-2">
            {subtotal !== total && (
              <div className="flex justify-between text-sm text-gray-500">
                <span>Subtotal</span>
                <span>{formatPrice(subtotal, currency)}</span>
              </div>
            )}
            {order.delivery_type === 'delivery' && (
              <div className="flex justify-between text-sm text-gray-500">
                <span>Envío{(order as unknown as { delivery_zone?: string | null }).delivery_zone ? ` · ${(order as unknown as { delivery_zone: string }).delivery_zone}` : ''}</span>
                <span>
                  {(order as unknown as { delivery_fee?: number | null }).delivery_fee != null && (order as unknown as { delivery_fee: number }).delivery_fee > 0
                    ? formatPrice((order as unknown as { delivery_fee: number }).delivery_fee, currency)
                    : <span className="text-green-600 font-medium">Gratis</span>
                  }
                </span>
              </div>
            )}
            <div className="flex justify-between text-base font-black text-gray-900 pt-1 border-t border-gray-100">
              <span>Total</span>
              <span>{formatPrice(total, currency)}</span>
            </div>
          </div>
        </div>

        {/* Dine-in mesa actions */}
        {isDineIn && tableObj && (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm px-5 py-4 space-y-3">
            <div className="flex items-center gap-2">
              <UtensilsCrossed size={14} style={{ color }} />
              <p className="text-sm font-bold text-gray-800">{tableObj.name}</p>
            </div>
            {alertSent ? (
              <div className="flex items-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold text-white"
                style={{ background: color }}>
                <CheckCircle2 size={15} />
                {alertSent === 'waiter' ? '¡El mozo ya viene!' : '¡La cuenta en camino!'}
              </div>
            ) : tableObj.qr_token ? (
              <div className="flex gap-2">
                <button
                  onClick={() => sendTableAlert('waiter')}
                  disabled={!!alertLoading}
                  className="flex-1 flex items-center justify-center gap-2 rounded-xl py-2.5
                             text-sm font-semibold border transition-all active:scale-95 disabled:opacity-60"
                  style={{ borderColor: color + '66', color, background: color + '10' }}
                >
                  {alertLoading === 'waiter'
                    ? <span className="h-3.5 w-3.5 rounded-full border-2 border-current border-t-transparent animate-spin" />
                    : <Bell size={14} />}
                  Llamar mozo
                </button>
                <button
                  onClick={() => sendTableAlert('bill')}
                  disabled={!!alertLoading}
                  className="flex-1 flex items-center justify-center gap-2 rounded-xl py-2.5
                             text-sm font-semibold border border-gray-200 text-gray-600 bg-white
                             transition-all active:scale-95 disabled:opacity-60"
                >
                  {alertLoading === 'bill'
                    ? <span className="h-3.5 w-3.5 rounded-full border-2 border-current border-t-transparent animate-spin" />
                    : <Receipt size={14} />}
                  La cuenta
                </button>
              </div>
            ) : null}
          </div>
        )}

        {/* Delivery / pickup info */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm px-5 py-4 space-y-3">
          <p className="text-sm font-bold text-gray-800">Información de entrega</p>
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-gray-100 shrink-0">
              {order.delivery_type === 'delivery'
                ? <Truck size={14} className="text-gray-500" />
                : order.delivery_type === 'dine_in'
                  ? <UtensilsCrossed size={14} className="text-gray-500" />
                  : <Package size={14} className="text-gray-500" />}
            </div>
            <div>
              <p className="text-xs text-gray-400">Modalidad</p>
              <p className="text-sm font-semibold text-gray-800">
                {order.delivery_type === 'delivery' ? 'Delivery'
                  : order.delivery_type === 'dine_in' ? `Mesa · ${tableObj?.name ?? ''}`
                  : 'Retiro en local'}
              </p>
            </div>
          </div>
          {order.customer_address && (
            <div className="flex items-start gap-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-gray-100 shrink-0">
                <MapPin size={14} className="text-gray-500" />
              </div>
              <div>
                <p className="text-xs text-gray-400">Dirección</p>
                <p className="text-sm font-semibold text-gray-800">{order.customer_address}</p>
              </div>
            </div>
          )}
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-gray-100 shrink-0">
              <Phone size={14} className="text-gray-500" />
            </div>
            <div>
              <p className="text-xs text-gray-400">Nombre</p>
              <p className="text-sm font-semibold text-gray-800">{order.customer_name}</p>
            </div>
          </div>
          {order.comment && (
            <div className="rounded-xl bg-gray-50 px-4 py-3">
              <p className="text-xs text-gray-400 mb-0.5">Comentarios</p>
              <p className="text-sm text-gray-700">{order.comment}</p>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="space-y-3">
          {waHref && (
            <a
              href={waHref}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-2.5 w-full rounded-2xl py-3.5
                         bg-[#25D366] text-white text-sm font-bold transition-all active:scale-[0.98]"
            >
              <MessageCircle size={16} />
              Consultar por WhatsApp
            </a>
          )}
          <Link
            href={`/store/${business.slug}`}
            className="flex items-center justify-center gap-2 w-full rounded-2xl py-3.5
                       bg-white border border-gray-200 text-sm font-semibold text-gray-700
                       hover:bg-gray-50 transition-all active:scale-[0.98]"
          >
            <ShoppingBag size={15} />
            Volver a la tienda
            <ChevronRight size={13} className="opacity-40" />
          </Link>
        </div>
      </div>
    </div>
  )
}
