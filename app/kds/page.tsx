// app/kds/page.tsx — Kitchen Display System (fullscreen, no sidebar)
import { createClient } from '@/lib/supabase/server'
import { redirect }     from 'next/navigation'
import KDSClient        from './KDSClient'
import type { Order }   from '@/types'

export const metadata = { title: 'KDS — Cocina' }
export const dynamic  = 'force-dynamic'

export default async function KDSPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('business_id, business:businesses(vertical_type, name, primary_color)')
    .eq('user_id', user.id)
    .single()

  if (!profile?.business_id) redirect('/admin/onboarding')

  const biz = profile.business as unknown as {
    vertical_type?: string; name?: string; primary_color?: string
  } | null

  const today = new Date().toISOString().split('T')[0]

  const { data: orders } = await supabase
    .from('orders')
    .select('*, items:order_items(product_name, quantity, unit_price, subtotal), table:restaurant_tables(id,name)')
    .eq('business_id', profile.business_id)
    .in('status', ['pending', 'confirmed', 'preparing', 'ready'])
    .gte('created_at', today + 'T00:00:00')
    .order('created_at', { ascending: true })

  return (
    <KDSClient
      initialOrders={(orders ?? []) as Order[]}
      businessId={profile.business_id}
      businessName={biz?.name ?? ''}
      color={biz?.primary_color ?? '#EA580C'}
    />
  )
}
