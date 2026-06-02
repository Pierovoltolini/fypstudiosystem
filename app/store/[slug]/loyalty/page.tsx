// app/store/[slug]/loyalty/page.tsx
import { createClient }  from '@/lib/supabase/server'
import { notFound }      from 'next/navigation'
import LoyaltyLookup     from './LoyaltyLookup'
import type { Business } from '@/types'

export async function generateMetadata({ params }: { params: { slug: string } }) {
  const supabase = await createClient()
  const { data } = await supabase
    .from('businesses')
    .select('name')
    .eq('slug', params.slug)
    .eq('active', true)
    .single()
  return { title: data ? `Mis puntos — ${data.name}` : 'Puntos de fidelización' }
}

export default async function StoreLoyaltyPage({ params }: { params: { slug: string } }) {
  const supabase = await createClient()

  const { data: business } = await supabase
    .from('businesses')
    .select('*')
    .eq('slug', params.slug)
    .eq('active', true)
    .single()

  if (!business) notFound()

  const { data: settings } = await supabase
    .from('loyalty_settings')
    .select('enabled, points_per_unit, redeem_ratio, min_redeem')
    .eq('business_id', business.id)
    .single()

  if (!settings?.enabled) notFound()

  return (
    <LoyaltyLookup
      business={business as Business}
      settings={settings as { points_per_unit: number; redeem_ratio: number; min_redeem: number }}
    />
  )
}
