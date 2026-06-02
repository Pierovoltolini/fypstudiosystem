// app/comanda/[id]/page.tsx
// Kitchen/order print comanda — UUID-secured, no auth required
import { createServiceClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import AutoPrint from './AutoPrint'
import type { Order, OrderItem, Business } from '@/types'

export const dynamic = 'force-dynamic'

function pad(n: number) { return String(n).padStart(4, '0') }

function fmtDate(iso: string) {
  return new Date(iso).toLocaleString('es-UY', {
    weekday: 'short', day: 'numeric', month: 'short',
    hour: '2-digit', minute: '2-digit',
  })
}

function fmtPrice(n: number, currency: string) {
  return currency === 'USD'
    ? `U$S ${n.toFixed(2)}`
    : `$${Math.round(n).toLocaleString('es-UY')}`
}

export async function generateMetadata({ params }: { params: { id: string } }) {
  return { title: `Comanda` }
}

export default async function ComandaPage({ params }: { params: { id: string } }) {
  const supabase = createServiceClient()

  const { data: order } = await supabase
    .from('orders')
    .select('*, items:order_items(*)')
    .eq('id', params.id)
    .single()

  if (!order) notFound()

  const { data: business } = await supabase
    .from('businesses')
    .select('name, logo_url, address, currency, primary_color')
    .eq('id', order.business_id)
    .single()

  if (!business) notFound()

  const o  = order as Order & { items: OrderItem[] }
  const biz = business as Pick<Business, 'name' | 'logo_url' | 'address' | 'currency' | 'primary_color'>
  const currency = biz.currency ?? 'UYU'
  const isDelivery = o.delivery_type === 'delivery'
  const isPickup   = o.delivery_type === 'pickup'

  return (
    <>
      <AutoPrint />
      <style>{`
        @page { size: 80mm auto; margin: 6mm; }
        * { box-sizing: border-box; }
        body { font-family: 'Courier New', Courier, monospace; font-size: 13px;
               color: #000; background: #fff; margin: 0; padding: 0; }
        .no-print { }
        @media print { .no-print { display: none !important; } }
      `}</style>

      {/* Screen nav (hidden on print) */}
      <div className="no-print bg-gray-50 border-b border-gray-200 px-4 py-3 flex items-center justify-between">
        <span className="text-sm text-gray-500 font-medium">Comanda #{pad(o.order_number)}</span>
        <button
          onClick={() => window.print()}
          className="rounded-lg bg-gray-900 text-white text-xs font-bold px-4 py-2 hover:bg-gray-700 transition-colors"
        >
          Imprimir
        </button>
      </div>

      {/* Comanda body */}
      <div style={{ maxWidth: '80mm', margin: '0 auto', padding: '8px 4px' }}>

        {/* Business header */}
        <div style={{ textAlign: 'center', marginBottom: '8px' }}>
          <p style={{ fontWeight: 900, fontSize: '15px', textTransform: 'uppercase', letterSpacing: '1px' }}>
            {biz.name}
          </p>
          {biz.address && (
            <p style={{ fontSize: '11px', color: '#555', marginTop: '2px' }}>{biz.address}</p>
          )}
        </div>

        <Divider />

        {/* Order number + date */}
        <div style={{ marginBottom: '6px' }}>
          <p style={{ fontWeight: 900, fontSize: '22px', letterSpacing: '2px', margin: 0 }}>
            #{pad(o.order_number)}
          </p>
          <p style={{ fontSize: '11px', color: '#555', margin: 0 }}>{fmtDate(o.created_at)}</p>
        </div>

        <Divider />

        {/* Delivery / pickup */}
        <div style={{ marginBottom: '6px' }}>
          <p style={{ fontWeight: 900, fontSize: '14px', margin: '0 0 3px 0',
                      textDecoration: 'underline', textTransform: 'uppercase' }}>
            {isDelivery ? '>>> DELIVERY <<<' : isPickup ? 'RETIRO EN LOCAL' : 'MESA'}
          </p>
          <p style={{ fontWeight: 700, margin: '0 0 2px 0' }}>{o.customer_name}</p>
          {o.customer_phone && (
            <p style={{ margin: 0, fontSize: '12px' }}>Tel: {o.customer_phone}</p>
          )}
          {isDelivery && o.customer_address && (
            <p style={{ margin: '2px 0 0 0', fontWeight: 700 }}>Dir: {o.customer_address}</p>
          )}
          {(o as unknown as { delivery_zone?: string | null }).delivery_zone && (
            <p style={{ margin: '1px 0 0 0', fontSize: '12px' }}>
              Zona: {(o as unknown as { delivery_zone: string }).delivery_zone}
            </p>
          )}
        </div>

        <Divider />

        {/* Items */}
        <div style={{ marginBottom: '6px' }}>
          {o.items?.map((item, i) => (
            <div key={i} style={{ marginBottom: '4px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                <span style={{ flex: 1, fontWeight: 700 }}>
                  {item.quantity}× {item.product_name}
                </span>
                <span style={{ fontWeight: 400, fontSize: '12px', marginLeft: '8px', whiteSpace: 'nowrap' }}>
                  {fmtPrice(item.unit_price * item.quantity, currency)}
                </span>
              </div>
              {item.note && (
                <p style={{ margin: '1px 0 0 14px', fontSize: '11px', fontStyle: 'italic', color: '#444' }}>
                  ↳ {item.note}
                </p>
              )}
            </div>
          ))}
        </div>

        <Divider />

        {/* Total */}
        <div style={{ display: 'flex', justifyContent: 'space-between',
                      fontWeight: 900, fontSize: '15px', marginBottom: '4px' }}>
          <span>TOTAL</span>
          <span>{fmtPrice(o.total, currency)}</span>
        </div>
        {o.payment_status === 'paid' ? (
          <p style={{ fontSize: '11px', fontWeight: 700, color: '#16a34a', margin: 0 }}>✓ PAGADO</p>
        ) : (
          <p style={{ fontSize: '11px', fontWeight: 700, color: '#dc2626', margin: 0 }}>COBRAR AL CLIENTE</p>
        )}

        {/* Comment */}
        {o.comment && (
          <>
            <Divider />
            <div style={{ background: '#f3f4f6', border: '2px dashed #9ca3af',
                          borderRadius: '4px', padding: '6px 8px' }}>
              <p style={{ fontWeight: 900, fontSize: '11px', textTransform: 'uppercase',
                          margin: '0 0 3px 0', letterSpacing: '0.5px' }}>Notas del cliente:</p>
              <p style={{ margin: 0, fontWeight: 700 }}>{o.comment}</p>
            </div>
          </>
        )}

        <Divider />

        <p style={{ textAlign: 'center', fontSize: '10px', color: '#9ca3af', margin: '4px 0 0 0' }}>
          fyp.studio
        </p>
      </div>
    </>
  )
}

function Divider() {
  return (
    <div style={{ borderTop: '1px dashed #999', margin: '6px 0' }} />
  )
}
