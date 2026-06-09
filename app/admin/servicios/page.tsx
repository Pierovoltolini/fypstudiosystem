// app/admin/servicios/page.tsx
// Hub de servicios — agenda, turnos, staff, disponibilidad
// Funciona para barbería, peluquería, estética, salud, taller, profesional, etc.
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import BarbershopHub from '../barbershop/BarbershopHub'
import SectionTour from '@/components/admin/SectionTour'
import type { Booking, Staff, Branch, Product } from '@/types'

export const metadata = { title: 'Agenda' }
export const dynamic  = 'force-dynamic'

export default async function ServiciosPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('business_id')
    .eq('user_id', user.id)
    .single()

  if (!profile?.business_id) redirect('/admin/onboarding')

  const bid   = profile.business_id
  const today = new Date().toISOString().split('T')[0]

  const [bookingsRes, staffRes, branchesRes, servicesRes] = await Promise.all([
    supabase
      .from('bookings')
      .select('*, staff:staff(name,color), branch:branches(name), product:products(name,price)')
      .eq('business_id', bid)
      .gte('date', today)
      .order('date').order('start_time')
      .limit(200),
    supabase
      .from('staff')
      .select('*, branch:branches(name)')
      .eq('business_id', bid)
      .eq('active', true)
      .order('name'),
    supabase
      .from('branches')
      .select('*')
      .eq('business_id', bid)
      .eq('active', true)
      .order('is_main', { ascending: false }),
    supabase
      .from('products')
      .select('id, name, price, description')
      .eq('business_id', bid)
      .eq('active', true)
      .order('name'),
  ])

  return (
    <>
      <SectionTour section="servicios" />
      <BarbershopHub
        bookings={(bookingsRes.data ?? []) as Booking[]}
        staff={(staffRes.data ?? []) as Staff[]}
        branches={(branchesRes.data ?? []) as Branch[]}
        services={(servicesRes.data ?? []) as Product[]}
      />
    </>
  )
}
