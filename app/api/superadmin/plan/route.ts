// app/api/superadmin/plan — Cambia el plan de un negocio manualmente (solo superadmin)
// Actualiza businesses, subscriptions y guarda un billing_event para auditoría.
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { z } from 'zod'
import type { Plan } from '@/types'

const schema = z.object({
  business_id:         z.string().uuid(),
  plan:                z.enum(['basic', 'pro', 'premium']),
  status:              z.enum(['active', 'past_due', 'cancelled', 'suspended']).optional(),
  current_period_end:  z.string().nullable().optional(),
  internal_note:       z.string().max(500).nullable().optional(),
})

export async function POST(req: Request) {
  try {
    // ── Verificar superadmin ────────────────────────────────────
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user)
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('user_id', user.id)
      .single()

    if (profile?.role !== 'superadmin')
      return NextResponse.json({ error: 'Acceso denegado' }, { status: 403 })

    // ── Validar body ────────────────────────────────────────────
    const body = await req.json()
    const parsed = schema.safeParse(body)
    if (!parsed.success)
      return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Datos inválidos' }, { status: 400 })

    const { business_id, plan, status, current_period_end, internal_note } = parsed.data
    const service = createServiceClient()
    const now = new Date().toISOString()

    // ── Obtener plan anterior para el log ───────────────────────
    const { data: prevBiz } = await service
      .from('businesses')
      .select('plan, name')
      .eq('id', business_id)
      .single()

    // ── Actualizar businesses.plan ──────────────────────────────
    await service
      .from('businesses')
      .update({ plan, updated_at: now })
      .eq('id', business_id)

    // ── Upsert subscriptions ────────────────────────────────────
    const subPatch: Record<string, unknown> = {
      business_id,
      plan,
      updated_at: now,
    }
    if (status              !== undefined) subPatch.status             = status
    if (current_period_end  !== undefined) subPatch.current_period_end = current_period_end
    if (internal_note       !== undefined) subPatch.internal_note      = internal_note

    await service
      .from('subscriptions')
      .upsert(subPatch, { onConflict: 'business_id' })

    // ── Registrar en billing_events (historial) ─────────────────
    await service.from('billing_events').insert({
      business_id,
      event_type:    'manual_plan_change',
      mercadopago_id: null,
      payload: {
        previous_plan:  prevBiz?.plan ?? null,
        new_plan:       plan,
        changed_by:     user.id,
        note:           internal_note ?? null,
        period_end:     current_period_end ?? null,
      },
    })

    return NextResponse.json({ ok: true, plan, business: prevBiz?.name })
  } catch (err) {
    console.error('[api/superadmin/plan]', err)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
