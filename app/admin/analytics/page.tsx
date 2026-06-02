// app/admin/analytics/page.tsx
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import AnalyticsClient from './AnalyticsClient'
import type { Order } from '@/types'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Reportes' }

export default async function AnalyticsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('business_id')
    .eq('user_id', user.id)
    .single()

  if (!profile?.business_id) redirect('/admin/onboarding')

  const bid         = profile.business_id
  const since90d    = new Date(Date.now() - 90 * 86_400_000).toISOString()
  const since90dDay = since90d.split('T')[0]

  const [ordersRes, customersCountRes, costsRes, cajaRes] = await Promise.all([
    supabase
      .from('orders')
      .select('id, order_number, status, total, confirmed_sale, delivery_type, created_at, items:order_items(product_name, quantity, unit_price, subtotal, cost_price)')
      .eq('business_id', bid)
      .gte('created_at', since90d)
      .order('created_at', { ascending: true }),
    supabase
      .from('customers')
      .select('id, created_at', { count: 'exact', head: false })
      .eq('business_id', bid)
      .gte('created_at', since90d),
    supabase
      .from('business_costs')
      .select('amount, type, date')
      .eq('business_id', bid)
      .gte('date', since90dDay),
    supabase
      .from('cash_registers')
      .select('id, opened_at, closed_at, opening_amount, closing_amount, expected_amount, difference, status')
      .eq('business_id', bid)
      .gte('opened_at', since90d)
      .order('opened_at', { ascending: true }),
  ])

  return (
    <AnalyticsClient
      orders={(ordersRes.data ?? []) as Order[]}
      customers={(customersCountRes.data ?? []) as { id: string; created_at: string }[]}
      costs={(costsRes.data ?? []) as { amount: number; type: string; date: string }[]}
      cajaSessions={(cajaRes.data ?? []) as CajaSession[]}
    />
  )
}

interface CajaSession {
  id: string; opened_at: string; closed_at: string | null
  opening_amount: number; closing_amount: number | null
  expected_amount: number | null; difference: number | null; status: string
}

export type { CajaSession }
