// app/admin/customers/page.tsx
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import CustomersClient from './CustomersClient'
import type { Customer, Plan } from '@/types'
import { PLAN_LIMITS } from '@/lib/plan-limits'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Clientes — CRM' }

export default async function CustomersPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('business_id, business:businesses(plan)')
    .eq('user_id', user.id)
    .single()

  if (!profile?.business_id) redirect('/admin/onboarding')

  const plan = ((profile.business as { plan?: string } | null)?.plan ?? 'basic') as Plan
  const customerLimit = PLAN_LIMITS[plan].customers

  const { data: customers } = await supabase
    .from('customers')
    .select('*')
    .eq('business_id', profile.business_id)
    .order('total_spent', { ascending: false })

  return (
    <CustomersClient
      customers={(customers ?? []) as Customer[]}
      plan={plan}
      customerLimit={customerLimit}
    />
  )
}
