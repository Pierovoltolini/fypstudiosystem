// app/admin/orders/[id]/page.tsx
import { createClient } from '@/lib/supabase/server'
import { redirect, notFound } from 'next/navigation'
import { formatPrice, formatDate, orderStatusLabel, orderStatusColor } from '@/lib/utils'
import Link from 'next/link'
import { ArrowLeft, MessageCircle, MapPin, Phone, ShoppingBag, Clock, UtensilsCrossed, ExternalLink, Printer } from 'lucide-react'
import OrderStatusUpdater from './OrderStatusUpdater'
import OrderPaymentToggle from './OrderPaymentToggle'
import OrderTimeline from './OrderTimeline'
import OrderRiderSelector from './OrderRiderSelector'
import type { Order, OrderItem, DeliveryRider } from '@/types'
import type { OrderEvent } from './OrderTimeline'

export const metadata = { title: 'Detalle pedido' }

export default async function OrderDetailPage({ params }: { params: { id: string } }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('business_id, business:businesses(currency, whatsapp, slug)')
    .eq('user_id', user.id)
    .single()

  if (!profile?.business_id) redirect('/admin/onboarding')

  const { data: order } = await supabase
    .from('orders')
    .select('*, items:order_items(*), table:restaurant_tables(id,name), rider:delivery_riders(id,name,phone,active,created_at,updated_at)')
    .eq('id', params.id)
    .eq('business_id', profile.business_id)
    .single()

  if (!order) notFound()

  const { data: events } = await supabase
    .from('order_events')
    .select('id, status, note, actor_name, created_at')
    .eq('order_id', params.id)
    .order('created_at', { ascending: true })

  const biz = profile.business as unknown as { currency: string; whatsapp?: string; slug?: string } | null
  const currency = biz?.currency ?? 'UYU'
  const bizSlug  = biz?.slug ?? null
  const o = order as Order & { items: OrderItem[]; table?: { id: string; name: string } | null }

  // Construir link de WhatsApp para contactar al cliente
  const waLink = o.customer_phone
    ? `https://wa.me/${o.customer_phone.replace(/\D/g, '')}?text=${encodeURIComponent(
        `Hola ${o.customer_name}! Te escribimos por tu pedido #${String(o.order_number).padStart(4, '0')} de FYP.STUDIO.`
      )}`
    : null

  return (
    <div className="space-y-4 animate-fade-in max-w-2xl">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link href="/admin/orders"
          className="flex h-9 w-9 items-center justify-center rounded-xl border border-gray-200
                     text-gray-500 hover:bg-gray-100 transition-colors">
          <ArrowLeft size={16} />
        </Link>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-xl lg:text-2xl font-semibold tracking-tight">
              #{String(o.order_number).padStart(4, '0')}
            </h1>
            <span className={`badge ${orderStatusColor(o.status)}`}>
              {orderStatusLabel(o.status)}
            </span>
          </div>
          <p className="text-sm text-gray-400 mt-0.5 flex items-center gap-1">
            <Clock size={12} /> {formatDate(o.created_at)}
          </p>
        </div>
      </div>

      {/* Cambiar estado + pago */}
      <div className="bg-white rounded-2xl border border-gray-100 p-5 space-y-4">
        <div>
          <p className="text-sm font-medium text-gray-700 mb-3">Estado del pedido</p>
          <OrderStatusUpdater orderId={o.id} currentStatus={o.status} />
        </div>
        <div className="pt-3 border-t border-gray-100">
          <p className="text-sm font-medium text-gray-700 mb-3">Pago</p>
          <OrderPaymentToggle orderId={o.id} currentStatus={o.payment_status as 'unpaid' | 'paid' | 'refunded'} />
        </div>
        {o.delivery_type === 'delivery' && (
          <div className="pt-3 border-t border-gray-100">
            <OrderRiderSelector
              orderId={o.id}
              businessId={profile.business_id}
              currentRider={o.rider as DeliveryRider | null}
            />
          </div>
        )}
      </div>

      {/* Cliente */}
      <div className="bg-white rounded-2xl border border-gray-100 p-5">
        <p className="text-sm font-medium text-gray-700 mb-4">Cliente</p>
        <div className="space-y-2.5">
          <div className="flex items-center gap-2.5 text-sm text-gray-600">
            <div className="h-7 w-7 rounded-lg bg-gray-100 flex items-center justify-center shrink-0">
              <span className="text-xs font-semibold text-gray-500">
                {o.customer_name.slice(0, 1).toUpperCase()}
              </span>
            </div>
            <span className="font-medium text-gray-900">{o.customer_name}</span>
          </div>
          {o.customer_phone && (
            <div className="flex items-center gap-2.5 text-sm text-gray-600">
              <div className="h-7 w-7 rounded-lg bg-gray-100 flex items-center justify-center shrink-0">
                <Phone size={12} className="text-gray-400" />
              </div>
              <span>{o.customer_phone}</span>
            </div>
          )}
          {o.customer_address && (
            <div className="flex items-start gap-2.5 text-sm text-gray-600">
              <div className="h-7 w-7 rounded-lg bg-gray-100 flex items-center justify-center shrink-0 mt-0.5">
                <MapPin size={12} className="text-gray-400" />
              </div>
              <span>{o.customer_address}</span>
            </div>
          )}
        </div>

        <div className="mt-4 flex items-center gap-2 flex-wrap">
          {o.table ? (
            <span className="badge bg-orange-50 text-orange-700 flex items-center gap-1">
              <UtensilsCrossed size={11} />
              {o.table.name}
            </span>
          ) : (
            <span className={`badge ${o.delivery_type === 'delivery' ? 'bg-blue-50 text-blue-700' : 'bg-purple-50 text-purple-700'}`}>
              {o.delivery_type === 'delivery' ? '🛵 Delivery' : '🏃 Retiro en local'}
            </span>
          )}
          {o.delivery_zone && (
            <span className="badge bg-gray-100 text-gray-600 flex items-center gap-1">
              <MapPin size={10} />
              {o.delivery_zone}
            </span>
          )}
          {o.delivery_fee != null && o.delivery_fee > 0 && (
            <span className="badge bg-gray-100 text-gray-600">
              Envío: {formatPrice(o.delivery_fee, currency)}
            </span>
          )}
          {waLink && (
            <a href={waLink} target="_blank"
              className="flex items-center gap-1.5 rounded-xl bg-green-500 px-3 py-1.5 text-xs font-medium
                         text-white hover:bg-green-600 transition-colors">
              <MessageCircle size={12} />
              WhatsApp
            </a>
          )}
          {bizSlug && (
            <a href={`/store/${bizSlug}/pedido/${o.id}`} target="_blank"
              className="flex items-center gap-1.5 rounded-xl border border-gray-200 bg-white px-3 py-1.5
                         text-xs font-medium text-gray-600 hover:bg-gray-50 transition-colors">
              <ExternalLink size={12} />
              Ver comprobante
            </a>
          )}
          <a href={`/comanda/${o.id}`} target="_blank"
            className="flex items-center gap-1.5 rounded-xl border border-gray-200 bg-white px-3 py-1.5
                       text-xs font-medium text-gray-600 hover:bg-gray-50 transition-colors">
            <Printer size={12} />
            Imprimir comanda
          </a>
        </div>
      </div>

      {/* Productos */}
      <div className="bg-white rounded-2xl border border-gray-100 p-5">
        <p className="text-sm font-medium text-gray-700 mb-4">Productos</p>
        <div className="space-y-3">
          {o.items?.map(item => (
            <div key={item.id} className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-3">
                <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-gray-100 shrink-0 mt-0.5">
                  <ShoppingBag size={12} className="text-gray-400" />
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-900">{item.product_name}</p>
                  <p className="text-xs text-gray-400">{formatPrice(item.unit_price, currency)} c/u</p>
                  {item.note && (
                    <p className="text-xs text-amber-700 mt-0.5 italic">↳ {item.note}</p>
                  )}
                </div>
              </div>
              <div className="text-right shrink-0">
                <p className="text-sm font-semibold text-gray-900">
                  {formatPrice(item.unit_price * item.quantity, currency)}
                </p>
                <p className="text-xs text-gray-400">×{item.quantity}</p>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-4 pt-4 border-t border-gray-100 space-y-1.5">
          {o.subtotal !== o.total && (
            <div className="flex items-center justify-between text-sm text-gray-500">
              <span>Subtotal</span>
              <span>{formatPrice(o.subtotal, currency)}</span>
            </div>
          )}
          {o.delivery_fee != null && o.delivery_fee > 0 && (
            <div className="flex items-center justify-between text-sm text-gray-500">
              <span>Envío{o.delivery_zone ? ` · ${o.delivery_zone}` : ''}</span>
              <span>{formatPrice(o.delivery_fee, currency)}</span>
            </div>
          )}
          {o.discount_amount != null && o.discount_amount > 0 && (
            <div className="flex items-center justify-between text-sm text-green-600">
              <span>
                Descuento{o.discount_code ? ` · ${o.discount_code.toUpperCase()}` : ''}
              </span>
              <span>−{formatPrice(o.discount_amount, currency)}</span>
            </div>
          )}
          {o.loyalty_discount != null && o.loyalty_discount > 0 && (
            <div className="flex items-center justify-between text-sm text-purple-600">
              <span>Puntos canjeados</span>
              <span>−{formatPrice(o.loyalty_discount, currency)}</span>
            </div>
          )}
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold text-gray-900">Total</p>
            <p className="text-lg font-bold text-gray-900">{formatPrice(o.total, currency)}</p>
          </div>
          {!o.confirmed_sale && (
            <p className="text-xs text-gray-400 mt-1">
              ⚠️ No contabilizado como venta real (aún no confirmado)
            </p>
          )}
          {o.confirmed_sale && (
            <p className="text-xs text-green-600 mt-1">✓ Venta confirmada</p>
          )}
        </div>
      </div>

      {/* Comentario */}
      {o.comment && (
        <div className="bg-amber-50 rounded-2xl border border-amber-100 px-5 py-4">
          <p className="text-xs font-medium text-amber-700 mb-1">Comentario del cliente</p>
          <p className="text-sm text-amber-900">{o.comment}</p>
        </div>
      )}

      {/* Timeline */}
      {events && events.length > 0 && (
        <OrderTimeline events={events as OrderEvent[]} />
      )}
    </div>
  )
}
