// app/admin/loyalty/page.tsx
import { createClient } from '@/lib/supabase/server'
import { redirect }     from 'next/navigation'
import { getVertical }  from '@/lib/verticals'
import LoyaltyClient    from './LoyaltyClient'
import type { LoyaltySettings } from '@/types'

export const metadata = { title: 'Fidelización' }
export const dynamic  = 'force-dynamic'

export default async function LoyaltyPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('business_id, business:businesses(vertical_type, currency)')
    .eq('user_id', user.id)
    .single()

  if (!profile?.business_id) redirect('/admin/onboarding')

  const biz    = profile.business as unknown as { vertical_type?: string; currency?: string } | null
  const config = getVertical(biz?.vertical_type)
  if (!config.modules.includes('loyalty')) redirect('/admin')

  const bid = profile.business_id

  const [settingsRes, topCustomersRes] = await Promise.all([
    supabase
      .from('loyalty_settings')
      .select('*')
      .eq('business_id', bid)
      .single(),

    supabase
      .from('loyalty_points')
      .select('customer_id, customers(name)')
      .eq('business_id', bid)
      .order('created_at', { ascending: false }),
  ])

  return (
    <LoyaltyClient
      businessId={bid}
      currency={biz?.currency ?? 'UYU'}
      initialSettings={(settingsRes.data as LoyaltySettings | null) ?? null}
      rawPoints={(topCustomersRes.data ?? []) as unknown as Array<{ customer_id: string; customers: { name: string } | null }>}
    />
  )
}
