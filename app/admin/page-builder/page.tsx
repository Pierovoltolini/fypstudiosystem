// app/admin/page-builder/page.tsx
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import PageBuilderClient from './PageBuilderClient'
import type { Business } from '@/types'

export const metadata = { title: 'Diseño de tienda' }
export const dynamic = 'force-dynamic'

export default async function PageBuilderPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('business_id, business:businesses(*)')
    .eq('user_id', user.id)
    .single()

  if (!profile?.business_id) redirect('/admin/onboarding')

  const { data: products } = await supabase
    .from('products')
    .select('id, name, price, images, featured, active')
    .eq('business_id', profile.business_id)
    .eq('active', true)
    .order('featured', { ascending: false })
    .limit(12)

  const { data: categories } = await supabase
    .from('categories')
    .select('*')
    .eq('business_id', profile.business_id)
    .eq('active', true)

  return (
    <PageBuilderClient
      business={profile.business as unknown as Business}
      products={products ?? []}
      categories={categories ?? []}
    />
  )
}
