// app/invite/[token]/page.tsx
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import AcceptInviteClient from './AcceptInviteClient'

export const metadata = { title: 'Unirte al equipo · FYP Studio' }

export default async function InvitePage({ params }: { params: { token: string } }) {
  const supabase = await createClient()

  // Cargar invitación (público)
  const { data: invite } = await supabase
    .from('invitations')
    .select('id,email,role,expires_at,accepted_at,revoked_at,business_id,businesses(name,primary_color,logo_url)')
    .eq('token', params.token)
    .single()

  // Token inválido
  if (!invite) {
    return <InviteError title="Invitación no encontrada" body="Este link no es válido." />
  }

  // Revocada
  if (invite.revoked_at) {
    return <InviteError title="Invitación revocada" body="Esta invitación fue cancelada. Pedile al propietario un nuevo link." />
  }

  // Ya usada
  if (invite.accepted_at) {
    return <InviteError title="Invitación ya utilizada" body="Esta invitación ya fue aceptada." />
  }

  // Expirada
  if (new Date(invite.expires_at) < new Date()) {
    return <InviteError title="Invitación expirada" body="Pedile al propietario que te genere un nuevo link." />
  }

  const biz = invite.businesses as unknown as {
    name: string; primary_color: string; logo_url?: string | null
  } | null

  // Si el usuario ya está logueado, aceptar automáticamente
  const { data: { user } } = await supabase.auth.getUser()
  if (user) {
    await supabase
      .from('profiles')
      .upsert(
        { user_id: user.id, business_id: invite.business_id, role: invite.role, email: user.email ?? invite.email },
        { onConflict: 'user_id,business_id' }
      )
    // Marking accepted triggers apply_invitation_permissions in DB
    await supabase
      .from('invitations')
      .update({ accepted_at: new Date().toISOString(), accepted_by: user.id })
      .eq('token', params.token)
    redirect('/admin')
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        {/* Business card */}
        <div className="bg-white rounded-2xl border border-gray-100 p-6 mb-4 text-center shadow-sm">
          <div
            className="h-14 w-14 rounded-2xl flex items-center justify-center mx-auto mb-3 text-white font-bold text-xl"
            style={{ background: biz?.primary_color ?? '#1565FF' }}
          >
            {biz?.name.slice(0, 1).toUpperCase()}
          </div>
          <p className="font-bold text-gray-900 text-lg">{biz?.name ?? 'Un negocio'}</p>
          <p className="text-sm text-gray-500 mt-1">
            te invitó a unirte como <span className="font-medium text-gray-700">empleado</span>
          </p>
        </div>

        <AcceptInviteClient
          token={params.token}
          inviteEmail={invite.email}
          primaryColor={biz?.primary_color ?? '#1565FF'}
        />
      </div>
    </div>
  )
}

function InviteError({ title, body }: { title: string; body: string }) {
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="text-center max-w-xs">
        <div className="text-4xl mb-4">🔗</div>
        <p className="font-semibold text-gray-900 mb-1">{title}</p>
        <p className="text-sm text-gray-500">{body}</p>
      </div>
    </div>
  )
}
