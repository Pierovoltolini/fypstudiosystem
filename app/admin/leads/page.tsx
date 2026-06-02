// app/admin/leads/page.tsx — CRM de Leads para real_estate / services
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { getVertical } from '@/lib/verticals'
import LeadsClient from './LeadsClient'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Leads' }

export default async function LeadsPage() {
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

  if (!config.modules.includes('leads')) redirect('/admin')

  const { data: leads } = await supabase
    .from('leads')
    .select('*, product:products(name)')
    .eq('business_id', profile.business_id)
    .order('created_at', { ascending: false })

  return (
    <LeadsClient
      leads={(leads ?? []) as Parameters<typeof LeadsClient>[0]['leads']}
      isRealEstate={biz?.vertical_type === 'real_estate'}
    />
  )
}
