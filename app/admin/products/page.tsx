// app/admin/products/page.tsx
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import ProductsClient from './ProductsClient'
import type { Product, Category, Plan } from '@/types'
import { PLAN_LIMITS } from '@/lib/plan-limits'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Catálogo' }

export default async function ProductsPage() {
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
  const productLimit = PLAN_LIMITS[plan].products

  const [productsRes, catsRes] = await Promise.all([
    supabase
      .from('products')
      .select('*, category:categories(id, name), variants:product_variants(*)')
      .eq('business_id', profile.business_id)
      .order('name'),
    supabase
      .from('categories')
      .select('id, name, sort_order')
      .eq('business_id', profile.business_id)
      .eq('active', true)
      .order('sort_order'),
  ])

  const products = (productsRes.data ?? []) as (Product & { category?: { id: string; name: string } | null })[]

  return (
    <ProductsClient
      products={products}
      categories={(catsRes.data ?? []) as Category[]}
      plan={plan}
      productLimit={productLimit}
    />
  )
}
