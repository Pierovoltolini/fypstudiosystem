// app/admin/products/new/page.tsx
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import ProductForm from '../ProductForm'

export const metadata = { title: 'Nuevo producto' }

export default async function NewProductPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('business_id')
    .eq('user_id', user.id)
    .single()
  if (!profile?.business_id) redirect('/admin/onboarding')

  const { data: categories } = await supabase
    .from('categories')
    .select('*')
    .eq('business_id', profile.business_id)
    .eq('active', true)
    .order('sort_order')

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center gap-3">
        <Link href="/admin/products"
          className="flex h-9 w-9 items-center justify-center rounded-xl border border-gray-200
                     text-gray-500 hover:bg-gray-100 transition-colors">
          <ArrowLeft size={16} />
        </Link>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Nuevo producto</h1>
          <p className="text-sm text-gray-400 mt-0.5">Completá los datos y guardá</p>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 p-6">
        <ProductForm categories={categories ?? []} />
      </div>
    </div>
  )
}
