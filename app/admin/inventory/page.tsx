// app/admin/inventory/page.tsx
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import InventoryClient from './InventoryClient'
import type { InventoryItem, InventoryCategory, SupplierProduct } from '@/types'

export const metadata = { title: 'Inventario' }
export const dynamic = 'force-dynamic'

export default async function InventoryPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('business_id')
    .eq('user_id', user.id)
    .single()

  if (!profile?.business_id) redirect('/admin/onboarding')

  const [itemsRes, catsRes, supplierProdsRes] = await Promise.all([
    supabase
      .from('inventory_items')
      .select('*, category:inventory_categories(id,name,color,icon)')
      .eq('business_id', profile.business_id)
      .eq('active', true)
      .order('name'),
    supabase
      .from('inventory_categories')
      .select('*')
      .eq('business_id', profile.business_id)
      .order('name'),
    supabase
      .from('supplier_products')
      .select('*, supplier:suppliers(id, name, phone)')
      .eq('business_id', profile.business_id)
      .not('inventory_item_id', 'is', null),
  ])

  return (
    <InventoryClient
      initialItems={(itemsRes.data ?? []) as InventoryItem[]}
      initialCategories={(catsRes.data ?? []) as InventoryCategory[]}
      supplierProducts={(supplierProdsRes.data ?? []) as unknown as (SupplierProduct & { supplier: { id: string; name: string; phone: string | null } | null })[]}
    />
  )
}
