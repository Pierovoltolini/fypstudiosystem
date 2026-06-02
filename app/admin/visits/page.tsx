// app/admin/visits/page.tsx — Agenda de visitas para inmobiliaria
// Reutiliza la tabla bookings con vocabulario de visitas a propiedades
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { getVertical } from '@/lib/verticals'
import VisitsClient from './VisitsClient'
import type { Booking, Product } from '@/types'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Visitas' }

export default async function VisitsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('business_id, business:businesses(vertical_type, whatsapp, currency)')
    .eq('user_id', user.id)
    .single()

  if (!profile?.business_id) redirect('/admin/onboarding')

  const biz    = profile.business as { vertical_type?: string; whatsapp?: string; currency?: string } | null
  const config = getVertical(biz?.vertical_type)

  // Solo accesible para real_estate (que tiene 'visits' en sus módulos)
  if (!config.modules.includes('visits')) redirect('/admin')

  const bid = profile.business_id

  const [bookingsRes, propertiesRes] = await Promise.all([
    supabase
      .from('bookings')
      .select('*, product:products(id, name, price)')
      .eq('business_id', bid)
      .order('date', { ascending: false })
      .order('start_time')
      .limit(200),
    supabase
      .from('products')
      .select('id, name, price')
      .eq('business_id', bid)
      .eq('active', true)
      .order('name'),
  ])

  return (
    <VisitsClient
      businessId={bid}
      whatsapp={biz?.whatsapp ?? ''}
      visits={(bookingsRes.data ?? []) as Booking[]}
      properties={(propertiesRes.data ?? []) as Pick<Product, 'id' | 'name' | 'price'>[]}
    />
  )
}
