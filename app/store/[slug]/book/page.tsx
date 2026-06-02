// app/store/[slug]/book/page.tsx — Reservas online para barbería/belleza
import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import BookingFlow from '@/components/barbershop/BookingFlow'
import type { Business, Staff, Product, Branch } from '@/types'

export const metadata = { title: 'Reservar turno' }

export default async function BookPage({ params }: { params: { slug: string } }) {
  const supabase = await createClient()

  const { data: business } = await supabase
    .from('businesses')
    .select('*')
    .eq('slug', params.slug)
    .eq('active', true)
    .single()

  if (!business) notFound()

  const [staffRes, servicesRes, branchesRes] = await Promise.all([
    supabase
      .from('staff')
      .select('*, schedules:staff_schedules(*)')
      .eq('business_id', business.id)
      .eq('active', true)
      .order('name'),
    supabase
      .from('products')
      .select('*')
      .eq('business_id', business.id)
      .eq('active', true)
      .order('name'),
    supabase
      .from('branches')
      .select('*')
      .eq('business_id', business.id)
      .eq('active', true)
      .order('is_main', { ascending: false }),
  ])

  return (
    <BookingFlow
      business={business as Business}
      staff={(staffRes.data ?? []) as (Staff & { schedules: unknown[] })[]}
      services={(servicesRes.data ?? []) as Product[]}
      branches={(branchesRes.data ?? []) as Branch[]}
    />
  )
}
