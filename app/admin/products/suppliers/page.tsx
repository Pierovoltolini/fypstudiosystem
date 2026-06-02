// app/admin/suppliers/page.tsx
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import SuppliersClient from './SuppliersClient'
import type { Supplier, InventoryItem, PurchaseOrder } from '@/types'

export const metadata = { title: 'Proveedores' }
export const dynamic = 'force-dynamic'

export default async function SuppliersPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('business_id, business:businesses(name, currency)')
    .eq('user_id', user.id)
    .single()

  if (!profile?.business_id) redirect('/admin/onboarding')

  // Proveedores con sus productos
  const [suppliersRes, inventoryRes, ordersRes] = await Promise.all([
    supabase
      .from('suppliers')
      .select(`
        *,
        products:supplier_products(*)
      `)
      .eq('business_id', profile.business_id)
      .eq('active', true)
      .order('name'),
    supabase
      .from('inventory_items')
      .select('id, name, unit')
      .eq('business_id', profile.business_id)
      .eq('active', true)
      .order('name'),
    supabase
      .from('purchase_orders')
      .select('*, items:purchase_order_items(*)')
      .eq('business_id', profile.business_id)
      .order('created_at', { ascending: false })
      .limit(50),
  ])

  // Auto-importar proveedores desde inventory_items.supplier (texto)
  // que no estén ya creados como supplier real
  const existingNames = (suppliersRes.data ?? []).map((s: {name:string}) => s.name.toLowerCase())
  const { data: invItems } = await supabase
    .from('inventory_items')
    .select('supplier')
    .eq('business_id', profile.business_id)
    .not('supplier', 'is', null)

  const autoImport = Array.from(new Set(
    (invItems ?? [])
      .map((i: {supplier:string|null}) => i.supplier?.trim())
      .filter((s): s is string => !!s && !existingNames.includes(s.toLowerCase()))
  ))

  const biz = profile.business as unknown as { name?: string } | null

  return (
    <SuppliersClient
      businessId={profile.business_id}
      currency={(biz as unknown as { currency?: string } | null)?.currency ?? 'UYU'}
      initialSuppliers={(suppliersRes.data ?? []) as Supplier[]}
      inventoryItems={(inventoryRes.data ?? []) as InventoryItem[]}
      autoImportNames={autoImport}
      initialOrders={(ordersRes.data ?? []) as PurchaseOrder[]}
    />
  )
}
