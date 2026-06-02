// app/admin/caja/page.tsx
import { createClient } from '@/lib/supabase/server'
import { redirect }     from 'next/navigation'
import { getVertical }  from '@/lib/verticals'
import CajaClient       from './CajaClient'

export const metadata = { title: 'Caja' }
export const dynamic  = 'force-dynamic'

export default async function CajaPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('business_id, id, business:businesses(vertical_type)')
    .eq('user_id', user.id)
    .single()

  if (!profile?.business_id) redirect('/admin/onboarding')

  const biz    = profile.business as unknown as { vertical_type?: string } | null
  const config = getVertical(biz?.vertical_type)
  if (!config.modules.includes('caja')) redirect('/admin')

  const bid = profile.business_id

  const [registerRes, historyRes, ordersRes] = await Promise.all([
    supabase
      .from('cash_registers')
      .select('*, movements:cash_movements(*)')
      .eq('business_id', bid)
      .eq('status', 'open')
      .order('opened_at', { ascending: false })
      .limit(1)
      .maybeSingle(),

    supabase
      .from('cash_registers')
      .select('*')
      .eq('business_id', bid)
      .eq('status', 'closed')
      .order('closed_at', { ascending: false })
      .limit(10),

    supabase
      .from('orders')
      .select('total_amount')
      .eq('business_id', bid)
      .in('status', ['delivered', 'done'])
      .gte('created_at', new Date().toISOString().split('T')[0]),
  ])

  const todaySales = (ordersRes.data ?? []).reduce(
    (sum, o) => sum + ((o.total_amount as number) ?? 0), 0
  )

  return (
    <CajaClient
      openRegister={registerRes.data ?? null}
      history={(historyRes.data ?? []) as any[]}
      todaySales={todaySales}
      profileId={profile.id as string}
    />
  )
}
