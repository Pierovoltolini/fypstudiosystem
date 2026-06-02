// app/admin/gastro/page.tsx
// Hub gastronómico — cocina, pedidos del día, combos, horarios
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import FoodHub from '../food/FoodHub'
import type { Order, Product, Category, BusinessHours, Combo, DeliveryRider } from '@/types'

export const metadata = { title: 'Cocina & Pedidos' }
export const dynamic  = 'force-dynamic'

export default async function GastroPage() {
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

  const today = new Date().toISOString().split('T')[0]

  const [ordersRes, productsRes, catsRes, hoursRes, combosRes, ridersRes] = await Promise.all([
    supabase
      .from('orders')
      .select('*, items:order_items(product_name, quantity, unit_price, subtotal, note), table:restaurant_tables(id,name)')
      .eq('business_id', bid)
      .gte('created_at', today + 'T00:00:00')
      .order('created_at', { ascending: false }),
    supabase
      .from('products')
      .select('*, category:categories(name)')
      .eq('business_id', bid)
      .order('featured', { ascending: false })
      .order('name'),
    supabase
      .from('categories')
      .select('*')
      .eq('business_id', bid)
      .eq('active', true)
      .order('sort_order'),
    supabase
      .from('business_hours')
      .select('*')
      .eq('business_id', bid)
      .order('day_of_week'),
    supabase
      .from('combos')
      .select('*, items:combo_items(id,product_id,product_name,quantity)')
      .eq('business_id', bid)
      .order('created_at', { ascending: false }),
    supabase
      .from('delivery_riders')
      .select('*')
      .eq('business_id', bid)
      .order('name'),
  ])

  return (
    <FoodHub
      orders={(ordersRes.data ?? []) as Order[]}
      products={(productsRes.data ?? []) as Product[]}
      categories={(catsRes.data ?? []) as Category[]}
      hours={(hoursRes.data ?? []) as BusinessHours[]}
      combos={(combosRes.data ?? []) as Combo[]}
      riders={(ridersRes.data ?? []) as DeliveryRider[]}
    />
  )
}
