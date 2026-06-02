// app/admin/mercados/page.tsx — POS Hub para mercados
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import POSClient from './POSClient'
import type { Product, Category } from '@/types'

export const metadata = { title: 'POS — Punto de Venta' }
export const dynamic = 'force-dynamic'

export default async function MercadosPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('business_id')
    .eq('user_id', user.id)
    .single()

  if (!profile?.business_id) redirect('/admin/onboarding')

  const bid = profile.business_id

  const [productsRes, catsRes] = await Promise.all([
    supabase
      .from('products')
      .select('id, name, price, images, category_id, inventory_item:inventory_items(id, sku, stock_current)')
      .eq('business_id', bid)
      .eq('active', true)
      .order('name'),
    supabase
      .from('categories')
      .select('id, name, sort_order')
      .eq('business_id', bid)
      .eq('active', true)
      .order('sort_order'),
  ])

  return (
    <POSClient
      products={(productsRes.data ?? []) as unknown as Product[]}
      categories={(catsRes.data ?? []) as Category[]}
    />
  )
}
