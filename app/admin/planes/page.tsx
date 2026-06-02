// app/admin/planes — Página de billing y planes
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import PlanesClient from './PlanesClient'
import type { Plan } from '@/types'

export const metadata = { title: 'Planes y facturación' }
export const dynamic = 'force-dynamic'

export default async function PlanesPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('business_id, role, business:businesses(plan, name)')
    .eq('user_id', user.id)
    .single()

  if (!profile?.business_id) redirect('/admin/onboarding')

  const biz  = profile.business as { plan?: string; name?: string } | null
  const plan = (biz?.plan ?? 'basic') as Plan

  const service = createServiceClient()

  const [subRes, eventsRes] = await Promise.all([
    service.from('subscriptions')
      .select('plan, status, billing_cycle, current_period_start, current_period_end')
      .eq('business_id', profile.business_id)
      .maybeSingle(),
    service.from('billing_events')
      .select('event_type, mercadopago_id, created_at, payload')
      .eq('business_id', profile.business_id)
      .order('created_at', { ascending: false })
      .limit(20),
  ])

  // Feature flag y datos de contacto — leídos server-side para no exponer lógica al cliente
  const mercadopagoEnabled = process.env.MERCADOPAGO_ENABLED === 'true'
  const contactWhatsapp    = process.env.NEXT_PUBLIC_CONTACT_WHATSAPP ?? ''
  const contactEmail       = process.env.NEXT_PUBLIC_CONTACT_EMAIL    ?? ''

  return (
    <PlanesClient
      currentPlan={plan}
      isOwner={profile.role === 'owner'}
      subscription={subRes.data ?? null}
      billingEvents={eventsRes.data ?? []}
      mercadopagoEnabled={mercadopagoEnabled}
      contactWhatsapp={contactWhatsapp}
      contactEmail={contactEmail}
    />
  )
}
