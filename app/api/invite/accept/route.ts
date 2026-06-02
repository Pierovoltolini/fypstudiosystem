// app/api/invite/accept/route.ts
import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { checkRateLimit } from '@/lib/ratelimit'

export async function POST(req: Request) {
  const { token } = await req.json() as { token: string }
  if (!token) return NextResponse.json({ error: 'Token requerido' }, { status: 400 })

  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const limited = await checkRateLimit(`invite-accept:${user.id}`, 5, '5 m')
  if (limited)
    return NextResponse.json({ error: 'Demasiados intentos. Esperá unos minutos.' }, { status: 429 })

  // Load invitation (public read policy allows this)
  const { data: invite } = await supabase
    .from('invitations')
    .select('id,business_id,email,role,expires_at,accepted_at,revoked_at')
    .eq('token', token)
    .single()

  if (!invite)
    return NextResponse.json({ error: 'Invitación no encontrada' }, { status: 404 })
  if (invite.revoked_at)
    return NextResponse.json({ error: 'Esta invitación fue revocada' }, { status: 400 })
  if (invite.accepted_at)
    return NextResponse.json({ error: 'Esta invitación ya fue utilizada' }, { status: 400 })
  if (new Date(invite.expires_at) < new Date())
    return NextResponse.json({ error: 'La invitación expiró' }, { status: 400 })
  if (user.email && invite.email !== user.email)
    return NextResponse.json({ error: 'Esta invitación no corresponde a tu cuenta' }, { status: 403 })

  // Create / update profile for this business
  const { error: profileErr } = await supabase
    .from('profiles')
    .upsert(
      {
        user_id:     user.id,
        business_id: invite.business_id,
        role:        invite.role,
        email:       user.email ?? invite.email,
      },
      { onConflict: 'user_id,business_id' }
    )

  if (profileErr)
    return NextResponse.json({ error: profileErr.message }, { status: 500 })

  // Mark as accepted — DB trigger fires apply_invitation_permissions automatically
  const { error: acceptErr } = await supabase
    .from('invitations')
    .update({ accepted_at: new Date().toISOString(), accepted_by: user.id })
    .eq('id', invite.id)

  if (acceptErr)
    return NextResponse.json({ error: acceptErr.message }, { status: 500 })

  return NextResponse.json({ success: true })
}
