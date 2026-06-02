// app/admin/staff-accounts/page.tsx
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import RoleGate from '@/components/admin/RoleGate'
import PlanGate from '@/components/admin/PlanGate'
import StaffAccountsClient from './StaffAccountsClient'
import type { Profile, Invitation, StaffPermission, UserRole } from '@/types'

export const metadata = { title: 'Equipo' }
export const dynamic  = 'force-dynamic'

export default async function StaffAccountsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('business_id, role')
    .eq('user_id', user.id)
    .single()

  if (!profile?.business_id) redirect('/admin/onboarding')

  const role = profile.role as UserRole

  const [profilesRes, invitesRes, permsRes] = await Promise.all([
    supabase
      .from('profiles')
      .select('id,user_id,role,email,display_name,created_at')
      .eq('business_id', profile.business_id)
      .order('created_at'),
    supabase
      .from('invitations')
      .select('id,email,role,token,expires_at,accepted_at,revoked_at,resend_count,last_sent_at,created_at')
      .eq('business_id', profile.business_id)
      .is('accepted_at', null)
      .is('revoked_at', null)
      .gt('expires_at', new Date().toISOString())
      .order('created_at', { ascending: false }),
    supabase
      .from('staff_permissions')
      .select('*')
      .eq('business_id', profile.business_id),
  ])

  const permsMap = Object.fromEntries(
    ((permsRes.data ?? []) as StaffPermission[]).map(p => [p.profile_id, p])
  )
  const profiles = ((profilesRes.data ?? []) as Profile[]).map(p => ({
    ...p,
    permissions: permsMap[p.id] ?? null,
  }))

  return (
    <div className="space-y-6 animate-fade-in max-w-3xl">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Equipo</h1>
        <p className="text-sm text-gray-400 mt-0.5">
          Gestioná accesos y permisos de tu equipo
        </p>
      </div>

      <RoleGate required="owner" current={role}>
        <PlanGate
          required="pro"
          feature="Gestión de equipo"
          description="Invitá empleados y gestioná roles desde el plan Pro."
        >
          <StaffAccountsClient
            currentUserId={user.id}
            profiles={profiles}
            invitations={(invitesRes.data ?? []) as Invitation[]}
          />
        </PlanGate>
      </RoleGate>
    </div>
  )
}
