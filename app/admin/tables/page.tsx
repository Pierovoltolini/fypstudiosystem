// app/admin/tables/page.tsx
import { createClient } from '@/lib/supabase/server'
import { redirect }     from 'next/navigation'
import { getVertical }  from '@/lib/verticals'
import TablesClient     from './TablesClient'
import type { RestaurantTable, TableSession, TableReservation } from '@/types'

export const metadata = { title: 'Mesas' }
export const dynamic  = 'force-dynamic'

export default async function TablesPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('business_id, business:businesses(vertical_type)')
    .eq('user_id', user.id)
    .single()

  if (!profile?.business_id) redirect('/admin/onboarding')

  const biz    = profile.business as unknown as { vertical_type?: string } | null
  const config = getVertical(biz?.vertical_type)
  if (!config.modules.includes('tables')) redirect('/admin')

  const bid = profile.business_id

  const today = new Date().toISOString().split('T')[0]
  const in7d  = new Date(Date.now() + 7 * 86_400_000).toISOString().split('T')[0]

  const [tablesRes, sessionsRes, reservationsRes] = await Promise.all([
    supabase
      .from('restaurant_tables')
      .select('*')
      .eq('business_id', bid)
      .eq('active', true)
      .order('sort_order')
      .order('name'),

    supabase
      .from('table_sessions')
      .select('*')
      .eq('business_id', bid)
      .eq('status', 'open'),

    supabase
      .from('table_reservations')
      .select('*, table:restaurant_tables(id,name)')
      .eq('business_id', bid)
      .gte('date', today)
      .lte('date', in7d)
      .not('status', 'in', '("cancelled","noshow")')
      .order('date')
      .order('time'),
  ])

  return (
    <TablesClient
      initialTables={(tablesRes.data ?? []) as RestaurantTable[]}
      initialSessions={(sessionsRes.data ?? []) as TableSession[]}
      initialReservations={(reservationsRes.data ?? []) as TableReservation[]}
    />
  )
}
