// app/admin/promos/page.tsx
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import PromosClient from './PromosClient'
import type { DiscountCode } from '@/types'

export const metadata = { title: 'Promociones' }

export default async function PromosPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('business_id')
    .eq('user_id', user.id)
    .single()

  if (!profile?.business_id) redirect('/admin/onboarding')

  const { data: codes } = await supabase
    .from('discount_codes')
    .select('*')
    .eq('business_id', profile.business_id)
    .order('created_at', { ascending: false })

  return <PromosClient codes={(codes ?? []) as DiscountCode[]} />
}
