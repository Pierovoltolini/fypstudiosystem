// app/admin/layout.tsx
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import AdminShell from '@/components/admin/AdminShell'
import VerticalProvider from '@/components/admin/VerticalProvider'
import { getVertical, getVerticalGroup } from '@/lib/verticals'
import type { Business, UserRole } from '@/types'

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('*, business:businesses(*)')
    .eq('user_id', user.id)
    .single()

  const needsOnboarding = !profile || !profile.business_id
  const business = (profile?.business ?? null) as Business | null
  const role = (profile?.role ?? 'staff') as UserRole

  if (needsOnboarding) {
    return (
      <div style={{ background: '#F7F9FC', minHeight: '100vh' }}>
        {children}
      </div>
    )
  }

  const vertical    = getVertical(business?.vertical_type)
  const group       = getVerticalGroup(business?.vertical_type)
  const color       = business?.primary_color ?? vertical.color
  const currency    = business?.currency ?? 'UYU'
  // Para negocios nuevos: vertical_sub tiene el subrubro ('barberia', 'restaurante', etc.)
  // Para negocios legacy: vertical_sub es null → caemos a vertical_type ('barbershop', 'real_estate', etc.)
  const verticalSub = business?.vertical_sub ?? business?.vertical_type ?? ''

  return (
    <VerticalProvider value={{
      business:    business!,
      businessId:  profile!.business_id,
      userId:      user.id,
      vertical,
      group,
      verticalSub,
      role,
      currency,
      color,
      userEmail:   user.email ?? '',
    }}>
      <AdminShell
        business={business}
        userEmail={user.email ?? ''}
        suspended={business?.subscription_status === 'suspended'}
        role={role}
      >
        {children}
      </AdminShell>
    </VerticalProvider>
  )
}
