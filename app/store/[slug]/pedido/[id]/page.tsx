// app/store/[slug]/pedido/[id]/page.tsx
// Public order receipt & tracking — no auth required (UUID is secret)
import { createServiceClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import OrderTracking from './OrderTracking'
import type { Business, Order, OrderItem } from '@/types'

export const dynamic = 'force-dynamic'

export async function generateMetadata({ params }: { params: { slug: string; id: string } }) {
  return { title: `Pedido confirmado — ${params.slug}` }
}

export default async function OrderReceiptPage({
  params,
}: {
  params: { slug: string; id: string }
}) {
  const supabase = createServiceClient()

  const [businessRes, orderRes] = await Promise.all([
    supabase
      .from('businesses')
      .select('id, name, slug, logo_url, primary_color, secondary_color, whatsapp, currency')
      .eq('slug', params.slug)
      .eq('active', true)
      .single(),
    supabase
      .from('orders')
      .select('*, items:order_items(*), table:restaurant_tables(id,name,qr_token)')
      .eq('id', params.id)
      .single(),
  ])

  if (!businessRes.data || !orderRes.data) notFound()

  const business = businessRes.data as Business
  const order    = orderRes.data as Order & { items: OrderItem[] }

  // Verify the order belongs to this business
  if (order.business_id !== business.id) notFound()

  return (
    <OrderTracking
      business={business}
      order={order}
    />
  )
}
