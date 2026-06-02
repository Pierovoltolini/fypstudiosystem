// app/admin/page.tsx — Dashboard universal para todos los verticales
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import UniversalDashboard from '@/components/admin/dashboards/UniversalDashboard'

export const metadata = { title: 'Dashboard' }
export const dynamic = 'force-dynamic'

export default async function AdminDashboard() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('business_id')
    .eq('user_id', user.id)
    .single()

  if (!profile?.business_id) redirect('/admin/onboarding')

  // Verificar si el usuario ya completó o saltó el tour
  const { data: tourRow } = await supabase
    .from('user_onboarding')
    .select('completed_at, skipped_at')
    .eq('user_id', user.id)
    .maybeSingle()
  const showTour = !tourRow?.completed_at && !tourRow?.skipped_at

  return <UniversalDashboard showTour={showTour} />
}
