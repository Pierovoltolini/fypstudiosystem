// app/admin/costs/page.tsx
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import CostsClient from './CostsClient'

export const metadata = { title: 'Costos' }
export const dynamic = 'force-dynamic'

export default async function CostsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const { data: profile } = await supabase
    .from('profiles').select('business_id').eq('user_id', user.id).single()
  if (!profile?.business_id) redirect('/admin/onboarding')

  const now = new Date()
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()

  const [ordersRes] = await Promise.all([
    supabase
      .from('orders')
      .select('id, total, status, created_at')
      .eq('business_id', profile.business_id)
      .gte('created_at', startOfMonth)
      .neq('status', 'cancelled'),
  ])

  // COGS: sum cost_price * quantity from order_items for this month's orders
  const orderIds = (ordersRes.data ?? []).map(o => o.id)
  let cogs = 0
  if (orderIds.length > 0) {
    const { data: orderItems } = await supabase
      .from('order_items')
      .select('cost_price, quantity')
      .in('order_id', orderIds)
    cogs = (orderItems ?? []).reduce(
      (sum, item) => sum + ((item.cost_price ?? 0) * (item.quantity ?? 1)), 0
    )
  }

  return (
    <CostsClient
      orders={ordersRes.data ?? []}
      cogs={cogs}
    />
  )
}
