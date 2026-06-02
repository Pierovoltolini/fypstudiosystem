// app/api/staff/invite — Crea una invitación de staff con verificación de límite de plan
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { checkRateLimit } from '@/lib/ratelimit'
import { PLAN_LIMITS } from '@/lib/plan-limits'
import type { Plan } from '@/types'
import { z } from 'zod'

const schema = z.object({
  email:               z.string().email('Email inválido'),
  initial_permissions: z.record(z.string(), z.boolean()).optional(),
})

export async function POST(req: Request) {
  try {
    // ── Auth ────────────────────────────────────────────────────
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user)
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

    const { data: profile } = await supabase
      .from('profiles')
      .select('business_id, role, business:businesses(plan)')
      .eq('user_id', user.id)
      .single()

    if (!profile?.business_id)
      return NextResponse.json({ error: 'Sin negocio asociado' }, { status: 403 })
    if (profile.role !== 'owner')
      return NextResponse.json({ error: 'Solo el dueño puede invitar staff' }, { status: 403 })

    // ── Rate limit ──────────────────────────────────────────────
    const limited = await checkRateLimit(`staff-invite:${user.id}`, 5, '10 m')
    if (limited)
      return NextResponse.json({ error: 'Demasiados intentos. Esperá unos minutos.' }, { status: 429 })

    // ── Validar body ────────────────────────────────────────────
    const body = await req.json()
    const parsed = schema.safeParse(body)
    if (!parsed.success)
      return NextResponse.json({ error: 'Email inválido' }, { status: 400 })

    const { email, initial_permissions } = parsed.data
    const businessId = profile.business_id
    const plan = ((profile.business as { plan?: string } | null)?.plan ?? 'basic') as Plan

    // ── Verificar límite de staff según plan ─────────────────────
    const staffLimit = PLAN_LIMITS[plan].staff
    if (staffLimit !== Infinity) {
      const service = createServiceClient()
      const { count: currentStaff } = await service
        .from('profiles')
        .select('id', { count: 'exact', head: true })
        .eq('business_id', businessId)
      if ((currentStaff ?? 0) >= staffLimit) {
        return NextResponse.json({
          error: `Tu plan ${plan === 'basic' ? 'gratuito' : plan} permite hasta ${staffLimit} ${staffLimit === 1 ? 'integrante' : 'integrantes'}. Actualizá tu plan para agregar más staff.`,
          limitReached: true,
          upgradePrompt: true,
          current: currentStaff,
          limit: staffLimit,
        }, { status: 403 })
      }
    }

    // ── Verificar invitación duplicada ───────────────────────────
    const { data: existing } = await supabase
      .from('invitations')
      .select('id, expires_at, revoked_at')
      .eq('business_id', businessId)
      .eq('email', email.toLowerCase())
      .is('accepted_at', null)
      .is('revoked_at', null)
      .maybeSingle()

    if (existing) {
      const isExpired = new Date(existing.expires_at) < new Date()
      if (!isExpired) {
        return NextResponse.json({ error: 'conflict', invitationId: existing.id }, { status: 409 })
      }
      // Auto-revoke expired invitation
      await supabase
        .from('invitations')
        .update({ revoked_at: new Date().toISOString(), revoked_by: user.id })
        .eq('id', existing.id)
    }

    // ── Crear invitación ─────────────────────────────────────────
    const { data, error: insertErr } = await supabase
      .from('invitations')
      .insert({
        business_id:         businessId,
        email:               email.toLowerCase(),
        role:                'staff',
        initial_permissions: initial_permissions ?? null,
      })
      .select('token')
      .single()

    if (insertErr) {
      const isConflict = insertErr.code === '23505' || insertErr.message?.includes('unique')
      return NextResponse.json(
        { error: isConflict ? 'conflict' : insertErr.message },
        { status: isConflict ? 409 : 500 }
      )
    }

    return NextResponse.json({ token: data.token })
  } catch (err) {
    console.error('[api/staff/invite]', err)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
