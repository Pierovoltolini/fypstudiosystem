// app/store/[slug]/checkout/page.tsx
import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import CheckoutClient from '@/components/store/CheckoutClient'
import type { Business } from '@/types'

export const metadata = { title: 'Confirmar pedido' }

export default async function CheckoutPage({
  params,
  searchParams,
}: {
  params: { slug: string }
  searchParams: { mesa?: string }
}) {
  const supabase = await createClient()
  const { data: business } = await supabase
    .from('businesses')
    .select('*')
    .eq('slug', params.slug)
    .eq('active', true)
    .single()

  if (!business) notFound()

  // Lookup table from ?mesa= param
  let table: { id: string; name: string } | null = null
  if (searchParams.mesa) {
    const { data: t } = await supabase
      .from('restaurant_tables')
      .select('id,name')
      .eq('id', searchParams.mesa)
      .eq('business_id', business.id)
      .eq('active', true)
      .single()
    table = t ?? null
  }

  return <CheckoutClient business={business as Business} table={table} />
}
