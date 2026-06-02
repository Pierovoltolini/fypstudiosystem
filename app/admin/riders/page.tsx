// app/admin/riders/page.tsx
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import RidersClient from './RidersClient'
import type { DeliveryRider } from '@/types'

export const metadata = { title: 'Repartidores' }
export const dynamic  = 'force-dynamic'

export default async function RidersPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('business_id')
    .eq('user_id', user.id)
    .single()

  if (!profile?.business_id) redirect('/admin/onboarding')

  const since30 = new Date(Date.now() - 30 * 86_400_000).toISOString()

  const [{ data: riders }, { data: recentOrders }] = await Promise.all([
    supabase
      .from('delivery_riders')
      .select('id, name, phone, active, created_at, updated_at')
      .eq('business_id', profile.business_id)
      .order('name'),
    supabase
      .from('orders')
      .select('id, rider_id, status, total, created_at')
      .eq('business_id', profile.business_id)
      .not('rider_id', 'is', null)
      .gte('created_at', since30),
  ])

  return (
    <RidersClient
      riders={(riders ?? []) as DeliveryRider[]}
      recentOrders={(recentOrders ?? []) as { id: string; rider_id: string; status: string; total: number; created_at: string }[]}
    />
  )
}
