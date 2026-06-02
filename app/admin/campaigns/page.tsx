// app/admin/campaigns/page.tsx
import { createClient } from '@/lib/supabase/server'
import { redirect }     from 'next/navigation'
import { getVertical }  from '@/lib/verticals'
import CampaignsClient  from './CampaignsClient'
import type { Customer } from '@/types'

export const metadata = { title: 'Campañas WhatsApp' }
export const dynamic  = 'force-dynamic'

export default async function CampaignsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('business_id, business:businesses(name, vertical_type, whatsapp)')
    .eq('user_id', user.id)
    .single()

  if (!profile?.business_id) redirect('/admin/onboarding')

  const biz    = profile.business as unknown as { name: string; vertical_type?: string; whatsapp?: string } | null
  const config = getVertical(biz?.vertical_type)
  if (!config.modules.includes('campaigns')) redirect('/admin')

  const { data: customers } = await supabase
    .from('customers')
    .select('id, name, phone, email, total_orders, total_spent, created_at, updated_at, tags')
    .eq('business_id', profile.business_id)
    .not('phone', 'is', null)
    .order('total_spent', { ascending: false })

  return (
    <CampaignsClient
      customers={(customers ?? []) as Customer[]}
      businessName={biz?.name ?? ''}
    />
  )
}
