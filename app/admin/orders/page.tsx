// app/admin/orders/page.tsx
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import OrdersClient from './OrdersClient'
import type { Order } from '@/types'

export const metadata = { title: 'Pedidos' }
export const dynamic = 'force-dynamic'

export default async function OrdersPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('business_id')
    .eq('user_id', user.id)
    .single()

  if (!profile?.business_id) redirect('/admin/onboarding')

  const since = new Date(Date.now() - 60 * 86_400_000).toISOString()

  const { data: orders } = await supabase
    .from('orders')
    .select('id, business_id, order_number, status, payment_status, confirmed_sale, delivery_type, total, subtotal, comment, customer_name, customer_phone, customer_address, table_id, table:restaurant_tables(id,name), created_at, updated_at, items:order_items(product_name, quantity, unit_price, subtotal)')
    .eq('business_id', profile.business_id)
    .gte('created_at', since)
    .order('created_at', { ascending: false })

  return <OrdersClient orders={(orders ?? []) as unknown as Order[]} />
}
