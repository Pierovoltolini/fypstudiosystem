// app/admin/billing/page.tsx
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import BillingClient from './BillingClient'
import type { Plan, SubscriptionStatus } from '@/types'

export const metadata = { title: 'Planes y facturación' }

export default async function BillingPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('business_id, business:businesses(name, plan, subscription_status, subscription_expires_at)')
    .eq('user_id', user.id)
    .single()

  if (!profile?.business_id) redirect('/admin/onboarding')

  const biz = profile.business as unknown as {
    name: string
    plan: Plan
    subscription_status: SubscriptionStatus
    subscription_expires_at?: string | null
  } | null

  return (
    <div className="space-y-6 animate-fade-in max-w-4xl">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Planes y facturación</h1>
        <p className="text-sm text-gray-400 mt-0.5">
          Gestioná tu suscripción y desbloqueá funcionalidades
        </p>
      </div>

      <BillingClient
        plan={biz?.plan ?? 'basic'}
        status={biz?.subscription_status ?? 'trial'}
        expiresAt={biz?.subscription_expires_at ?? null}
        businessName={biz?.name ?? ''}
      />
    </div>
  )
}
