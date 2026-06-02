// app/admin/categories/page.tsx
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { getVertical } from '@/lib/verticals'
import CategoryManager from './CategoryManager'
import type { Category } from '@/types'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Categorías' }

export default async function CategoriesPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('business_id, business:businesses(vertical_type)')
    .eq('user_id', user.id)
    .single()

  if (!profile?.business_id) redirect('/admin/onboarding')

  const biz    = profile.business as unknown as { vertical_type?: string } | null
  const config = getVertical(biz?.vertical_type)

  // Label singular para UI: 'categoría', 'sección', 'zona'...
  const label = config.categoryLabel.toLowerCase()

  const rawType = biz?.vertical_type ?? ''
  const description =
    config.key === 'gastro'                     ? 'Organizá tu menú por secciones (Entradas, Platos, Bebidas...)' :
    rawType === 'real_estate'                   ? 'Organizá propiedades por zona o tipo' :
    rawType === 'fashion' || rawType === 'ropa' ? 'Organizá tu catálogo por tipo de prenda o colección' :
    `Organizá tus ${config.productLabel.toLowerCase()}s por ${label}`

  const { data: categories } = await supabase
    .from('categories')
    .select('*')
    .eq('business_id', profile.business_id)
    .order('sort_order')
    .order('created_at')

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-xl lg:text-2xl font-bold text-gray-900 tracking-tight">
          {config.categoryLabel}s
        </h1>
        <p className="text-sm text-gray-400 mt-0.5">{description}</p>
      </div>

      <CategoryManager
        businessId={profile.business_id}
        initialCategories={(categories ?? []) as Category[]}
        label={label}
      />
    </div>
  )
}
