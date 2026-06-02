// app/admin/products/[id]/edit/page.tsx
import { createClient } from '@/lib/supabase/server'
import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import ProductForm from '../../ProductForm'
import type { Product } from '@/types'

export const metadata = { title: 'Editar producto' }

export default async function EditProductPage({ params }: { params: { id: string } }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('business_id')
    .eq('user_id', user.id)
    .single()
  if (!profile?.business_id) redirect('/admin/onboarding')

  const [productRes, categoriesRes] = await Promise.all([
    supabase.from('products').select('*').eq('id', params.id).eq('business_id', profile.business_id).single(),
    supabase.from('categories').select('*').eq('business_id', profile.business_id).eq('active', true).order('sort_order'),
  ])

  if (!productRes.data) notFound()

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center gap-3">
        <Link href="/admin/products"
          className="flex h-9 w-9 items-center justify-center rounded-xl border border-gray-200
                     text-gray-500 hover:bg-gray-100 transition-colors">
          <ArrowLeft size={16} />
        </Link>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Editar producto</h1>
          <p className="text-sm text-gray-400 mt-0.5 truncate max-w-xs">{productRes.data.name}</p>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 p-6">
        <ProductForm
          categories={categoriesRes.data ?? []}
          product={productRes.data as Product}
        />
      </div>
    </div>
  )
}
